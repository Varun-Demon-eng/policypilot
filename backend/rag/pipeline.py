"""
RAG pipeline: hybrid retrieval (Semantic + BM25) → RRF → MMR → LLM answer.
"""
import re
import time
import json
from typing import List, Dict, Any, Tuple, Optional

import numpy as np
from rank_bm25 import BM25Okapi
from groq import Groq

from backend.config import settings
from backend.rag.embedder import embed_query, similarity_search, get_all_chunks_text
from backend.rag.router import route_question

# ---------------------------------------------------------------------------
# Confidence label thresholds
# ---------------------------------------------------------------------------
CONF_HIGH = 0.55
CONF_MEDIUM = 0.40
CONF_LOW = 0.25

FALLBACK_ANSWER = (
    "I'm sorry, I don't have enough information in the available HR policy documents "
    "to answer your question confidently. Please contact HR directly for assistance."
)


# ---------------------------------------------------------------------------
# BM25 helpers
# ---------------------------------------------------------------------------

def _tokenize(text: str) -> List[str]:
    return re.findall(r"\w+", text.lower())


def _bm25_search(question: str, all_chunks: List[Tuple[str, str]], top_k: int = 10):
    """Return top_k results as list of {id, text, bm25_score}."""
    if not all_chunks:
        return []
    ids, texts = zip(*all_chunks)
    tokenized_corpus = [_tokenize(t) for t in texts]
    bm25 = BM25Okapi(tokenized_corpus)
    scores = bm25.get_scores(_tokenize(question))
    top_indices = np.argsort(scores)[::-1][:top_k]
    return [
        {"id": ids[i], "text": texts[i], "bm25_score": float(scores[i])}
        for i in top_indices
        if scores[i] > 0
    ]


# ---------------------------------------------------------------------------
# Reciprocal Rank Fusion
# ---------------------------------------------------------------------------

def _rrf(
    semantic_results: List[Dict],
    bm25_results: List[Dict],
    k: int = 60,
    top_k: int = 10,
) -> List[Dict]:
    """
    Fuse two ranked lists via RRF.
    Returns merged list sorted by RRF score (descending), top_k items.
    """
    scores: Dict[str, float] = {}
    chunk_map: Dict[str, Dict] = {}

    for rank, item in enumerate(semantic_results):
        cid = item["id"]
        scores[cid] = scores.get(cid, 0.0) + 1.0 / (k + rank + 1)
        chunk_map[cid] = item

    for rank, item in enumerate(bm25_results):
        cid = item["id"]
        scores[cid] = scores.get(cid, 0.0) + 1.0 / (k + rank + 1)
        if cid not in chunk_map:
            chunk_map[cid] = item

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_k]
    return [chunk_map[cid] for cid, _ in ranked]


# ---------------------------------------------------------------------------
# MMR re-ranking
# ---------------------------------------------------------------------------

def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


def _mmr(
    query_embedding: List[float],
    candidates: List[Dict],
    candidate_embeddings: List[List[float]],
    top_k: int = 5,
    lambda_param: float = 0.7,
) -> List[Dict]:
    """
    MMR re-ranking.
    lambda_param: weight for relevance vs. diversity (higher = more relevant).
    """
    if not candidates:
        return []

    q_vec = np.array(query_embedding)
    cand_vecs = [np.array(e) for e in candidate_embeddings]

    relevance = [_cosine(q_vec, v) for v in cand_vecs]

    selected_indices: List[int] = []
    remaining = list(range(len(candidates)))

    for _ in range(min(top_k, len(candidates))):
        mmr_scores = []
        for i in remaining:
            rel = relevance[i]
            if selected_indices:
                max_sim = max(_cosine(cand_vecs[i], cand_vecs[j]) for j in selected_indices)
            else:
                max_sim = 0.0
            mmr_scores.append(lambda_param * rel - (1 - lambda_param) * max_sim)

        best_local = int(np.argmax(mmr_scores))
        best_global = remaining[best_local]
        selected_indices.append(best_global)
        remaining.pop(best_local)

    return [candidates[i] for i in selected_indices]


# ---------------------------------------------------------------------------
# Confidence label
# ---------------------------------------------------------------------------

def _confidence_label(score: float) -> str:
    if score >= CONF_HIGH:
        return "high"
    if score >= CONF_MEDIUM:
        return "medium"
    if score >= CONF_LOW:
        return "low"
    return "fallback"


# ---------------------------------------------------------------------------
# Groq LLM call & Prompt Engineering
# ---------------------------------------------------------------------------

def _clean_response_text(text: str) -> str:
    """Ensure clean markdown formatting and enforce company anonymity."""
    # Convert accidental HTML line breaks to proper markdown newlines
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    # Strip any stray HTML tags
    text = re.sub(r"</?(?:b|i|p|span|div|table|tr|td|th|tbody|thead)[^>]*>", "", text, flags=re.IGNORECASE)
    # Remove markdown pipe-tables entirely and convert to empty line
    # (table rows start with optional spaces then a pipe char)
    lines = text.split("\n")
    cleaned_lines = []
    for line in lines:
        stripped = line.strip()
        # Skip pipe-table rows (data rows and separator rows like |---|---|)
        if stripped.startswith("|") and stripped.endswith("|"):
            continue
        cleaned_lines.append(line)
    text = "\n".join(cleaned_lines)
    # Enforce company name anonymity
    text = re.sub(r"\bMeridian Technologies(?:,?\s*Inc\.?)?\b", "the Company", text, flags=re.IGNORECASE)
    # Normalize excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _build_prompt(
    question: str,
    chunks: List[Dict],
    chat_history: Optional[List[Dict[str, str]]] = None,
) -> List[Dict]:
    context_parts = []
    for i, chunk in enumerate(chunks, 1):
        meta = chunk.get("metadata", {})
        label = (
            f"[Source {i}: {meta.get('policy_title', 'Unknown')} | "
            f"Section: {meta.get('section', 'N/A')} | "
            f"File: {meta.get('source', 'N/A')}]"
        )
        context_parts.append(f"{label}\n{chunk['text']}")

    context = "\n\n---\n\n".join(context_parts)

    system_prompt = (
        "You are a professional HR policy advisor. Answer employee questions clearly and concisely "
        "using only the provided policy excerpts.\n\n"
        "STRICT OUTPUT RULES — follow every rule exactly:\n\n"
        "1. FORMAT: Use ONLY plain prose paragraphs and Markdown bullet points (- item). "
        "NEVER output Markdown pipe-tables (no | character used as a column separator). "
        "NEVER output HTML tags (<br>, <b>, <table>, etc.).\n\n"
        "2. STRUCTURE — use this exact layout:\n"
        "   **Overview**\n"
        "   One or two plain-English sentences directly answering the question.\n\n"
        "   **Key Rules & Entitlements**\n"
        "   Bullet list. Each bullet: '- **Label:** explanation.' "
        "If values differ by employee type, use nested sub-bullets (  - sub-item), not tables.\n\n"
        "   **Procedure**\n"
        "   Numbered steps if a process applies (1. Step one.). Omit this section if no process is involved.\n\n"
        "   📌 *Policy Reference: [Policy Title] – [Section name/number]*\n\n"
        "3. COMPANY NAME: Never say 'Meridian Technologies' or any real company name. "
        "Say 'the Company' or 'Company policy'.\n\n"
        "4. ACCURACY & CONTEXT: Base your answer solely on the provided excerpts. "
        "You may use the recent conversation history (up to 5 prior turns) to understand follow-up questions and references. "
        "If the excerpts do not contain the answer, say so plainly."
    )

    messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]

    if chat_history:
        for turn in chat_history[-5:]:
            q_txt = (turn.get("question") or "").strip()
            a_txt = (turn.get("answer") or "").strip()
            if q_txt:
                messages.append({"role": "user", "content": q_txt})
            if a_txt:
                messages.append({"role": "assistant", "content": a_txt})

    user_message = (
        f"HR Policy Context:\n\n{context}\n\n"
        f"Employee Question: {question}\n\n"
        "Please provide a structured, professional response adhering to the formatting instructions."
    )
    messages.append({"role": "user", "content": user_message})

    return messages


def _call_groq(messages: List[Dict]) -> str:
    client = Groq(api_key=settings.GROQ_API_KEY)
    response = client.chat.completions.create(
        model="openai/gpt-oss-120b",
        messages=messages,
        temperature=0.1,
        max_tokens=1536,
    )
    raw_answer = response.choices[0].message.content.strip()
    return _clean_response_text(raw_answer)


# ---------------------------------------------------------------------------
# Source extraction
# ---------------------------------------------------------------------------

def _extract_sources(chunks: List[Dict]) -> List[Dict]:
    seen = set()
    sources = []
    for chunk in chunks:
        meta = chunk.get("metadata", {})
        key = (meta.get("source", ""), meta.get("section", ""))
        if key not in seen:
            seen.add(key)
            sources.append(
                {
                    "policy_title": meta.get("policy_title", ""),
                    "section": meta.get("section", ""),
                    "subsection": meta.get("subsection", ""),
                    "filename": meta.get("source", ""),
                }
            )
    return sources


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def query_rag(
    question: str,
    chat_history: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    t_start = time.time()

    # 1. Pre-process
    question = question.strip()
    if not question:
        return {
            "answer": FALLBACK_ANSWER,
            "sources": [],
            "confidence_score": 0.0,
            "confidence_label": "fallback",
            "response_time_ms": 0,
        }

    recent_history = chat_history[-5:] if chat_history else []

    # 2. Document routing & relevance filtering
    route = route_question(question, chat_history=recent_history)
    if not route.get("is_hr_related") or not route.get("selected_files"):
        return {
            "answer": FALLBACK_ANSWER,
            "sources": [],
            "confidence_score": 0.0,
            "confidence_label": "fallback",
            "response_time_ms": int((time.time() - t_start) * 1000),
        }

    selected_files = route["selected_files"]

    # Enrich retrieval query with previous turn if this looks like a follow-up
    retrieval_query = question
    if recent_history and route.get("method") == "llm":
        last_q = (recent_history[-1].get("question") or "").strip()
        if last_q:
            retrieval_query = f"{last_q} {question}"

    # 3. Embed question
    q_embedding = embed_query(retrieval_query)

    # 4. Semantic search filtered to targeted policy file(s) → top 10
    semantic_results = similarity_search(q_embedding, top_k=10, selected_files=selected_files)

    # 5. BM25 search within targeted policy file(s) → top 10
    all_chunks = get_all_chunks_text(selected_files=selected_files)
    bm25_results = _bm25_search(retrieval_query, all_chunks, top_k=10)

    # 6. RRF fusion → top 10
    fused = _rrf(semantic_results, bm25_results, k=60, top_k=10)

    if not fused:
        return {
            "answer": FALLBACK_ANSWER,
            "sources": [],
            "confidence_score": 0.0,
            "confidence_label": "fallback",
            "response_time_ms": int((time.time() - t_start) * 1000),
        }

    # 6. Re-embed fused candidates for MMR (use existing semantic scores/embeddings
    #    or re-embed only those not in semantic results)
    semantic_id_to_emb: Dict[str, List[float]] = {}
    # We don't have stored embeddings from the query, so we re-embed all fused texts
    from backend.rag.embedder import _get_model
    model = _get_model()
    fused_texts = [c["text"] for c in fused]
    fused_embeddings = model.encode(fused_texts, show_progress_bar=False).tolist()

    # 7. MMR re-ranking → top 5
    top_chunks = _mmr(q_embedding, fused, fused_embeddings, top_k=5, lambda_param=0.7)

    # Assign cosine similarity scores to top chunks
    q_vec = np.array(q_embedding)
    top_chunk_scores = []
    for chunk in top_chunks:
        txt = chunk["text"]
        emb = model.encode([txt], show_progress_bar=False)[0]
        top_chunk_scores.append(_cosine(q_vec, emb))

    # 8. Confidence score based on top matching chunks
    if top_chunk_scores:
        sorted_scores = sorted(top_chunk_scores, reverse=True)
        top1 = sorted_scores[0]
        top2 = sorted_scores[1] if len(sorted_scores) > 1 else top1
        confidence_score = round(float(0.7 * top1 + 0.3 * top2), 4)
    else:
        confidence_score = 0.0
    label = _confidence_label(confidence_score)

    if label == "fallback":
        return {
            "answer": FALLBACK_ANSWER,
            "sources": [],
            "confidence_score": confidence_score,
            "confidence_label": "fallback",
            "response_time_ms": int((time.time() - t_start) * 1000),
        }

    # 9. Build prompt & call LLM
    messages = _build_prompt(question, top_chunks, chat_history=recent_history)
    answer = _call_groq(messages)

    # 10. Extract sources
    sources = _extract_sources(top_chunks)

    response_time_ms = int((time.time() - t_start) * 1000)

    return {
        "answer": answer,
        "sources": sources,
        "confidence_score": confidence_score,
        "confidence_label": label,
        "response_time_ms": response_time_ms,
    }
