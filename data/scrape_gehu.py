import json, re, os, pdfplumber, requests
from bs4 import BeautifulSoup
from pathlib import Path
from urllib.parse import urljoin

BASE = "https://gehu.ac.in/dehradun"
OUT  = Path("data/gehu_raw.jsonl")
OUT.parent.mkdir(parents=True, exist_ok=True)

def fetch(url):
    """GET with a tiny retry logic."""
    for _ in range(3):
        try:
            r = requests.get(url, timeout=15)
            r.raise_for_status()
            return r.text
        except Exception as e:
            print(f"⚠️ retry {url}: {e}")
    return ""

def clean_html(html):
    """Strip tags, collapse whitespace."""
    txt = BeautifulSoup(html, "html.parser").get_text(separator=" ")
    return re.sub(r"\s+", " ", txt).strip()

def extract_faq():
    """Admissions, Academics, Contact – give a Q/A pair per paragraph."""
    url = f"{BASE}/admissions/"
    html = fetch(url)
    soup = BeautifulSoup(html, "html.parser")
    # Grab the main paragraph block (the first <p> after the header)
    para = soup.find("p")
    if para:
        q = "What is the admission process at GEHU?"
        a = clean_html(str(para))
        return [{"type":"faq","question":q,"answer":a,"source":url}]
    return []

def extract_academics():
    url = f"{BASE}/academics/"
    html = fetch(url)
    soup = BeautifulSoup(html, "html.parser")
    # Grab the description paragraph after the header
    para = soup.find_all("p")
    if para:
        a = clean_html(str(para[0]))
        q = "What programmes does GEHU offer?"
        return [{"type":"faq","question":q,"answer":a,"source":url}]
    return []

def extract_contact():
    url = f"{BASE}/contact/"
    html = fetch(url)
    soup = BeautifulSoup(html, "html.parser")
    txt = clean_html(str(soup))
    # Pull phone/e‑mail lines via regex
    phones = re.findall(r"\b\d{4}\s?\d{3}\s?\d{4}\b", txt)
    emails = re.findall(r"[\w\.-]+@[\w\.-]+", txt)
    q = "How can I contact GEHU?"
    a = f"Phone(s): {', '.join(set(phones))}. Email(s): {', '.join(set(emails))}."
    return [{"type":"faq","question":q,"answer":a,"source":url}]

def extract_notices_and_events():
    url = f"{BASE}/notices-and-events/"
    html = fetch(url)
    soup = BeautifulSoup(html, "html.parser")
    records = []
    # Events – they appear as <h3> followed by a date line
    for h in soup.find_all("h3"):
        title = clean_html(str(h))
        # The next sibling that looks like a date
        date_node = h.find_next_sibling(text=True)
        if date_node:
            date = date_node.strip().lstrip("/ ").strip()
        else:
            date = ""
        if title and date:
            records.append({
                "type":"event",
                "title":title,
                "date":date,
                "source":url
            })
    # Notices – they appear as <h3> under a "Notices" sub‑section
    for h in soup.select("h3"):
        if "Notice" in h.text or "Term Evaluation" in h.text:
            title = clean_html(str(h))
            date_node = h.find_next_sibling(text=True)
            date = date_node.strip().lstrip("/ ").strip() if date_node else ""
            records.append({
                "type":"notice",
                "title":title,
                "date":date,
                "source":url
            })
    return records

def download_and_extract_pdf(pdf_url, label):
    """Utility for the PDF‑based pages (calendar, hostel fee)."""
    resp = requests.get(pdf_url, stream=True, timeout=30)
    resp.raise_for_status()
    tmp = Path("tmp.pdf")
    with tmp.open("wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)
    # Extract raw text from the PDF (first few pages are enough for a summary)
    text = ""
    with pdfplumber.open(tmp) as pdf:
        for page in pdf.pages[:5]:
            text += page.extract_text() + "\n"
    tmp.unlink()
    return {
        "type":"pdf",
        "label":label,
        "url":pdf_url,
        "content":text.strip()
    }

def extract_academic_calendar():
    # The calendar page lists PDF titles but not the direct URLs – we have to
    # follow the first <a> under each list item.
    url = f"{BASE}/academics/calendar/"
    html = fetch(url)
    soup = BeautifulSoup(html, "html.parser")
    records = []
    for a in soup.select("a"):
        link = a.get("href")
        if not link:
            continue
        title = clean_html(str(a))
        # Heuristic: only keep titles that contain the word "Calendar"
        if "Calendar" in title:
            full = urljoin(BASE, link)
            records.append(download_and_extract_pdf(full, title))
    return records

def extract_hostel_fee():
    url = f"{BASE}/hostel-fee/"
    html = fetch(url)
    soup = BeautifulSoup(html, "html.parser")
    # Find the link that says “Download” – that points to the PDF
    dl = soup.find("a", string=re.compile("Download", re.I))
    if dl and dl.get("href"):
        pdf_url = urljoin(BASE, dl["href"])
        return [download_and_extract_pdf(pdf_url, "Hostel Fees 2025‑2026")]
    return []

def main():
    all_records = []
    all_records.extend(extract_faq())
    all_records.extend(extract_academics())
    all_records.extend(extract_contact())
    all_records.extend(extract_notices_and_events())
    all_records.extend(extract_academic_calendar())
    all_records.extend(extract_hostel_fee())

    # Write a JSONL file – one dict per line
    with OUT.open("w", encoding="utf-8") as f:
        for rec in all_records:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    print(f"✅  {len(all_records)} records written to {OUT}")

if __name__ == "__main__":
    main()
