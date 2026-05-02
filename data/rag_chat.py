import os, json
from openai import OpenAI
import chromadb
from chromadb.config import Settings

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
chroma = chromadb.Client(Settings(
    chroma_db_impl="duckdb+parquet",
    persist_directory="./chroma_gehu"
))
col = chroma.get_collection(name="gehu_knowledge")

def ask_gehu(question: str, top_k: int = 4):
    # 1️⃣ Embed the user question
    q_emb = client.embeddings.create(
        input=question, model="text-embedding-ada-002"
    ).data[0].embedding

    # 2️⃣ Retrieve relevant chunks
    res = col.query(
        query_embeddings=[q_emb],
        n_results=top_k,
        include=["documents", "metadatas"]
    )
    context = "\n\n".join(res["documents"][0])

    # 3️⃣ Prompt the LLM with the context + the user query
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role":"system","content":"You are a helpful GEHU student-assistant. Use ONLY the provided context; do NOT make up information."},
            {"role":"user","content":f"Context:\n{context}\n\nQuestion: {question}"}
        ],
        temperature=0.1,
    )
    return resp.choices[0].message.content

# ---- Demo -------------------------------------------------
if __name__ == "__main__":
    print(ask_gehu("What scholarships are available for female students?"))
