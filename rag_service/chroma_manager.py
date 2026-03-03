"""Gerenciador do ChromaDB - verificação e criação da collection."""
import chromadb
from chromadb.config import Settings
from chromadb.utils import embedding_functions

from config import CHROMA_PERSIST_DIR, COLLECTION_NAME, OLLAMA_URL, OLLAMA_EMBED_MODEL


def get_or_create_client():
    """Retorna cliente ChromaDB com persistência habilitada."""
    CHROMA_PERSIST_DIR.mkdir(parents=True, exist_ok=True)
    return chromadb.PersistentClient(
        path=str(CHROMA_PERSIST_DIR),
        settings=Settings(anonymized_telemetry=False),
    )


def get_embedding_function():
    """Retorna função de embedding via Ollama."""
    return embedding_functions.OllamaEmbeddingFunction(
        model_name=OLLAMA_EMBED_MODEL,
        url=f"{OLLAMA_URL}/api/embeddings",
        timeout=120,
    )


def get_or_create_collection():
    """
    Verifica se a collection existe. Caso não exista, cria automaticamente.
    Retorna a collection pronta para uso.
    """
    client = get_or_create_client()
    ef = get_embedding_function()
    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=ef,
        metadata={"description": "Documentos indexados para RAG"},
    )
    return collection
