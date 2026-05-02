import os, json, time
from pathlib import Path
from openai import OpenAI

IN  = Path("data/gehu_raw.jsonl")
OUT = Path("data/gehu_hinglish_augmented.jsonl")
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def make_prompt(q, a):
    return f"""Rewrite the following Q&A in three different Hinglish styles (mix Hindi & English, keep the meaning, use casual campus slang like "bhai", "yaar", "kaise ho?").

Q: {q}
A: {a}

Give the answer as a JSON list, each element having keys "question" and "answer"."""
    
def call_llm(prompt):
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}],
        temperature=0.7,
        max_tokens=500
    )
    txt = resp.choices[0].message.content
    # The model usually returns a well‑formed JSON list; we try to parse it.
    try:
        # try to extract json block if wrapped in markdown
        if txt.startswith("```json"):
            txt = txt.split("```json")[1].split("```")[0].strip()
        elif txt.startswith("```"):
            txt = txt.split("```")[1].split("```")[0].strip()
        return json.loads(txt)
    except Exception as e:
        print("⚠️  parsing error →", e)
        return []

if not IN.exists():
    print(f"File {IN} does not exist. Please run scrape_gehu.py first.")
    exit(1)

with OUT.open("w", encoding="utf-8") as fout:
    for line in IN.read_text(encoding="utf-8").splitlines():
        if not line.strip(): continue
        rec = json.loads(line)
        if rec["type"] != "faq":
            continue
        # Ask the LLM for three Hinglish variants
        variants = call_llm(make_prompt(rec["question"], rec["answer"]))
        for var in variants:
            out_rec = {
                "type": "faq",
                "question": var["question"],
                "answer": var["answer"],
                "source": "Synthetic Hinglish (LLM)",
                "generated_from": rec["question"]
            }
            fout.write(json.dumps(out_rec, ensure_ascii=False) + "\n")
        # Be nice to the API
        time.sleep(0.2)

print("✅  Augmented file →", OUT)
