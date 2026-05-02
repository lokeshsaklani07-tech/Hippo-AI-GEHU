import json, pathlib, re

ENG = pathlib.Path("data/gehu_raw.jsonl")
HIN = pathlib.Path("data/hinglish_raw")
OUT = pathlib.Path("data/gehu_hinglish_combined.jsonl")

def load_eng():
    """Yield dicts with fields: type='faq', question, answer, source."""
    if not ENG.exists():
        return
    for line in ENG.read_text(encoding="utf-8").splitlines():
        if not line.strip(): continue
        obj = json.loads(line)
        if obj.get("type") == "faq":
            yield {
                "type": "faq",
                "question": obj["question"],
                "answer": obj["answer"],
                "source": obj["source"],
            }

def load_hin():
    """Normalize every Hinglish source into the same keys."""
    # 1️⃣ ICON‑2020 sentiment (TSV)
    icon_path = HIN / "hinglish_sentiment.tsv"
    if icon_path.is_file():
        for line in icon_path.read_text(encoding="utf-8").splitlines()[1:]:
            parts = line.split("\t")
            if len(parts) >= 2:
                text, label = parts[0], parts[1]
                # Turn each tweet into a QA pair (question → “What does this tweet say?”)
                yield {
                    "type": "faq",
                    "question": "What does this tweet mean?",
                    "answer": text,
                    "source": "ICON‑2020 (sentiment)",
                }

    # 2️⃣ CM‑ConvAI dialogue (already JSONL with Q/A)
    for file in HIN.glob("*.jsonl"):
        if "cm-convai" not in file.name.lower():
            continue
        for line in file.read_text(encoding="utf-8").splitlines():
            obj = json.loads(line)
            if "question" in obj and "answer" in obj:
                yield {
                    "type": "faq",
                    "question": obj["question"],
                    "answer": obj["answer"],
                    "source": "CM‑ConvAI",
                }

    # 3️⃣ OpenSubtitles – we keep only lines that contain both Hindi and English scripts
    en_hi_path = HIN / "en-hi.txt"
    if en_hi_path.is_file():
        for line in en_hi_path.read_text(encoding="utf-8").splitlines():
            if re.search(r"[ऀ-ॿ]", line) and re.search(r"[A-Za-z]", line):
                # Split by tab (the OPUS format is “en ||| hi”)
                parts = line.split(" ||| ")
                if len(parts) == 2:
                    # Treat English part as the “question” and Hindi part as “answer”
                    yield {
                        "type": "faq",
                        "question": parts[0],
                        "answer": parts[1],
                        "source": "OpenSubtitles en‑hi",
                    }

    # 4️⃣ Kaggle public Hinglish QA (already Q/A)
    for file in HIN.glob("*student-qa*"):
        for line in file.read_text(encoding="utf-8").splitlines():
            obj = json.loads(line)
            if "question" in obj and "answer" in obj:
                yield {
                    "type": "faq",
                    "question": obj["question"],
                    "answer": obj["answer"],
                    "source": "Kaggle GEHU Hinglish QA",
                }

    # 5️⃣ IndicNLP sentences – turn them into a dummy Q/A (useful for language modeling)
    for line in HIN.glob("indic_corpus.jsonl"):
        for l in line.read_text(encoding="utf-8").splitlines():
            obj = json.loads(l)
            txt = obj.get("text")
            if txt:
                yield {
                    "type": "faq",
                    "question": "Explain the following sentence:",
                    "answer": txt,
                    "source": "IndicNLP Hinglish corpus",
                }

def main():
    with OUT.open("w", encoding="utf-8") as fout:
        # English GEHU FAQs first (they will be the most authoritative)
        for rec in load_eng():
            fout.write(json.dumps(rec, ensure_ascii=False) + "\n")
        # Then the huge Hinglish pool
        for rec in load_hin():
            fout.write(json.dumps(rec, ensure_ascii=False) + "\n")
    print(f"✅  Combined file written → {OUT} ({sum(1 for _ in OUT.open())} rows)")

if __name__ == "__main__":
    main()
