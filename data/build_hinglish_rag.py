import os, json, pathlib
from openai import OpenAI
from langchain.text_splitter import RecursiveCharacterTextSplitter
import chromadb
from chromadb.config import Settings

IN   = pathlib.Path("data/gehu_hinglish_combined.jsonl")
OUT  = pathlib.Path("./chroma_gehu_hinglish")
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

if not IN.exists():
    print(f"File {IN} does not exist. Run merge_hinglish.py first.")
    exit(1)

# -------------------------------------------------
# Load & chunk
# -------------------------------------------------
records = [json.loads(l) for l in IN.read_text(encoding="utf-8").splitlines() if l.strip()]
splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=150)

chunks = []
for r in records:
    txt = f"Q: {r['question']}\nA: {r['answer']}"
    parts = splitter.create_documents([txt])
    for i, p in enumerate(parts):
        chunks.append({
            "id": f"{hash(txt+str(i))}",
            "text": p.page_content,
            "metadata": {"source": r["source"], "type": r["type"]},
        })

# -------------------------------------------------
# Embed & store
# -------------------------------------------------
chroma = chromadb.Client(Settings(
    chroma_db_impl="duckdb+parquet",
    persist_directory=str(OUT)
))
col = chroma.get_or_create_collection(name="gehu_hinglish_knowledge")

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
print(f"✅  Indexed {len(chunks)} Hinglish+English chunks.")
