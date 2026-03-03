"""Processamento de documentos: extração de texto, chunking e indexação."""
import hashlib
import io
import os
from datetime import datetime
from typing import Callable, Optional

import httpx
from pypdf import PdfReader
from docx import Document as DocxDocument

from chroma_manager import get_or_create_collection
from config import CHUNK_SIZE, CHUNK_OVERLAP


def compute_file_hash(content: bytes) -> str:
    """Calcula hash SHA256 do conteúdo para evitar duplicação."""
    return hashlib.sha256(content).hexdigest()


def download_file(file_url: str, file_path: Optional[str] = None) -> bytes:
    """
    Baixa o arquivo. Se file_path e Supabase configurado, usa Storage API.
    Caso contrário, baixa via HTTP da file_url.
    """
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
    if file_path and supabase_url and supabase_key:
        from supabase import create_client
        client = create_client(supabase_url, supabase_key)
        data = client.storage.from_("Documentos").download(file_path)
        return data
    with httpx.Client(timeout=60) as client:
        resp = client.get(file_url)
        resp.raise_for_status()
        return resp.content


def extract_text_from_bytes(content: bytes, file_name: str) -> str:
    """Extrai texto do conteúdo conforme extensão."""
    ext = (file_name.split(".")[-1] or "").lower()
    if ext == "txt":
        return content.decode("utf-8", errors="replace")
    if ext == "pdf":
        reader = PdfReader(io.BytesIO(content))
        return "\n".join(p.extract_text() or "" for p in reader.pages)
    if ext in ("docx", "doc"):
        doc = DocxDocument(io.BytesIO(content))
        return "\n".join(p.text for p in doc.paragraphs)
    raise ValueError(f"Formato não suportado: {ext}")


def chunk_text(text: str) -> list[str]:
    """Divide o texto em chunks com sobreposição."""
    if not text or not text.strip():
        return []
    text = text.strip()
    words = text.split()
    chunks = []
    words_per_chunk = max(1, CHUNK_SIZE // 4)
    overlap_words = max(0, CHUNK_OVERLAP // 4)
    i = 0
    while i < len(words):
        end = min(i + words_per_chunk, len(words))
        chunk = " ".join(words[i:end])
        chunks.append(chunk)
        if end >= len(words):
            break
        i += max(1, words_per_chunk - overlap_words)
    return chunks


def index_document(
    document_id: str,
    file_url: str,
    file_name: str,
    project_id: str,
    file_path: Optional[str] = None,
    file_hash: Optional[str] = None,
    check_duplicate: Optional[Callable[[str, str, str], bool]] = None,
) -> tuple[int, str]:
    """
    Baixa o documento (via URL ou Supabase Storage), extrai texto, gera chunks,
    embeddings e insere no ChromaDB. Retorna (chunk_count, file_hash).
    Se check_duplicate(project_id, hash, document_id) retornar True, pula inserção.
    """
    content = download_file(file_url, file_path)
    hash_value = file_hash or compute_file_hash(content)
    if check_duplicate and check_duplicate(project_id, hash_value, document_id):
        return 0, hash_value
    text = extract_text_from_bytes(content, file_name)
    chunks = chunk_text(text)
    if not chunks:
        return 0, hash_value

    collection = get_or_create_collection()
    created_at = datetime.utcnow().isoformat() + "Z"
    ids = [f"{document_id}_chunk_{i}" for i in range(len(chunks))]
    metadatas = [
        {
            "document_id": document_id,
            "file_url": file_url,
            "file_name": file_name,
            "source": "bucket",
            "created_at": created_at,
            "project_id": project_id,
        }
        for _ in chunks
    ]
    collection.add(
        ids=ids,
        documents=chunks,
        metadatas=metadatas,
    )
    return len(chunks), hash_value


def delete_document_from_chroma(document_id: str) -> int:
    """Remove todos os chunks de um documento do ChromaDB. Retorna quantidade removida."""
    collection = get_or_create_collection()
    # ChromaDB: where usa $eq para igualdade
    results = collection.get(
        where={"document_id": {"$eq": document_id}},
        include=[],
    )
    ids_to_delete = results.get("ids", []) if results else []
    if ids_to_delete:
        collection.delete(ids=ids_to_delete)
    return len(ids_to_delete)
