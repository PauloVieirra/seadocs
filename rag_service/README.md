# Serviço RAG - Supabase pgvector + Ollama

Sistema de ingestão e indexação de documentos para RAG (Retrieval-Augmented Generation) usando **Supabase pgvector**.

## Pré-requisitos

1. **Supabase** com extensão pgvector habilitada (migration `20260322120000_rag_pgvector.sql`)

2. **Ollama** para embeddings (nomic-embed-text):
   ```bash
   ollama pull nomic-embed-text
   ```

3. **Python 3.10+**

## Instalação

```bash
cd rag_service
pip install -r requirements.txt
```

## Configuração

Variáveis de ambiente (ou `.env`):

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `SUPABASE_URL` | URL do Supabase | - |
| `SUPABASE_SERVICE_KEY` | Chave service_role (bypass RLS + download bucket) | - |
| `OLLAMA_URL` | URL do Ollama (embeddings + LLM na nuvem) | `http://localhost:11434` |
| `OLLAMA_EMBED_MODEL` | Modelo de embeddings | `nomic-embed-text` |
| `GROQ_API_KEY` | Chave da API Groq (fallback quando Ollama indisponível) | - |
| `GROQ_MODEL` | Modelo Groq | `llama-3.1-8b-instant` |

**Vercel:** configure `GROQ_API_KEY` e `OLLAMA_URL` nas variáveis de ambiente.

**Frontend** (.env): `VITE_RAG_SERVICE_URL=http://localhost:8000` se o serviço rodar em outra porta.

## Executar

```bash
uvicorn api:app --reload --host 0.0.0.0 --port 8000
```

## Endpoints

- `GET /health` - Status do Supabase pgvector
- `POST /index` - Indexar documento
- `POST /delete` - Remover documento do RAG
- `POST /search` - Busca semântica

## Fluxo

1. Upload no bucket → salva no banco com `file_url`
2. Frontend chama `POST /index` com os dados do documento
3. Serviço baixa o arquivo, extrai texto, chunk, gera embeddings via Ollama, insere na tabela `rag_documents` (Supabase)
4. Atualiza `status=PROCESSED`, `chunk_count`, `file_hash` no banco
