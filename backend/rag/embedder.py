"""
ChromaDB-backed embedding store for HR policy chunks.
"""
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional

import chromadb
from chromadb.config import Settings as ChromaSettings
from sentence_transformers import SentenceTransformer

from backend.config import settings
from backend.rag.loader import load_and_chunk_policy

_model: SentenceTransformer = None
_client: chromadb.PersistentClient = None
_collection = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def _get_collection():
    global _client, _collection
    if _collection is None:
        persist_dir = str(Path(settings.CHROMA_PERSIST_DIR).resolve())
        _client = chromadb.PersistentClient(
            path=persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        _collection = _client.get_or_create_collection(
            name=settings.COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def ingest_policy(filepath: str, policy_doc_id: int) -> int:
    """Chunk a policy file, embed it, and upsert into ChromaDB."""
    chunks = load_and_chunk_policy(filepath)
    if not chunks:
        return 0

    model = _get_model()
    collection = _get_collection()

    texts = [c["text"] for c in chunks]
    ids = [c["chunk_id"] for c in chunks]
    metadatas = []
    for c in chunks:
        meta = {k: str(v) for k, v in c["metadata"].items()}
        meta["policy_doc_id"] = str(policy_doc_id)
        metadatas.append(meta)

    embeddings = model.encode(texts, show_progress_bar=False).tolist()

    collection.upsert(
        ids=ids,
        documents=texts,
        embeddings=embeddings,
        metadatas=metadatas,
    )
    return len(chunks)


def delete_policy(filename: str) -> None:
    """Delete all chunks whose metadata.source matches filename."""
    collection = _get_collection()
    results = collection.get(where={"source": filename})
    if results and results.get("ids"):
        collection.delete(ids=results["ids"])


def _build_where_filter(selected_files: Optional[List[str]]) -> Optional[Dict[str, Any]]:
    if not selected_files:
        return None
    if len(selected_files) == 1:
        return {"source": selected_files[0]}
    return {"$or": [{"source": f} for f in selected_files]}


def get_all_chunks_text(selected_files: Optional[List[str]] = None) -> List[Tuple[str, str]]:
    """Return [(chunk_id, text), ...] for chunks, optionally filtered by selected files."""
    collection = _get_collection()
    where = _build_where_filter(selected_files)
    if where:
        results = collection.get(where=where, include=["documents"])
    else:
        results = collection.get(include=["documents"])
    ids = results.get("ids", [])
    docs = results.get("documents", [])
    return list(zip(ids, docs))


def similarity_search(
    query_embedding: List[float],
    top_k: int = 10,
    selected_files: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Return top_k results from ChromaDB by cosine similarity.
    Optionally filtered by selected_files.
    Each result: {id, text, metadata, score}
    """
    collection = _get_collection()
    where = _build_where_filter(selected_files)

    query_kwargs: Dict[str, Any] = {
        "query_embeddings": [query_embedding],
        "n_results": top_k,
        "include": ["documents", "metadatas", "distances"],
    }
    if where:
        query_kwargs["where"] = where

    results = collection.query(**query_kwargs)

    output = []
    ids = results.get("ids", [[]])[0]
    docs = results.get("documents", [[]])[0]
    metas = results.get("metadatas", [[]])[0]
    distances = results.get("distances", [[]])[0]

    for i, (doc_id, doc, meta, dist) in enumerate(zip(ids, docs, metas, distances)):
        # ChromaDB cosine distance → similarity = 1 - distance
        score = 1.0 - float(dist)
        output.append({"id": doc_id, "text": doc, "metadata": meta, "score": score})

    return output


def embed_query(question: str) -> List[float]:
    """Embed a single query string."""
    model = _get_model()
    return model.encode([question], show_progress_bar=False)[0].tolist()
