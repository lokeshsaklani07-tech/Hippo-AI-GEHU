import os
from openai import OpenAI
import chromadb
from chromadb.config import Settings

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
chroma = chromadb.Client(Settings(
    chroma_db_impl="duckdb+parquet",
    persist_directory="./chroma_gehu_hinglish"
))
col = chroma.get_collection(name="gehu_hinglish_knowledge")

def ask(question: str, k: int = 4):
    # 1️⃣ embed the query (any language)
    q_emb = client.embeddings.create(
        input=question, model="text-embedding-ada-002"
    ).data[0].embedding

    # 2️⃣ retrieve top‑k relevant chunks
    res = col.query(
        query_embeddings=[q_emb],
        n_results=k,
        include=["documents", "metadatas"]
    )
    context = "\n\n".join(res["documents"][0])

    # 3️⃣ LLM call – we force the assistant to answer *in the language used by the user*
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role":"system","content":"You are a friendly GEHU assistant. Answer in the same language (Hindi/English mix) the user used. Use only the provided context; do NOT hallucinate."},
            {"role":"user","content":f"Context:\n{context}\n\nQuestion: {question}"}
        ],
        temperature=0.1,
    )
    return resp.choices[0].message.content

# ---- Demo -------------------------------------------------
if __name__ == "__main__":
    print("--- Hinglish Bot Demo ---")
    print("\nQ: Bhai, scholarship ke options kya hain?")
    print("A:", ask("Bhai, scholarship ke options kya hain?"))
    print("\nQ: What are the hostel fees for 2025-2026?")
    print("A:", ask("What are the hostel fees for 2025-2026?"))
