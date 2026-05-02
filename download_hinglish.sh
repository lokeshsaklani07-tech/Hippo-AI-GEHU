#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="data/hinglish_raw"
mkdir -p "$DATA_DIR"

# 1️⃣ ICON‑2020 sentiment (TSV)
wget -O "$DATA_DIR/hinglish_sentiment.tsv" \
  https://raw.githubusercontent.com/google-research-datasets/hinglish_sentiment/main/hinglish_sentiment.tsv

# 2️⃣ CM‑ConvAI dialogue (already JSONL)
git clone https://github.com/anoopkunchala/CM-ConvAI.git
cp CM-ConvAI/data/*.jsonl "$DATA_DIR/"

# 3️⃣ OpenSubtitles en‑hi (gzipped)
wget -O "$DATA_DIR/en-hi.txt.gz" \
  https://object.cloudplus.io/opus/opensubtitles/2024/v2024/en-hi.txt.gz
gzip -d "$DATA_DIR/en-hi.txt.gz"

# 4️⃣ Kaggle public Hinglish QA (requires kaggle CLI)
kaggle datasets download -d gehu/hinglish-student-qa -p "$DATA_DIR"
unzip "$DATA_DIR/hinglish-student-qa.zip" -d "$DATA_DIR"

# 5️⃣ IndicNLP code‑mixed sentences
pip install indicnlp-corpora
python - <<'PY'
import indicnlp_corpora as ic, pathlib, json, os
out = pathlib.Path("data/hinglish_raw/indic_corpus.jsonl")
with out.open("w", encoding="utf-8") as f:
    for sent in ic.load("hinglish"):
        f.write(json.dumps({"type":"sent","text":sent}, ensure_ascii=False) + "\n")
PY

echo "✅  All Hinglish raw files are in $DATA_DIR"
