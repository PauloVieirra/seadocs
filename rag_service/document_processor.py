"""Processamento de documentos: extração de texto, chunking e indexação."""
import hashlib
import io
import os
import re
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


def _split_into_sentences(paragraph: str) -> list[str]:
    """Divide um parágrafo em sentenças (evita cortar no meio de frases)."""
    # Quebra por pontuação final (. ! ?) seguida de espaço ou fim
    parts = re.split(r'(?<=[.!?])\s+', paragraph.strip())
    return [p.strip() for p in parts if p.strip()]


def chunk_text(text: str) -> list[str]:
    """
    Divide o texto em chunks respeitando limites semânticos:
    - Prioriza parágrafos (\\n\\n) para não cortar no meio
    - Se parágrafo > CHUNK_SIZE, divide por sentenças
    - Mantém overlap entre chunks para preservar contexto
    """
    if not text or not text.strip():
        return []
    text = text.strip()
    max_chars = CHUNK_SIZE
    overlap_chars = CHUNK_OVERLAP

    # 1. Divide por parágrafos (dupla quebra de linha)
    paragraphs = [p.strip() for p in re.split(r'\n\s*\n', text) if p.strip()]
    chunks: list[str] = []
    current: list[str] = []
    current_len = 0

    for para in paragraphs:
        para_len = len(para) + 2  # +2 para \n\n
        if para_len > max_chars:
            # Parágrafo muito longo: divide por sentenças
            sentences = _split_into_sentences(para)
            for sent in sentences:
                sent_len = len(sent) + 1
                if len(sent) > max_chars:
                    # Sentença isolada maior que chunk: flush e adiciona como chunk único
                    if current:
                        chunks.append("\n\n".join(current))
                        current, current_len = [], 0
                    chunks.append(sent)
                    continue
                if current_len + sent_len > max_chars and current:
                    chunk = "\n\n".join(current)
                    chunks.append(chunk)
                    overlap_remaining = overlap_chars
                    new_current: list[str] = []
                    for s in reversed(current):
                        if len(s) + 2 <= overlap_remaining:
                            new_current.insert(0, s)
                            overlap_remaining -= len(s) + 2
                        else:
                            break
                    current = new_current
                    current_len = sum(len(s) + 2 for s in current) - 2 if current else 0
                current.append(sent)
                current_len += sent_len
        else:
            if current_len + para_len > max_chars and current:
                chunk = "\n\n".join(current)
                chunks.append(chunk)
                overlap_remaining = overlap_chars
                new_current = []
                for p in reversed(current):
                    if len(p) + 2 <= overlap_remaining:
                        new_current.insert(0, p)
                        overlap_remaining -= len(p) + 2
                    else:
                        break
                current = new_current
                current_len = sum(len(p) + 2 for p in current) - 2 if current else 0
            current.append(para)
            current_len += para_len

    if current:
        chunks.append("\n\n".join(current))
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


def strip_html(html: str) -> str:
    """Remove tags HTML e retorna texto puro."""
    if not html or not html.strip():
        return ""
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def index_positive_feedback(
    document_id: str,
    project_id: str,
    sections: list[dict],
) -> int:
    """
    Indexa seções de um documento avaliado como 'bom' no ChromaDB.
    Usado para refinar gerações futuras com exemplos de boa qualidade.
    Retorna quantidade de chunks adicionados.
    """
    collection = get_or_create_collection()
    # Remove feedback anterior deste documento (se houver)
    fid = f"feedback_{document_id}"
    existing = collection.get(where={"document_id": {"$eq": fid}}, include=[])
    if existing and existing.get("ids"):
        collection.delete(ids=existing["ids"])

    all_chunks: list[str] = []
    all_ids: list[str] = []
    all_metadatas: list[dict] = []
    created_at = datetime.utcnow().isoformat() + "Z"

    for sec in sections:
        title = sec.get("title") or "Seção"
        content = sec.get("content") or ""
        text = strip_html(content)
        if not text.strip():
            continue
        chunks = chunk_text(text)
        for i, ch in enumerate(chunks):
            all_chunks.append(ch)
            all_ids.append(f"{fid}_chunk_{len(all_ids)}")
            all_metadatas.append({
                "document_id": fid,
                "project_id": project_id,
                "source": "positive_feedback",
                "section_title": title,
                "created_at": created_at,
            })

    if all_chunks:
        collection.add(ids=all_ids, documents=all_chunks, metadatas=all_metadatas)
    return len(all_chunks)


def delete_positive_feedback(document_id: str) -> int:
    """Remove chunks de feedback positivo de um documento. Retorna quantidade removida."""
    collection = get_or_create_collection()
    fid = f"feedback_{document_id}"
    results = collection.get(where={"document_id": {"$eq": fid}}, include=[])
    ids = results.get("ids", []) if results else []
    if ids:
        collection.delete(ids=ids)
    return len(ids)


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
