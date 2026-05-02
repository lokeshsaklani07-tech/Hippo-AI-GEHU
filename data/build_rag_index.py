import os, json, re
from pathlib import Path
from openai import OpenAI
from langchain.text_splitter import RecursiveCharacterTextSplitter
import chromadb
from chromadb.config import Settings

RAW = Path("data/gehu_raw.jsonl")
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# -------------------------------------------------
# 1️⃣ Load records
# -------------------------------------------------
records = [json.loads(l) for l in RAW.read_text(encoding="utf-8").splitlines()]

# -------------------------------------------------
# 2️⃣ Turn each record into one or many searchable chunks
# -------------------------------------------------
splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=100)
chunks = []
for rec in records:
    # FAQ → single chunk
    if rec["type"] == "faq":
        txt = f"Q: {rec['question']}\nA: {rec['answer']}"
        chunks.append({"id": f"faq_{hash(txt)}", "text": txt, "metadata": {"source": rec["source"], "type":"faq"}})

    # Event / Notice → short title‑date chunk
    elif rec["type"] in ("event","notice"):
        txt = f"{rec['type'].title()}: {rec['title']} ({rec.get('date','')})"
        chunks.append({"id": f"{rec['type']}_{hash(txt)}", "text": txt,
                       "metadata": {"source": rec["source"], "type": rec["type"]}})

    # PDF → split the long content
    elif rec["type"] == "pdf":
        parts = splitter.create_documents([rec["content"]])
        for i, part in enumerate(parts):
            chunks.append({
                "id": f"pdf_{hash(rec['label']+str(i))}",
                "text": part.page_content,
                "metadata": {"source": rec["url"], "label": rec["label"], "type":"pdf"}
            })

# -------------------------------------------------
# 3️⃣ Embed & store in Chroma
# -------------------------------------------------
chroma = chromadb.Client(Settings(
    chroma_db_impl="duckdb+parquet",
    persist_directory="./chroma_gehu"
))
col = chroma.get_or_create_collection(name="gehu_knowledge")

for ch in chunks:
    emb = client.embeddings.create(
        input=ch["text"], model="text-embedding-ada-002"
    ).data[0].embedding
    col.add(
        ids=[ch["id"]],
        documents=[ch["text"]],
        embeddings=[emb],
        metadatas=[ch["metadata"]],
    )
print(f"✅  Indexed {len(chunks)} searchable chunks.")
