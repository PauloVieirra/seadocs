"""Gerenciador de vetores RAG via Supabase pgvector."""
import os
from typing import Optional

import httpx
from supabase import create_client, Client

from config import OLLAMA_URL, OLLAMA_EMBED_MODEL

EMBEDDING_DIM = 768  # nomic-embed-text
TABLE_NAME = "rag_documents"


def _get_supabase() -> Optional[Client]:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        return None
    return create_client(url, key)


def _get_ollama_embed_url() -> str:
    """URL do Ollama para embeddings (usa OLLAMA_URL do ambiente)."""
    return f"{OLLAMA_URL}/api/embeddings"


def get_embedding(text: str) -> list[float]:
    """Gera embedding via Ollama. Retorna vetor de dimensão EMBEDDING_DIM."""
    url = _get_ollama_embed_url()
    with httpx.Client(timeout=120) as client:
        resp = client.post(url, json={"model": OLLAMA_EMBED_MODEL, "prompt": text})
        resp.raise_for_status()
        data = resp.json()
    emb = data.get("embedding")
    if not emb or len(emb) != EMBEDDING_DIM:
        raise ValueError(f"Embedding inválido: dimensão esperada {EMBEDDING_DIM}")
    return emb


def add_documents(
    ids: list[str],
    documents: list[str],
    metadatas: list[dict],
) -> None:
    """Insere chunks com embeddings no Supabase."""
    sb = _get_supabase()
    if not sb:
        raise RuntimeError("Supabase não configurado (SUPABASE_URL, SUPABASE_SERVICE_KEY)")

    rows = []
    for i, (chunk_id, content, meta) in enumerate(zip(ids, documents, metadatas)):
        embedding = get_embedding(content)
        rows.append({
            "chunk_id": chunk_id,
            "content": content,
            "embedding": embedding,
            "document_id": meta.get("document_id", ""),
            "project_id": meta.get("project_id", ""),
            "file_name": meta.get("file_name"),
            "source": meta.get("source", "bucket"),
            "metadata": {k: v for k, v in meta.items() if k not in ("document_id", "project_id", "file_name", "source")},
        })

    # Inserir em lotes (Supabase aceita até ~1000 por request)
    batch_size = 50
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        sb.table(TABLE_NAME).upsert(batch, on_conflict="chunk_id").execute()


def get_documents(
    project_id: Optional[str] = None,
    document_id: Optional[str] = None,
    limit: int = 30,
) -> list[str]:
    """Retorna conteúdos dos chunks (sem busca por similaridade)."""
    sb = _get_supabase()
    if not sb:
        return []

    q = sb.table(TABLE_NAME).select("content")
    if project_id:
        q = q.eq("project_id", project_id)
    if document_id:
        q = q.eq("document_id", document_id)
    q = q.limit(limit)
    r = q.execute()
    rows = r.data or []
    return [row["content"] for row in rows if row.get("content")]


def query(
    query_text: str,
    project_id: Optional[str] = None,
    n_results: int = 10,
) -> tuple[list[str], list[dict], list[float]]:
    """
    Busca semântica por similaridade.
    Retorna (documents, metadatas, distances).
    """
    sb = _get_supabase()
    if not sb:
        return [], [], []

    embedding = get_embedding(query_text)

    r = sb.rpc(
        "rag_match_documents",
        {"query_embedding": embedding, "match_project_id": project_id, "match_count": n_results},
    ).execute()

    if not r.data:
        return [], [], []

    docs = [row["content"] for row in r.data]
    metas = [row.get("metadata", {}) for row in r.data]
    dists = [float(row.get("distance", 0)) for row in r.data]
    return docs, metas, dists


def delete_by_document_id(document_id: str) -> int:
    """Remove todos os chunks de um documento. Retorna quantidade removida."""
    sb = _get_supabase()
    if not sb:
        return 0

    r = sb.table(TABLE_NAME).delete().eq("document_id", document_id).execute()
    return len(r.data) if r.data else 0


def clear_all() -> None:
    """Remove todos os chunks da tabela."""
    sb = _get_supabase()
    if not sb:
        return
    sb.rpc("rag_clear_all").execute()
