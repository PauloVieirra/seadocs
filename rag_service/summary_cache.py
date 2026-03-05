"""Cache de resumos da IA - armazenado no servidor RAG para acesso via rede."""
import json
from pathlib import Path
from typing import Optional

from config import CHROMA_PERSIST_DIR

CACHE_FILE = CHROMA_PERSIST_DIR / "rag_summaries.json"


def _load_cache() -> dict:
    if not CACHE_FILE.exists():
        return {}
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {}


def _save_cache(data: dict) -> None:
    CHROMA_PERSIST_DIR.mkdir(parents=True, exist_ok=True)
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _ids_key(ids: list[str]) -> str:
    return ",".join(sorted(ids))


def get_summary_cache(project_id: str, data_source_ids: list[str]) -> Optional[dict]:
    """Retorna resumo em cache se existir e os data_source_ids forem os mesmos."""
    cache = _load_cache()
    entry = cache.get(project_id)
    if not entry:
        return None
    cached_ids = entry.get("data_source_ids", [])
    if _ids_key(cached_ids) != _ids_key(data_source_ids):
        return None
    return {
        "summary": entry["summary"],
        "sources_count": entry["sources_count"],
    }


def save_summary_cache(project_id: str, data_source_ids: list[str], summary: str, sources_count: int) -> None:
    """Salva resumo no cache do RAG."""
    cache = _load_cache()
    cache[project_id] = {
        "data_source_ids": sorted(data_source_ids),
        "summary": summary,
        "sources_count": sources_count,
    }
    _save_cache(cache)


def get_understanding_cache(cache_key: str) -> Optional[dict]:
    """Retorna entendimento de documento em cache."""
    cache = _load_cache()
    understandings = cache.get("_understandings", {})
    entry = understandings.get(cache_key)
    if not entry:
        return None
    return {"summary": entry["summary"], "sources_count": entry["sources_count"]}


def save_understanding_cache(cache_key: str, summary: str, sources_count: int) -> None:
    """Salva entendimento de documento no cache."""
    cache = _load_cache()
    if "_understandings" not in cache:
        cache["_understandings"] = {}
    cache["_understandings"][cache_key] = {"summary": summary, "sources_count": sources_count}
    _save_cache(cache)


def sections_hash(sections: list[dict]) -> str:
    """Gera hash das seções para chave de cache."""
    parts = []
    for s in sorted(sections, key=lambda x: x.get("id", "")):
        parts.append(f"{s.get('id', '')}|{s.get('title', '')}|{s.get('helpText', '')}")
    s = ";".join(parts)
    h = 0
    for c in s:
        h = ((h << 5) - h + ord(c)) & 0xFFFFFFFF
    return str(h)
