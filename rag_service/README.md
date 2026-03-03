# Serviço RAG - ChromaDB + Ollama

Sistema de ingestão e indexação de documentos para RAG (Retrieval-Augmented Generation).

## Pré-requisitos

1. **Ollama** rodando localmente com modelo de embeddings:
   ```bash
   ollama pull nomic-embed-text
   ```

2. **Python 3.10+**

## Instalação

```bash
cd rag_service
pip install -r requirements.txt
```

## Configuração

Variáveis de ambiente (ou `.env`):

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `CHROMA_PERSIST_DIR` | Diretório persistente do ChromaDB | `./chroma_db` |
| `CHROMA_COLLECTION` | Nome da collection | `docs_rag` |
| `OLLAMA_URL` | URL do Ollama | `http://localhost:11434` |
| `OLLAMA_EMBED_MODEL` | Modelo de embeddings | `nomic-embed-text` |
| `SUPABASE_URL` | URL do Supabase | - |
| `SUPABASE_SERVICE_KEY` | Chave service_role (bypass RLS + download bucket privado) | - |

**Frontend** (.env na raiz do projeto): adicione `VITE_RAG_SERVICE_URL=http://localhost:8000` se o serviço rodar em outra porta.

## Executar

```bash
uvicorn api:app --reload --host 0.0.0.0 --port 8000
```

## Endpoints

- `GET /health` - Status do ChromaDB
- `POST /index` - Indexar documento (body: document_id, file_url, file_name, project_id, file_path?, reindex?)
- `POST /delete` - Remover documento do ChromaDB
- `POST /search?query=...&project_id=...&n_results=5` - Busca semântica

## Fluxo

1. Upload no bucket → salva no banco com `file_url`
2. Frontend chama `POST /index` com os dados do documento
3. Serviço baixa o arquivo (via URL ou Supabase Storage com file_path), extrai texto, chunk, gera embeddings, insere no ChromaDB
4. Atualiza `status=PROCESSED`, `chunk_count`, `file_hash` no banco
