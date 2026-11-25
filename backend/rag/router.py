"""
Policy Document Router:
Identifies relevant HR policy documents using:
1. Keyword & section/header matching against document titles, filenames, and H2/H3 headers.
2. Fast LLM semantic classification (Groq Cloud) as fallback if keyword matching is ambiguous.
3. Early rejection if the query is unrelated to HR policies.
"""
import re
import json
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional
from functools import lru_cache

from groq import Groq
from backend.config import settings

# Common English stopwords to ignore in keyword matching
STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
    "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
    "below", "between", "both", "but", "by", "can", "can't", "cannot", "could",
    "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down",
    "during", "each", "few", "for", "from", "further", "had", "hadn't", "has",
    "hasn't", "have", "haven't", "having", "he", "her", "here", "hers", "herself",
    "him", "himself", "his", "how", "i", "if", "in", "into", "is", "isn't", "it",
    "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself",
    "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought",
    "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she",
    "should", "shouldn't", "so", "some", "such", "than", "that", "the", "their",
    "theirs", "them", "themselves", "then", "there", "these", "they", "this",
    "those", "through", "to", "too", "under", "until", "up", "very", "was",
    "wasn't", "we", "were", "weren't", "what", "when", "where", "which", "while",
    "who", "whom", "why", "with", "won't", "would", "wouldn't", "you", "your",
    "yours", "yourself", "yourselves", "tell", "much", "many", "get", "give"
}


def _tokenize(text: str) -> List[str]:
    """Extract lowercase alphanumeric tokens, filtering stopwords and single chars."""
    words = re.findall(r"\b[a-zA-Z0-9_\-]+\b", text.lower())
    return [w for w in words if w not in STOPWORDS and len(w) > 1]


def build_policy_catalog() -> List[Dict[str, Any]]:
    """
    Scan policies directory and build a structured catalog with titles,
    sections, and searchable keywords.
    """
    policies_dir = Path(settings.POLICIES_DIR).resolve()
    if not policies_dir.exists():
        return []

    catalog = []
    for md_file in sorted(policies_dir.glob("*.md")):
        raw_text = md_file.read_text(encoding="utf-8")

        # Extract title (first # Heading)
        title_match = re.search(r"^#\s+(.+)", raw_text, re.MULTILINE)
        title = title_match.group(1).strip() if title_match else md_file.stem.replace("_", " ").title()

        # Extract all ## and ### headings
        headings = []
        for line in raw_text.splitlines():
            line_s = line.strip()
            if line_s.startswith("## ") or line_s.startswith("### "):
                clean_h = re.sub(r"^[#\s\d\.]+", "", line_s).strip()
                if clean_h and clean_h.lower() not in ("purpose", "scope", "table of contents"):
                    headings.append(clean_h)

        # Build keywords
        file_tokens = _tokenize(md_file.stem.replace("_", " "))
        title_tokens = _tokenize(title)
        heading_tokens = []
        for h in headings:
            heading_tokens.extend(_tokenize(h))

        catalog.append({
            "filename": md_file.name,
            "title": title,
            "headings": headings,
            "filename_tokens": set(file_tokens),
            "title_tokens": set(title_tokens),
            "heading_tokens": set(heading_tokens),
            "all_tokens": set(file_tokens + title_tokens + heading_tokens),
        })

    return catalog


def route_by_keywords(question: str, catalog: List[Dict[str, Any]]) -> Tuple[List[str], float]:
    """
    Score each policy based on keyword and header matches.
    Returns (selected_filenames, confidence_score).
    """
    q_tokens = _tokenize(question)
    q_lower = question.lower()
    if not q_tokens or not catalog:
        return [], 0.0

    scores = []
    for item in catalog:
        score = 0.0

        # 1. Exact match with heading phrases
        for heading in item["headings"]:
            h_clean = heading.lower()
            if len(h_clean) > 3 and h_clean in q_lower:
                score += 6.0  # strong signal: entire heading appears in query

        # 2. Token overlap with title & filename (weight 3.0)
        title_matches = q_tokens_set = set(q_tokens) & item["title_tokens"]
        fn_matches = set(q_tokens) & item["filename_tokens"]
        score += len(title_matches | fn_matches) * 3.0

        # 3. Token overlap with headings (weight 1.5)
        heading_matches = set(q_tokens) & item["heading_tokens"]
        score += len(heading_matches) * 1.5

        scores.append((item["filename"], score))

    scores.sort(key=lambda x: x[1], reverse=True)
    top_file, top_score = scores[0]

    # If top score is sufficient
    if top_score >= 3.0:
        selected = [top_file]
        # Check runner-up for multi-policy query (e.g. cross-cutting topic)
        if len(scores) > 1:
            second_file, second_score = scores[1]
            if second_score >= 3.0 and second_score >= (top_score * 0.5):
                selected.append(second_file)
        return selected, top_score

    return [], top_score


def route_by_llm(
    question: str,
    catalog: List[Dict[str, Any]],
    chat_history: Optional[List[Dict[str, str]]] = None,
) -> Tuple[List[str], bool]:
    """
    Use fast Groq Cloud LLM to classify user query into 1-2 relevant policy files,
    or determine if it is not HR related.
    Returns (selected_filenames, is_hr_related).
    """
    if not catalog or not settings.GROQ_API_KEY:
        return [], True

    # Build concise description of available policies
    policy_summaries = []
    for item in catalog:
        sample_headings = ", ".join(item["headings"][:8])
        policy_summaries.append(
            f"- File: `{item['filename']}` | Title: {item['title']}\n  Key Sections: {sample_headings}"
        )
    policies_text = "\n".join(policy_summaries)

    history_block = ""
    if chat_history:
        recent = chat_history[-5:]
        history_lines = []
        for idx, turn in enumerate(recent, 1):
            q_txt = turn.get("question", "")
            a_txt = (turn.get("answer", "") or "")[:200]
            history_lines.append(f"  Turn {idx} User: {q_txt}\n  Turn {idx} Assistant: {a_txt}...")
        history_block = (
            "Recent Conversation History (for resolving follow-up questions):\n"
            + "\n".join(history_lines)
            + "\n\n"
        )

    prompt = (
        "You are an HR policy router. Your job is to select the 1 or 2 most relevant policy document files "
        "that can answer the user's question, or identify if the question is unrelated to company HR policies.\n\n"
        f"Available Policy Files:\n{policies_text}\n\n"
        f"{history_block}"
        f"Current User Question: \"{question}\"\n\n"
        "Instructions:\n"
        "1. If the question is completely unrelated to company HR policies (e.g. general knowledge, math, coding, outside world) AND is not a follow-up to the conversation history, set \"is_hr_related\": false and \"selected_files\": [].\n"
        "2. If the question is about company HR policies or is a follow-up to an HR topic in the conversation history, set \"is_hr_related\": true and choose up to 2 most relevant filenames from the list above.\n"
        "3. Reply ONLY with valid JSON in this exact structure:\n"
        "{\n"
        "  \"is_hr_related\": true,\n"
        "  \"selected_files\": [\"filename.md\"]\n"
        "}"
    )

    try:
        client = Groq(api_key=settings.GROQ_API_KEY)
        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=150,
            response_format={"type": "json_object"} if hasattr(client.chat.completions, "create") else None,
        )
        content = response.choices[0].message.content.strip()
        data = json.loads(content)

        is_hr = data.get("is_hr_related", True)
        files = data.get("selected_files", [])
        # Sanitize to valid files only
        valid_filenames = {item["filename"] for item in catalog}
        matched_files = [f for f in files if f in valid_filenames][:2]

        return matched_files, is_hr
    except Exception as e:
        # Fallback to returning all catalog files if LLM routing fails
        return [item["filename"] for item in catalog[:2]], True


def route_question(
    question: str,
    chat_history: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    """
    Main routing entry point:
    1. Keyword/header match
    2. Fallback to LLM semantic router (using recent chat history if present)
    3. Rejection if unrelated
    """
    catalog = build_policy_catalog()
    if not catalog:
        return {"selected_files": [], "is_hr_related": False, "method": "no_policies"}

    # Step 1: Keyword & header match
    kw_files, kw_score = route_by_keywords(question, catalog)
    if kw_files:
        return {
            "selected_files": kw_files,
            "is_hr_related": True,
            "method": "keyword",
            "score": kw_score,
        }

    # Step 2: Fallback to LLM router
    llm_files, is_hr = route_by_llm(question, catalog, chat_history=chat_history)
    if not is_hr or not llm_files:
        return {
            "selected_files": [],
            "is_hr_related": False,
            "method": "rejected_unrelated",
            "score": 0.0,
        }

    return {
        "selected_files": llm_files,
        "is_hr_related": True,
        "method": "llm",
        "score": 1.0,
    }
