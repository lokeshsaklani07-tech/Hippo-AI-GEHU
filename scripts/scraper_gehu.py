import requests, json, re
from bs4 import BeautifulSoup
from pathlib import Path

BASE = "https://gehu.ac.in/dehradun"

def fetch(url):
    r = requests.get(url, timeout=15)
    r.raise_for_status()
    return r.text

def clean(text):
    # Strip HTML tags, collapse whitespace
    txt = re.sub(r"\s+", " ", BeautifulSoup(text, "html.parser").get_text())
    return txt.strip()

def extract_faq(page_url, sections):
    """Return a list of (question, answer) pairs from a page."""
    html = fetch(page_url)
    soup = BeautifulSoup(html, "html.parser")
    # Very simple heuristic: headings → following paragraph(s)
    qa = []
    for h in soup.find_all(["h2","h3","h4"]):
        q = h.get_text(strip=True)
        # Grab the next sibling that contains text (skip empty tags)
        ans = ""
        nxt = h.find_next_sibling()
        while nxt and not nxt.get_text(strip=True):
            nxt = nxt.find_next_sibling()
        if nxt:
            ans = nxt.get_text(" ", strip=True)
        if q and ans:
            qa.append({"question": q, "answer": ans, "source": page_url})
    return qa

# ---------- collect raw Q-A -------------------------------------------------
qa_pairs = []
qa_pairs += extract_faq(f"{BASE}/admissions/", ["Admission"])
qa_pairs += extract_faq(f"{BASE}/academics/",  ["Academics"])
qa_pairs += extract_faq(f"{BASE}/contact/",    ["Contact"])

# Save as JSON
out = Path("src/lib/gehu_faq.json")
with out.open("w", encoding="utf-8") as f:
    json.dump(qa_pairs, f, indent=2, ensure_ascii=False)
print(f"🗂  {len(qa_pairs)} Q-A pairs written to {out}")
