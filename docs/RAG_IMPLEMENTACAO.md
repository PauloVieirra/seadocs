# Implementação RAG - ChromaDB + Bucket + Banco Relacional

## Visão Geral

Sistema completo de ingestão e indexação de documentos para RAG (Retrieval-Augmented Generation) com:

- **ChromaDB** – base vetorial com persistência
- **Supabase Storage** – bucket `Documentos` com subpastas por projeto
- **Supabase PostgreSQL** – tabela `project_materials` com metadados

## Fluxo

```
1. Upload → Bucket Documentos/{project_id}/{arquivo}
2. Insert no banco → file_url, file_path, status=PENDING
3. Serviço RAG indexa → baixa, extrai texto, chunk, embeddings, ChromaDB
4. Update no banco → status=PROCESSED, chunk_count, file_hash
```

## Estrutura de Dados

### Banco Relacional (project_materials)

| Coluna        | Descrição                          |
|---------------|------------------------------------|
| id            | UUID do documento                  |
| project_id    | Projeto                            |
| file_name     | Nome original                      |
| file_path     | Caminho no bucket                  |
| file_url      | URL pública (obrigatório)          |
| file_hash     | SHA256 para evitar duplicação      |
| chunk_count   | Quantidade de chunks indexados     |
| status        | PENDING → PROCESSED / ERROR        |
| is_data_source| Se é fonte para RAG                |

### ChromaDB (metadata por chunk)

```json
{
  "document_id": "uuid",
  "file_url": "link",
  "file_name": "original.pdf",
  "source": "bucket",
  "project_id": "uuid",
  "created_at": "timestamp"
}
```

## Como Usar

### 1. Iniciar o serviço RAG

```bash
cd rag_service
pip install -r requirements.txt
ollama pull nomic-embed-text
# Configure SUPABASE_URL e SUPABASE_SERVICE_KEY no .env
uvicorn api:app --reload --host 0.0.0.0 --port 8000
```

### 2. Aplicar migrations

```bash
supabase db push
```

### 3. Adicionar documentos

Na aba **Fonte de Dados** do projeto, envie PDF, DOCX ou TXT. O fluxo é automático:

- Upload no bucket
- Registro no banco com `file_url`
- Indexação assíncrona no ChromaDB

### 4. Reindexar

Use `apiService.reindexDocumentInRAG(projectId, fileId)` para forçar nova indexação.

### 5. Excluir

Ao excluir um arquivo que é fonte de dados, ele é removido do bucket, do banco e do ChromaDB.

## Regras Implementadas

- Não resumir antes de gerar embeddings
- Conteúdo completo chunkado
- Reindexação permitida
- Exclusão em banco e ChromaDB
- Validação de duplicação por hash
