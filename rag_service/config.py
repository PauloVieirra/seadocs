"""Configuração do serviço RAG."""
import os
from pathlib import Path

# ChromaDB - persistência local
CHROMA_PERSIST_DIR = Path(os.getenv("CHROMA_PERSIST_DIR", "./chroma_db"))
COLLECTION_NAME = os.getenv("CHROMA_COLLECTION", "docs_rag")

# Ollama - embeddings
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
OLLAMA_SUMMARY_MODEL = os.getenv("OLLAMA_SUMMARY_MODEL", "phi3")

# Chunking
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "1200"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "250"))

# Supabase (para atualizar status no banco)
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")  # service_role para bypass RLS
