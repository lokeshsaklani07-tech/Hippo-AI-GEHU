import os, json, time
from openai import OpenAI
from pathlib import Path

RAW = Path("data/gehu_raw.jsonl")
OUT = Path("data/gehu_augmented.jsonl")
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def paraphrase(q, a):
    prompt = f"""You are an academic writing assistant. Rewrite the following Q&A in three different ways while keeping the meaning identical.

Q: {q}
A: {a}

Give the output as a JSON list of objects, each with keys "question" and "answer"."""
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}],
        temperature=0.7,
    )
    # The model returns a text block that looks like a JSON list – we parse it safely
    txt = resp.choices[0].message.content
    try:
        return json.loads(txt)
    except Exception:
        return []

with OUT.open("w", encoding="utf-8") as fout:
    for line in RAW.read_text(encoding="utf-8").splitlines():
        obj = json.loads(line)
        if obj["type"] != "faq":
            continue
        for pair in paraphrase(obj["question"], obj["answer"]):
            conv = {
                "messages": [
                    {"role":"system","content":"You are a friendly GEHU assistant."},
                    {"role":"user","content":pair["question"]},
                    {"role":"assistant","content":pair["answer"]},
                ]
            }
            fout.write(json.dumps(conv, ensure_ascii=False) + "\n")
        time.sleep(0.2)   # respectful rate-limit
print("✅  Augmented fine-tune file written →", OUT)
