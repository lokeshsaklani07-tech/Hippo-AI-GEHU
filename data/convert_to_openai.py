import json
from pathlib import Path

RAW = Path("data/gehu_raw.jsonl")
OUT = Path("data/gehu_fine_tune.jsonl")

with OUT.open("w", encoding="utf-8") as fout:
    for line in RAW.read_text(encoding="utf-8").splitlines():
        obj = json.loads(line)
        if obj["type"] != "faq":
            continue
        conv = {
            "messages": [
                {"role": "system", "content": "You are a friendly GEHU student-assistant."},
                {"role": "user", "content": obj["question"]},
                {"role": "assistant", "content": obj["answer"]},
            ]
        }
        fout.write(json.dumps(conv, ensure_ascii=False) + "\n")
print(f"✅  OpenAI-ready file → {OUT}")
