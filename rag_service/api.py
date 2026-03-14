"""API FastAPI do serviço RAG."""
import os
from contextlib import asynccontextmanager
from pathlib import Path
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

# Diretório de modelos de exemplo (relativo à raiz do projeto)
MODELOS_DIR = Path(__file__).parent.parent / "public" / "modelos"
# Arquivo central de regras constitucionais
REGRAS_PATH = Path(__file__).parent.parent / "Spec" / "REGRAS_CONSTITUCIONAIS.md"

# Fallback se o arquivo não existir (ex.: deploy sem Spec/)
_CONSTITUTIONAL_RULES_FALLBACK = (
    "REGRAS OBRIGATÓRIAS (violação invalida o documento):\n"
    "1. NÃO transcreva, cite ou reproduza trechos literais dos documentos da base. Sintetize.\n"
    "2. NÃO replique partes de conversas extraídas da base (chats, mensagens, diálogos). "
    "INTERPRETE a conversa e crie texto formal que represente o que precisa ser feito — nunca copie diálogos literais.\n"
    "3. NÃO inclua raciocínio, explicações de processo ou planos de ação da IA no texto gerado.\n"
    "   Proibido: frases como 'Vou estruturar...', 'Analisando os dados...', 'Passo 1:...'.\n"
    "4. NÃO mencione nomes de pessoas físicas (autores, participantes, responsáveis, stakeholders).\n"
    "   Use papéis genéricos: [Responsável], [Gestor do Projeto], [Equipe Técnica].\n"
    "5. O documento deve conter APENAS o conteúdo final esperado para a seção.\n"
    "6. O Spec é APENAS regras de estrutura/formato. NUNCA copie, cite ou inclua texto do Spec no documento. "
    "O conteúdo vem SOMENTE dos dados do projeto (base de conhecimento)."
)


def _load_constitutional_rules() -> str:
    """Carrega regras constitucionais de Spec/REGRAS_CONSTITUCIONAIS.md."""
    if not REGRAS_PATH.exists():
        return _CONSTITUTIONAL_RULES_FALLBACK
    try:
        text = REGRAS_PATH.read_text(encoding="utf-8")
        for part in text.split("```"):
            if part.strip().startswith("REGRAS OBRIGATÓRIAS"):
                return part.strip()
        return _CONSTITUTIONAL_RULES_FALLBACK
    except Exception:
        return _CONSTITUTIONAL_RULES_FALLBACK


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
    repeatable: bool = False
    planningInstruction: Optional[str] = None


class GenerateUnderstandingRequest(BaseModel):
    project_id: str
    document_id: str
    sections: list[DocumentSectionInput]


class GenerateSectionRequest(BaseModel):
    project_id: str
    section_title: str
    help_text: Optional[str] = None
    document_context: Optional[str] = None  # Contexto textual das seções anteriores (legado)
    previous_sections_html: Optional[str] = None  # HTML completo das seções já geradas (partes do mesmo documento)
    section_index: Optional[int] = None  # Índice desta seção (0-based)
    total_sections: Optional[int] = None  # Total de seções do documento
    spec_guidelines: Optional[str] = None  # Diretrizes do documento Spec associado ao modelo


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


def _get_rag_context(project_id: str, limit: int = 15) -> str:
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
    return "\n\n---\n\n".join(docs[:10])[:6000]


def _call_ollama(prompt: str, temperature: float = 0.3, num_predict: int = 800, timeout: int = 240) -> str:
    """Chama Ollama para geração de texto."""
    import httpx
    from config import OLLAMA_URL, OLLAMA_SUMMARY_MODEL
    with httpx.Client(timeout=timeout) as client:
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
    Gera o conteúdo HTML de uma seção com base na base de conhecimento e no Spec do modelo.
    """
    try:
        col = get_or_create_collection()
        query_text = f"{request.section_title} {request.help_text or ''}".strip()
        results = col.query(
            query_texts=[query_text or "documentação do projeto"],
            n_results=8,
            where={"project_id": {"$eq": request.project_id}},
        )
        docs = results.get("documents", [[]])[0]
        # Limita contexto RAG a 3000 chars para não inflar o prompt além do que phi3 aguenta
        rag_context = "\n\n".join(docs[:4])[:3000] if docs else _get_rag_context(request.project_id, limit=8)[:3000]

        # Contexto das seções anteriores: prioriza HTML completo (partes do mesmo documento)
        # para que a IA entenda que NÃO deve repetir introduções, objetivos, visão geral etc.
        section_pos = ""
        if request.section_index is not None and request.total_sections is not None and request.total_sections > 0:
            section_pos = f"\nEsta é a seção {request.section_index + 1} de {request.total_sections} de UM ÚNICO DOCUMENTO."

        ctx_prev = ""
        if request.previous_sections_html and request.previous_sections_html.strip():
            ctx_prev = f"""
SEÇÕES JÁ ESCRITAS DESTE MESMO DOCUMENTO (não repita introduções, objetivos, visão geral ou contexto):
---
{request.previous_sections_html[:6000]}
---
IMPORTANTE: As seções acima fazem parte do MESMO documento. Sua seção é uma CONTINUAÇÃO. NÃO repita o que já foi escrito.
"""
        elif request.document_context:
            ctx_prev = f"\nSeções anteriores (não repita):\n{request.document_context[:800]}\n"

        # Regras constitucionais: Spec/REGRAS_CONSTITUCIONAIS.md (fonte única)
        constitutional_rules = _load_constitutional_rules()

        part_instruction = """CONTEXTO CRÍTICO: Você está gerando UMA PARTE de um documento maior, não um documento independente.
- NÃO inclua introduções, objetivos, visão geral ou contexto que já aparecem em seções anteriores.
- NÃO repita cabeçalhos de documento, apresentações ou resumos executivos.
- Escreva APENAS o conteúdo específico desta seção, como continuação natural do documento."""

        if request.spec_guidelines:
            spec_excerpt = request.spec_guidelines[:2500]
            prompt = f"""Você é um redator técnico. Gere o conteúdo HTML da seção "{request.section_title}" de um documento.{section_pos}
{f'Orientação: {request.help_text}' if request.help_text else ''}

{part_instruction}

REGRA CRÍTICA — O SPEC ABAIXO É APENAS PARA ESTRUTURA:
O Spec contém SOMENTE regras de formatação e organização (ex.: usar EP01, FT02, tabelas, etc.).
O Spec NÃO é fonte de conteúdo. É PROIBIDO copiar, citar ou incluir QUALQUER texto do Spec no documento.
O documento deve conter APENAS informações extraídas dos DADOS DO PROJETO (base de conhecimento).
Se o Spec mencionar exemplos, títulos ou descrições, eles são APENAS ilustrações — NÃO os use no texto gerado.

REGRAS DE ESTRUTURA (extraia só a forma, ignore o texto como conteúdo):
---
{spec_excerpt}
---

DADOS DO PROJETO (fonte ÚNICA de conteúdo):
{rag_context}
{ctx_prev}
{constitutional_rules}
SAÍDA: apenas HTML válido DESTA SEÇÃO (sem <html>, <head>, <body>). Use <h2>, <h3>, <p>, <strong>, <ul>, <li>, <table>. Sem comentários da IA.

HTML:"""
        else:
            prompt = f"""Você é um redator técnico. Gere o conteúdo HTML da seção "{request.section_title}" em português formal.{section_pos}
{f'Orientação: {request.help_text}' if request.help_text else ''}

{part_instruction}

DADOS DO PROJETO:
{rag_context}
{ctx_prev}
{constitutional_rules}
SAÍDA: apenas HTML válido DESTA SEÇÃO (sem <html>, <head>, <body>). Use <p>, <strong>, <ul>, <li>. Sem comentários da IA.

HTML:"""

        content = _call_ollama(prompt, temperature=0.3, num_predict=800, timeout=240)
        return {"content": content or ""}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/chat")
def chat(request: ChatRequest):
    """
    Chat com a IA: entende a mensagem do usuário, busca contexto na base de conhecimento (RAG)
    e responde ou sugere ações. Quando document_id é informado, o prompt prioriza o documento em edição.
    """
    try:
        col = get_or_create_collection()
        where_project = {"project_id": {"$eq": request.project_id}}
        results = col.query(
            query_texts=[request.message],
            n_results=10,
            where=where_project,
        )
        docs = results.get("documents", [[]])[0]
        rag_context = "\n\n".join(docs[:8])[:10000] if docs else _get_rag_context(request.project_id, limit=20)

        if not rag_context:
            rag_context = "Ainda não há documentação indexada na base de conhecimento deste projeto."

        if request.document_id:
            system_instruction = """Você é um assistente especializado em documentação de projetos.
Responda em português, de forma clara e objetiva.
O usuário está editando um documento. Use o contexto da base de conhecimento para responder perguntas sobre esse documento e o projeto.
Se o usuário pedir para gerar ou preencher o documento, sugira o botão "Gerar tudo com IA" no editor."""
        else:
            system_instruction = """Você é um assistente especializado em documentação de projetos.
Responda em português, de forma clara e objetiva.
O contexto abaixo é da base de conhecimento do projeto como um todo. Use-o para responder perguntas sobre o projeto.
Se o usuário pedir para criar um novo documento, sugira usar o botão "Novo Documento"."""

        prompt = f"""{system_instruction}

Base de conhecimento:
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
            "response": response or "Não foi possível gerar uma resposta. Verifique se o Claude (ANTHROPIC_API_KEY) ou Ollama está configurado.",
            "suggested_action": suggested_action,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class PlanDocumentRequest(BaseModel):
    project_id: str
    sections: list[DocumentSectionInput]


@app.post("/plan-document-structure")
def plan_document_structure(request: PlanDocumentRequest):
    """
    Fase de planejamento da geração de documentos com seções repetíveis.

    Para cada seção marcada como 'repeatable', consulta a base de conhecimento do projeto
    e identifica quantas instâncias são necessárias (ex: quantos épicos, features, histórias).

    Retorna uma lista expandida e ordenada de seções prontas para geração, mantendo
    a ordem do template e substituindo cada seção repetível pelas suas instâncias concretas.
    """
    rag_context = _get_rag_context(request.project_id, limit=20)
    repeatable = [s for s in request.sections if s.repeatable]

    # Sem seções repetíveis ou sem RAG → retorna o template como está
    if not repeatable or not rag_context:
        return {
            "planned_sections": [
                {
                    "id": s.id,
                    "title": s.title,
                    "helpText": s.helpText or f'Conteúdo de "{s.title}"',
                    "templateSectionId": s.id,
                }
                for s in request.sections
            ]
        }

    # Monta prompt para o LLM identificar instâncias de cada seção repetível
    categories_desc = "\n".join(
        f'[{s.id}] {s.title}: {s.planningInstruction or "Identifique todos os itens deste tipo encontrados no projeto"}'
        for s in repeatable
    )

    prompt = f"""Você é um analista de requisitos. Analise a documentação do projeto abaixo e identifique todos os elementos de cada categoria.

Documentação do projeto:
{rag_context[:4000]}

Categorias a identificar:
{categories_desc}

Para cada categoria, liste os títulos específicos encontrados no projeto.
Use EXATAMENTE o formato abaixo, uma linha por item encontrado:
[id_categoria]: Título específico do item

Exemplo:
[epic-0]: Autenticação e Controle de Acesso
[epic-0]: Gestão Documental
[feature-1]: Login com Gov.br
[feature-1]: Upload e Versionamento de Documentos
[story-2]: Como usuário, quero me autenticar via Gov.br para acessar o sistema

Lista completa:"""

    try:
        response = _call_ollama(prompt, temperature=0.1, num_predict=1500, timeout=240)
    except Exception:
        response = ""

    # Faz parse das linhas de resposta
    instances_map: dict[str, list[str]] = {s.id: [] for s in repeatable}
    for line in response.splitlines():
        line = line.strip()
        if not line or not line.startswith("["):
            continue
        try:
            bracket_end = line.index("]:")
            sec_id = line[1:bracket_end].strip()
            title = line[bracket_end + 2:].strip()
            if sec_id in instances_map and title:
                instances_map[sec_id].append(title)
        except ValueError:
            continue

    # Fallback: se o LLM não retornou nada para uma seção, mantém uma instância
    for s in repeatable:
        if not instances_map[s.id]:
            instances_map[s.id] = [s.title]

    # Expande o template mantendo a ordem original
    planned: list[dict] = []
    for s in request.sections:
        if not s.repeatable:
            planned.append({
                "id": s.id,
                "title": s.title,
                "helpText": s.helpText or f'Conteúdo de "{s.title}"',
                "templateSectionId": s.id,
            })
        else:
            for i, instance_title in enumerate(instances_map[s.id][:30]):  # cap 30 instâncias
                planned.append({
                    "id": f"{s.id}-inst-{i}",
                    "title": instance_title,
                    "helpText": f'{s.helpText or s.title}: {instance_title}',
                    "templateSectionId": s.id,
                })

    return {"planned_sections": planned}


class AnalyzeTemplateRequest(BaseModel):
    file_name: str


@app.get("/list-template-examples")
def list_template_examples():
    """Lista arquivos DOCX disponíveis em public/modelos/ para geração automática de modelos."""
    if not MODELOS_DIR.exists():
        return {"files": []}
    files = sorted(f.name for f in MODELOS_DIR.glob("*.docx"))
    return {"files": files}


def _rgb_to_hex(rgb_color) -> Optional[str]:
    try:
        if rgb_color is None:
            return None
        return f"#{rgb_color.red:02X}{rgb_color.green:02X}{rgb_color.blue:02X}"
    except Exception:
        return None


def _pt(length) -> Optional[float]:
    try:
        if length is None:
            return None
        return round(length.pt, 1)
    except Exception:
        return None


def _align_css(alignment) -> str:
    try:
        from docx.enum.text import WD_ALIGN_PARAGRAPH
        if alignment == WD_ALIGN_PARAGRAPH.CENTER:
            return "center"
        if alignment == WD_ALIGN_PARAGRAPH.RIGHT:
            return "right"
        if alignment == WD_ALIGN_PARAGRAPH.JUSTIFY:
            return "justify"
    except Exception:
        pass
    return "left"


def _heading_styles(para) -> str:
    """Extrai estilos inline de um parágrafo heading (cor, tamanho, fonte, alinhamento)."""
    styles = []
    align = _align_css(para.alignment)
    if align != "left":
        styles.append(f"text-align:{align}")
    # Pega formatação do primeiro run não-vazio
    for run in para.runs:
        if not run.text.strip():
            continue
        color = _rgb_to_hex(run.font.color.rgb if run.font.color and run.font.color.type else None)
        if color and color.upper() != "#000000":
            styles.append(f"color:{color}")
        size = _pt(run.font.size)
        if size:
            styles.append(f"font-size:{int(size)}pt")
        if run.font.name:
            styles.append(f"font-family:'{run.font.name}'")
        break
    return ";".join(styles)


def _classify_para(para) -> tuple[bool, str, str]:
    """
    Classifica o parágrafo e retorna (é_heading, tag_html, texto_limpo).

    Detecta cabeçalhos de seção em qualquer tipo de documento, independente de estilo formal:
      1. Estilos de Heading (Word/LibreOffice): Heading 1-4, Título, Title
      2. Texto curto todo em maiúsculas (ex: "OBJETO DO CONTRATO")
      3. Parágrafo curto inteiramente em negrito, sem ponto final (ex: "Participantes")
      4. Prefixo numerado arábico com texto curto (ex: "1. Abertura", "2.1 Pauta")
      5. Prefixo numerado romano (ex: "I – Das Disposições", "II. Objeto")
      6. Prefixo de letra maiúscula (ex: "A – Fatos", "B) Direito")
      7. Palavras-chave de cabeçalho típicas de documentos normativos/jurídicos/administrativos
         (ex: "CLÁUSULA", "ARTIGO", "CONSIDERANDO", "DELIBERAÇÃO", "RESOLVE:")

    Parágrafos de corpo NÃO são headings — seu conteúdo não será copiado no template.
    """
    import re

    style_name = (para.style.name or "") if para.style else ""
    text = para.text.strip()

    if not text:
        return False, "p", ""

    # ── 1. Estilo formal de Heading ──────────────────────────────────────────
    heading_tags = {
        "Heading 1": "h1", "Título 1": "h1", "Title": "h1", "Título": "h1",
        "Heading 2": "h2", "Título 2": "h2",
        "Heading 3": "h3", "Título 3": "h3",
        "Heading 4": "h4", "Título 4": "h4",
    }
    tag = next((v for k, v in heading_tags.items() if k in style_name), "p")
    if tag != "p":
        return True, tag, text

    # Limite de tamanho: títulos raramente têm mais de 160 caracteres
    if len(text) > 160:
        return False, "p", text

    # ── 2. Texto curto todo em maiúsculas ────────────────────────────────────
    if text.isupper() and len(text) >= 3:
        return True, "h3", text

    # ── 3. Parágrafo inteiramente em negrito e curto (sem ponto final de frase)
    runs_text = "".join(r.text for r in para.runs if r.text.strip())
    all_bold = bool(runs_text) and all(
        r.bold for r in para.runs if r.text.strip()
    )
    if all_bold and len(text) < 120 and not text.endswith("."):
        return True, "h3", text

    # ── 4. Prefixo numérico arábico (1., 2., 1.1, 2.3.1 …) ──────────────────
    if re.match(r"^\d+(\.\d+)*\.?\s+\S", text) and len(text) < 120:
        return True, "h3", text

    # ── 5. Prefixo romano (I –, II., III) ────────────────────────────────────
    if re.match(r"^(I{1,3}|IV|V|VI{0,3}|IX|X{1,3})\s*[\.\-–—]\s*\S", text, re.IGNORECASE) and len(text) < 120:
        return True, "h3", text

    # ── 6. Prefixo letra maiúscula (A –, B), C. …) ───────────────────────────
    if re.match(r"^[A-Z]\s*[\.\-–—\)]\s*\S", text) and len(text) < 120:
        return True, "h3", text

    # ── 7. Palavras-chave de cabeçalho normativo/jurídico/administrativo ─────
    normative_keywords = [
        r"^cláusula\s+\w", r"^artigo\s+\d", r"^art\.\s*\d",
        r"^parágrafo\s+\w", r"^§\s*\d",
        r"^considerando\b", r"^resolve\s*:", r"^delibera\s*:",
        r"^decreta\s*:", r"^portaria\b", r"^resolução\b",
        r"^ementa\s*:", r"^objeto\s*:", r"^vigência\s*:",
        r"^das?\s+disposiç", r"^das?\s+obrigaç",
        r"^seção\s+\w", r"^capítulo\s+\w",
    ]
    lower = text.lower()
    for kw in normative_keywords:
        if re.match(kw, lower):
            return True, "h3", text

    return False, "p", text


def _unique_cells(row):
    """Retorna células únicas de uma linha (descarta repetições de mesclagem)."""
    seen = set()
    result = []
    for cell in row.cells:
        cid = id(cell._tc)
        if cid not in seen:
            seen.add(cid)
            result.append(cell)
    return result


def _table_to_html(table) -> str:
    """
    Converte tabela docx em HTML preservando estrutura (linhas × colunas + estilo de borda).

    Regra de conteúdo:
    - Primeira linha: considerada cabeçalho estrutural → mantém o TEXTO (é um rótulo,
      não um dado). Ex: "Nome", "Data", "Responsável" são parte do layout da tabela.
    - Demais linhas: células ficam vazias — o conteúdo será gerado pela IA no projeto.
    """
    rows = table.rows
    if not rows:
        return ""

    rows_html = ""
    for row_idx, row in enumerate(rows):
        cells = _unique_cells(row)
        cells_html = ""
        td_style = "border:1px solid #ccc;padding:6px 10px;vertical-align:top"

        for col_idx, cell in enumerate(cells):
            if row_idx == 0:
                # Cabeçalho: mantém o rótulo real da coluna (estrutural, não é dado do projeto)
                header_text = cell.text.strip()
                if not header_text:
                    header_text = f"Coluna {col_idx + 1}"
                safe = header_text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                cells_html += (
                    f'<th style="{td_style};background:#f3f4f6;font-weight:600">{safe}</th>'
                )
            else:
                cells_html += f'<td style="{td_style}"></td>'

        rows_html += f"<tr>{cells_html}</tr>"

    return (
        '<table style="border-collapse:collapse;width:100%;margin:12px 0">'
        f"<tbody>{rows_html}</tbody></table>"
    )


# Padrões que indicam seções naturalmente repetíveis em qualquer tipo de documento.
# Cada entrada: (palavras-chave no título, instrução de planejamento, nome genérico do campo)
# O nome genérico substitui o título específico do exemplo no template gerado,
# pois o modelo deve ser reutilizável em projetos diferentes.
_REPEATABLE_PATTERNS: list[tuple[list[str], str, str]] = [
    # ── Engenharia de Software / Requisitos ──────────────────────────────────
    (
        ["épico", "epic", "epico"],
        "Liste todos os épicos/módulos/subsistemas identificados na documentação do projeto",
        "Épico",
    ),
    (
        ["feature", "funcionalidade"],
        "Liste todas as features/funcionalidades identificadas na documentação do projeto",
        "Feature",
    ),
    (
        ["história de usuário", "historia de usuario", "user story"],
        "Liste todas as histórias de usuário identificadas na documentação do projeto",
        "História de Usuário",
    ),
    (
        ["caso de uso", "use case"],
        "Liste todos os casos de uso identificados na documentação do projeto",
        "Caso de Uso",
    ),
    (
        ["requisito funcional"],
        "Liste todos os requisitos funcionais identificados na documentação do projeto",
        "Requisito Funcional",
    ),
    (
        ["requisito não funcional", "requisito nao funcional", "requisito de qualidade"],
        "Liste todos os requisitos não funcionais identificados na documentação do projeto",
        "Requisito Não Funcional",
    ),
    (
        ["sprint", "iteração", "iteracao"],
        "Liste todos os sprints/iterações planejados para o projeto",
        "Sprint",
    ),
    (
        ["risco", "risk"],
        "Liste todos os riscos identificados na documentação do projeto",
        "Risco",
    ),
    (
        ["ator", "stakeholder", "parte interessada"],
        "Liste todos os atores/stakeholders identificados na documentação do projeto",
        "Ator / Stakeholder",
    ),
    # ── Documentos Jurídicos / Normativos ────────────────────────────────────
    (
        ["cláusula", "clausula"],
        "Liste todas as cláusulas necessárias para este tipo de documento",
        "Cláusula",
    ),
    (
        ["artigo", "art."],
        "Liste todos os artigos necessários para este documento normativo",
        "Artigo",
    ),
    (
        ["considerando"],
        "Liste todos os considerandos necessários para este documento",
        "Considerando",
    ),
    (
        ["parágrafo único", "paragrafo unico"],
        "Liste os parágrafos únicos ou complementares necessários",
        "Parágrafo",
    ),
    # ── Atas / Minutas ───────────────────────────────────────────────────────
    (
        ["ponto de pauta", "item de pauta", "assunto tratado"],
        "Liste todos os pontos de pauta / assuntos a serem tratados na reunião",
        "Ponto de Pauta",
    ),
    (
        ["deliberação", "deliberacao", "resolução", "resolucao"],
        "Liste todas as deliberações/resoluções a serem registradas",
        "Deliberação",
    ),
    (
        ["encaminhamento", "ação", "acao", "providência"],
        "Liste todos os encaminhamentos/ações definidos na reunião",
        "Encaminhamento",
    ),
    # ── Recursos / Defesas ───────────────────────────────────────────────────
    (
        ["fundamento", "argumento", "razão", "razao"],
        "Liste os fundamentos/argumentos relevantes para este recurso ou defesa",
        "Fundamento",
    ),
    # ── Módulo / Componente (genérico) ───────────────────────────────────────
    (
        ["módulo", "modulo", "componente", "subsistema"],
        "Liste todos os módulos/componentes identificados na documentação do projeto",
        "Módulo",
    ),
]

# Prefixos numerados típicos de documentos de requisitos (EP01, FT02, HU03, etc.)
# mapeados para o nome genérico correspondente
_NUMBERED_PREFIX_MAP: list[tuple[str, str]] = [
    ("ep",  "Épico"),
    ("ft",  "Feature"),
    ("hu",  "História de Usuário"),
    ("us",  "História de Usuário"),
    ("uc",  "Caso de Uso"),
    ("rf",  "Requisito Funcional"),
    ("rnf", "Requisito Não Funcional"),
    ("sp",  "Sprint"),
]


def _detect_repeatable(title: str) -> tuple[bool, Optional[str], Optional[str]]:
    """
    Verifica se o título indica uma seção naturalmente repetível.
    Retorna (é_repetível, instrução_planejamento, nome_genérico).

    Detecta dois padrões:
      1. Prefixo numerado: EP01, FT02, HU03, US04, UC05, RF06, RNF07, SP08, R09...
      2. Palavras-chave no título: "épico", "feature", "história de usuário"...
    """
    import re
    lower = title.lower().strip()

    # 1. Prefixo numerado (ex: "EP01 – Gestão Documental", "FT-03: Upload")
    for prefix, generic_name in _NUMBERED_PREFIX_MAP:
        pattern = rf"^{re.escape(prefix)}\s*[\-–—]?\s*\d"
        if re.match(pattern, lower):
            # Localiza a instrução de planejamento pelo nome genérico
            for keywords, instruction, gn in _REPEATABLE_PATTERNS:
                if gn == generic_name:
                    return True, instruction, generic_name
            return True, f"Liste todos os itens do tipo {generic_name} encontrados no projeto", generic_name

    # 2. Palavra-chave no título
    for keywords, instruction, generic_name in _REPEATABLE_PATTERNS:
        if any(kw in lower for kw in keywords):
            return True, instruction, generic_name

    return False, None, None


def _metadata_field_html(
    field_id: str,
    title: str,
    help_text: str,
    repeatable: bool = False,
    planning_instruction: Optional[str] = None,
) -> str:
    """Gera HTML de um blot MetadataField compatível com o Quill."""
    safe_title = title.replace('"', "&quot;").replace("<", "&lt;").replace(">", "&gt;")
    safe_help = help_text.replace('"', "&quot;").replace("<", "&lt;").replace(">", "&gt;")
    safe_instruction = (planning_instruction or "").replace('"', "&quot;").replace("<", "&lt;").replace(">", "&gt;")
    repeatable_attr = ' data-repeatable="true"' if repeatable else ''
    instruction_attr = f' data-planning-instruction="{safe_instruction}"' if safe_instruction else ''
    repeatable_badge = (
        '<span style="font-size:9px;background:#dbeafe;color:#1d4ed8;'
        'padding:1px 6px;border-radius:99px;margin-left:6px;font-weight:600">REPETÍVEL</span>'
    ) if repeatable else ''
    return (
        f'<div class="sgid-metadata-field" contenteditable="false" '
        f'data-field-id="{field_id}" data-field-title="{safe_title}" '
        f'data-field-help="{safe_help}" data-topic-id=""'
        f'{repeatable_attr}{instruction_attr}>'
        f'<div class="sgid-metadata-field__header">'
        f'<div class="sgid-metadata-field__title">{safe_title}{repeatable_badge}</div>'
        f'<div class="sgid-metadata-field__help" style="font-size:10px;opacity:0.7">{safe_help}</div>'
        f"</div>"
        f'<div class="sgid-metadata-field__textarea">Campo dinâmico — a IA criará as instâncias necessárias ao gerar o documento.</div>'
        f"</div>"
    ) if repeatable else (
        f'<div class="sgid-metadata-field" contenteditable="false" '
        f'data-field-id="{field_id}" data-field-title="{safe_title}" '
        f'data-field-help="{safe_help}" data-topic-id="">'
        f'<div class="sgid-metadata-field__header">'
        f'<div class="sgid-metadata-field__title">{safe_title}</div>'
        f'<div class="sgid-metadata-field__help" style="font-size:10px;opacity:0.7">{safe_help}</div>'
        f"</div>"
        f'<div class="sgid-metadata-field__textarea">Digite aqui (campo editável no documento)...</div>'
        f"</div>"
    )


@app.post("/analyze-document-template")
def analyze_document_template(request: AnalyzeTemplateRequest):
    """
    Analisa um arquivo DOCX e extrai APENAS a estrutura para criar um modelo de documento.
    O conteúdo dos parágrafos de corpo NÃO é copiado — pertence ao documento de exemplo.
    O que é extraído:
      - Hierarquia de títulos/seções com estilos visuais (cor, tamanho, fonte, alinhamento)
      - Um campo de metadado (blot) vazio após cada seção para preenchimento posterior
      - Estrutura de tabelas (linhas × colunas) sem dados — células ficam vazias
    Retorna:
      - template_html: HTML estrutural com blots de seção vazios
      - sections: lista de seções identificadas (id, title, helpText)
      - suggested_name: nome sugerido para o modelo
    """
    try:
        from docx import Document as DocxDocument
    except ImportError:
        raise HTTPException(status_code=500, detail="python-docx não instalado. Execute: pip install python-docx")

    file_path = MODELOS_DIR / request.file_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"Arquivo não encontrado: {request.file_name}")

    try:
        doc = DocxDocument(str(file_path))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao abrir DOCX: {e}")

    html_parts: list[str] = []
    sections: list[dict] = []
    heading_count = 0
    # Controla quais tipos repetíveis já foram adicionados ao template
    # para evitar duplicatas (EP01, EP02... → apenas UM campo "Épico")
    seen_repeatable_types: set[str] = set()

    # Mapa de elementos body → objetos python-docx para preservar ordem
    para_map = {p._element: p for p in doc.paragraphs}
    table_map = {t._element: t for t in doc.tables}

    body = doc.element.body
    for child in body:
        local = child.tag.split("}")[-1] if "}" in child.tag else child.tag

        if local == "p":
            para = para_map.get(child)
            if para is None:
                continue

            is_heading, tag, clean_text = _classify_para(para)

            if not is_heading:
                # Parágrafos de corpo: NÃO copiar conteúdo.
                continue

            if not clean_text:
                continue

            # Detecta se é uma seção repetível e qual é o seu tipo genérico
            repeatable, planning_instruction, generic_name = _detect_repeatable(clean_text)

            if repeatable and generic_name:
                # Deduplica: se já existe um campo para este tipo, ignora instâncias adicionais.
                # EP01, EP02, EP03 → colapsa em UM campo genérico "Épico".
                if generic_name in seen_repeatable_types:
                    continue
                seen_repeatable_types.add(generic_name)

                # Usa o nome genérico como título — não o texto específico do exemplo.
                # O modelo é reutilizável; os nomes reais serão gerados pela IA no projeto.
                section_title = generic_name
                inline_styles = _heading_styles(para)
                style_attr = f' style="{inline_styles}"' if inline_styles else ""
                safe_label = generic_name.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                html_parts.append(f"<{tag}{style_attr}>{safe_label}</{tag}>")
            else:
                # Seção fixa: mantém título estrutural (ex: "Visão Geral", "Objetivo")
                section_title = clean_text
                inline_styles = _heading_styles(para)
                style_attr = f' style="{inline_styles}"' if inline_styles else ""
                safe_text = clean_text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                html_parts.append(f"<{tag}{style_attr}>{safe_text}</{tag}>")

            # Campo de metadado vazio — será preenchido pela IA ao criar o documento
            field_id = f"section-{heading_count}"
            heading_count += 1
            help_text = (
                f'{section_title}: gerado pela IA com base na base de conhecimento do projeto'
                if repeatable
                else f'Conteúdo da seção "{section_title}"'
            )

            sections.append({
                "id": field_id,
                "title": section_title,
                "helpText": help_text,
                "repeatable": repeatable,
                "planningInstruction": planning_instruction,
            })
            html_parts.append(_metadata_field_html(field_id, section_title, help_text, repeatable, planning_instruction))
            html_parts.append("<p><br></p>")

        elif local == "tbl":
            table = table_map.get(child)
            if table is None:
                continue
            # Tabela: preserva estrutura (linhas × colunas + estilo), NÃO copia dados
            html_parts.append(_table_to_html(table))
            html_parts.append("<p><br></p>")

    # Nome sugerido baseado no nome do arquivo sem extensão
    suggested_name = Path(request.file_name).stem

    return {
        "template_html": "\n".join(html_parts),
        "sections": sections,
        "suggested_name": suggested_name,
    }


def run():
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


if __name__ == "__main__":
    run()
