"""API FastAPI do serviço RAG."""
import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client

from chroma_manager import get_or_create_collection
from document_processor import (
    index_document,
    delete_document_from_chroma,
    compute_file_hash,
)
from config import CHROMA_PERSIST_DIR, COLLECTION_NAME


def get_supabase() -> Optional[Client]:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        return None
    return create_client(url, key)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Inicializa ChromaDB na subida do servidor."""
    CHROMA_PERSIST_DIR.mkdir(parents=True, exist_ok=True)
    get_or_create_collection()
    yield
    # cleanup se necessário
    pass


app = FastAPI(title="RAG Service", lifespan=lifespan)

# CORS: permite o frontend chamar a API (qualquer origem em dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class IndexRequest(BaseModel):
    document_id: str
    file_url: str
    file_name: str
    project_id: str
    file_path: Optional[str] = None  # Para download via Supabase Storage (bucket privado)
    reindex: bool = False


class DeleteRequest(BaseModel):
    document_id: str


class DocumentSectionInput(BaseModel):
    id: str
    title: str
    helpText: Optional[str] = None


class GenerateUnderstandingRequest(BaseModel):
    project_id: str
    document_id: str
    sections: list[DocumentSectionInput]


class GenerateSectionRequest(BaseModel):
    project_id: str
    section_title: str
    help_text: Optional[str] = None
    document_context: Optional[str] = None  # Contexto das outras seções para coerência


class ChatRequest(BaseModel):
    project_id: str
    message: str
    document_id: Optional[str] = None


class HealthResponse(BaseModel):
    chroma_ready: bool
    collection: str
    persist_dir: str


@app.get("/health", response_model=HealthResponse)
def health():
    """Verifica se ChromaDB está configurado e a collection existe."""
    try:
        col = get_or_create_collection()
        return HealthResponse(
            chroma_ready=True,
            collection=COLLECTION_NAME,
            persist_dir=str(CHROMA_PERSIST_DIR),
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.post("/index")
def index(request: IndexRequest):
    """
    Indexa um documento no ChromaDB.
    - Baixa o arquivo via file_url ou Supabase Storage (file_path)
    - Extrai texto, divide em chunks, gera embeddings
    - Valida duplicação por hash (skip se já indexado, exceto reindex=True)
    - Atualiza status no banco relacional
    """
    try:
        if request.reindex:
            delete_document_from_chroma(request.document_id)

        def check_dup(project_id: str, file_hash: str, current_id: str) -> bool:
            if not get_supabase():
                return False
            r = (
                get_supabase()
                .table("project_materials")
                .select("id")
                .eq("project_id", project_id)
                .eq("file_hash", file_hash)
                .neq("id", current_id)
                .execute()
            )
            return bool(r.data and len(r.data) > 0)

        chunk_count, file_hash = index_document(
            document_id=request.document_id,
            file_url=request.file_url,
            file_name=request.file_name,
            project_id=request.project_id,
            file_path=request.file_path,
            check_duplicate=check_dup if not request.reindex else None,
        )

        supabase = get_supabase()
        if supabase:
            supabase.table("project_materials").update(
                {
                    "status": "PROCESSED",
                    "chunk_count": chunk_count,
                    "file_hash": file_hash,
                }
            ).eq("id", request.document_id).execute()

        return {
            "document_id": request.document_id,
            "chunk_count": chunk_count,
            "file_hash": file_hash,
            "status": "processed",
        }
    except Exception as e:
        supabase = get_supabase()
        if supabase:
            try:
                supabase.table("project_materials").update(
                    {"status": "ERROR"}
                ).eq("id", request.document_id).execute()
            except Exception:
                pass
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/delete")
def delete_from_rag(request: DeleteRequest):
    """Remove documento do ChromaDB (e opcionalmente atualiza banco)."""
    try:
        count = delete_document_from_chroma(request.document_id)
        supabase = get_supabase()
        if supabase:
            supabase.table("project_materials").update(
                {"chunk_count": 0, "file_hash": None}
            ).eq("id", request.document_id).execute()
        return {"document_id": request.document_id, "chunks_removed": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/summary")
def get_summary(project_id: str):
    """
    Retorna um resumo do entendimento sobre a documentação da base de dados (RAG).
    Busca chunks do projeto no ChromaDB e gera resumo via Ollama.
    """
    import httpx
    from config import OLLAMA_URL, OLLAMA_SUMMARY_MODEL

    try:
        col = get_or_create_collection()
        # Busca até 30 chunks do projeto no ChromaDB
        results = col.get(
            where={"project_id": {"$eq": project_id}},
            limit=30,
            include=["documents", "metadatas"],
        )
        docs = results.get("documents", [])
        if isinstance(docs, list) and docs and isinstance(docs[0], list):
            docs = docs[0]
        if not docs:
            return {
                "summary": "Ainda não há documentação indexada na base de conhecimento deste projeto. Adicione arquivos (PDF, DOCX, TXT) na aba **Fonte de Dados** para que eu possa analisá-los e ajudá-lo.",
                "sources_count": 0,
            }

        # Concatena chunks (limita tamanho para não sobrecarregar o modelo)
        context = "\n\n---\n\n".join(docs[:20])[:12000]
        prompt = f"""Com base na documentação técnica abaixo, extraída da base de conhecimento do projeto, escreva um resumo objetivo (2 a 4 parágrafos) do entendimento sobre:
- O que o projeto trata
- Principais requisitos, especificações ou conceitos encontrados
- Pontos relevantes para a elaboração de documentos

Documentação:
{context}

Resumo (em português):"""

        with httpx.Client(timeout=90) as client:
            resp = client.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": OLLAMA_SUMMARY_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.3, "num_predict": 800},
                },
            )
            resp.raise_for_status()
            summary = resp.json().get("response", "").strip()

        return {
            "summary": summary or "Não foi possível gerar o resumo. Verifique se o Ollama está rodando e o modelo está disponível.",
            "sources_count": len(docs),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/search")
def search(query: str, project_id: Optional[str] = None, n_results: int = 5):
    """Busca semântica no ChromaDB."""
    try:
        col = get_or_create_collection()
        where = {"project_id": {"$eq": project_id}} if project_id else None
        results = col.query(
            query_texts=[query],
            n_results=n_results,
            where=where,
        )
        return {
            "query": query,
            "documents": results.get("documents", [[]])[0],
            "metadatas": results.get("metadatas", [[]])[0],
            "distances": results.get("distances", [[]])[0],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _get_rag_context(project_id: str, limit: int = 25) -> str:
    """Obtém contexto da base de conhecimento do projeto."""
    col = get_or_create_collection()
    results = col.get(
        where={"project_id": {"$eq": project_id}},
        limit=limit,
        include=["documents"],
    )
    docs = results.get("documents", [])
    if isinstance(docs, list) and docs and isinstance(docs[0], list):
        docs = docs[0]
    if not docs:
        return ""
    return "\n\n---\n\n".join(docs[:20])[:12000]


def _call_ollama(prompt: str, temperature: float = 0.3, num_predict: int = 1200) -> str:
    """Chama Ollama para geração de texto."""
    import httpx
    from config import OLLAMA_URL, OLLAMA_SUMMARY_MODEL
    with httpx.Client(timeout=120) as client:
        resp = client.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": OLLAMA_SUMMARY_MODEL,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": temperature, "num_predict": num_predict},
            },
        )
        resp.raise_for_status()
        return resp.json().get("response", "").strip()


@app.post("/generate-document-understanding")
def generate_document_understanding(request: GenerateUnderstandingRequest):
    """
    Lê o documento (estrutura de seções) e a base de conhecimento do projeto.
    Retorna um resumo do entendimento para o usuário confirmar antes de gerar os parágrafos.
    """
    try:
        rag_context = _get_rag_context(request.project_id)
        sections_desc = "\n".join(
            f"- {s.title}" + (f" ({s.helpText})" if s.helpText else "")
            for s in request.sections
        )
        if not rag_context:
            return {
                "summary": "Não há documentação indexada na base de conhecimento deste projeto. "
                "Adicione arquivos na aba Fonte de Dados para que eu possa gerar conteúdo com base no contexto.",
                "sources_count": 0,
            }
        prompt = f"""Você é um assistente especializado em documentação técnica. Analise a estrutura do documento e a base de conhecimento do projeto.

Estrutura do documento (seções a preencher):
{sections_desc}

Base de conhecimento do projeto:
{rag_context}

Escreva um resumo objetivo (2 a 4 parágrafos) do seu entendimento sobre:
1. O que o projeto trata e qual o contexto geral
2. Como você interpreta cada seção do documento com base na base de conhecimento
3. O que você pretende escrever em cada parágrafo ao gerar o documento

Resumo (em português):"""
        summary = _call_ollama(prompt, temperature=0.3, num_predict=1000)
        col = get_or_create_collection()
        results = col.get(
            where={"project_id": {"$eq": request.project_id}},
            limit=30,
            include=["documents"],
        )
        docs = results.get("documents", [])
        if isinstance(docs, list) and docs and isinstance(docs[0], list):
            docs = docs[0]
        return {
            "summary": summary or "Não foi possível gerar o resumo. Verifique se o Ollama está rodando.",
            "sources_count": len(docs),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/generate-section-content")
def generate_section_content(request: GenerateSectionRequest):
    """
    Gera o conteúdo de um parágrafo/seção com base na base de conhecimento e orientações.
    """
    try:
        col = get_or_create_collection()
        # Busca chunks relevantes para a seção
        query_text = f"{request.section_title} {request.help_text or ''}".strip()
        results = col.query(
            query_texts=[query_text or "documentação do projeto"],
            n_results=8,
            where={"project_id": {"$eq": request.project_id}},
        )
        docs = results.get("documents", [[]])[0]
        rag_context = "\n\n".join(docs[:6])[:8000] if docs else _get_rag_context(request.project_id, limit=15)
        ctx_extra = ""
        if request.document_context:
            ctx_extra = f"\n\nContexto das outras seções do documento (para coerência):\n{request.document_context[:3000]}"
        prompt = f"""Com base na documentação técnica do projeto abaixo, escreva o conteúdo do parágrafo/seção "{request.section_title}".
{f'Orientações específicas: {request.help_text}' if request.help_text else ''}

Documentação do projeto:
{rag_context}
{ctx_extra}

Escreva apenas o conteúdo do parágrafo, em prosa técnica e objetiva, em português. Não inclua título nem marcadores. Apenas o texto do parágrafo:"""
        content = _call_ollama(prompt, temperature=0.4, num_predict=600)
        return {"content": content or ""}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat")
def chat(request: ChatRequest):
    """
    Chat com a IA: entende a mensagem do usuário, busca contexto na base de conhecimento (RAG)
    e responde ou sugere ações. Usa Ollama para geração.
    """
    try:
        col = get_or_create_collection()
        # Busca chunks relevantes à pergunta do usuário
        results = col.query(
            query_texts=[request.message],
            n_results=10,
            where={"project_id": {"$eq": request.project_id}},
        )
        docs = results.get("documents", [[]])[0]
        rag_context = "\n\n".join(docs[:8])[:10000] if docs else _get_rag_context(request.project_id, limit=20)

        if not rag_context:
            rag_context = "Ainda não há documentação indexada na base de conhecimento deste projeto."

        system_instruction = """Você é um assistente especializado em documentação de projetos. 
Responda em português, de forma clara e objetiva.
Use o contexto da base de conhecimento fornecido para responder perguntas.
Se o usuário pedir para gerar, criar ou preencher o documento, informe que pode usar o botão "Gerar tudo com IA" no editor, ou diga que está pronto para ajudar com isso."""

        prompt = f"""{system_instruction}

Base de conhecimento do projeto:
---
{rag_context}
---

Pergunta do usuário: {request.message}

Resposta:"""

        response = _call_ollama(prompt, temperature=0.5, num_predict=1500)

        # Detecta pedidos de geração para sugerir ação ao frontend
        msg_lower = request.message.lower().strip()
        gerar_keywords = ["gere", "gerar", "crie", "criar", "preencha", "preencher", "escreva", "escrever", "produza", "produzir"]
        suggested_action = None
        if any(kw in msg_lower for kw in gerar_keywords) and any(w in msg_lower for w in ["documento", "documentos", "parágrafo", "parágrafos", "seção", "seções"]):
            suggested_action = "generate_document"

        return {
            "response": response or "Não foi possível gerar uma resposta. Verifique se o Ollama está rodando.",
            "suggested_action": suggested_action,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def run():
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


if __name__ == "__main__":
    run()
