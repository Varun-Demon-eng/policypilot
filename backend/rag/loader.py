"""
load_and_chunk_policy: reads a Markdown policy file and returns a list of
chunk dicts, each carrying the chunk text plus rich metadata.
"""
import re
from pathlib import Path
from typing import List, Dict, Any

import tiktoken
try:
    from langchain_text_splitters import MarkdownTextSplitter
except ImportError:
    from langchain.text_splitter import MarkdownTextSplitter

_TOKENIZER = None

def _get_tokenizer():
    global _TOKENIZER
    if _TOKENIZER is None:
        try:
            _TOKENIZER = tiktoken.get_encoding("cl100k_base")
        except Exception:
            _TOKENIZER = False
    return _TOKENIZER


def _count_tokens(text: str) -> int:
    enc = _get_tokenizer()
    if enc:
        try:
            return len(enc.encode(text))
        except Exception:
            pass
    return max(1, int(len(text.split()) * 1.3))


def _extract_frontmatter_field(text: str, field: str) -> str:
    """Extract a value like 'Policy Number: HR-001' from the raw text."""
    pattern = rf"{re.escape(field)}\s*[:\-]\s*(.+)"
    match = re.search(pattern, text, re.IGNORECASE)
    return match.group(1).strip() if match else ""


def _extract_policy_title(text: str) -> str:
    """Return the first H1 heading."""
    match = re.search(r"^#\s+(.+)", text, re.MULTILINE)
    return match.group(1).strip() if match else ""


def _find_nearest_heading(text_before: str, level: int) -> str:
    """Find the nearest heading of the given level (## = 2, ### = 3)."""
    prefix = "#" * level + " "
    matches = [
        m.group(1).strip()
        for m in re.finditer(rf"^{re.escape(prefix)}(.+)", text_before, re.MULTILINE)
    ]
    return matches[-1] if matches else ""


def load_and_chunk_policy(filepath: str) -> List[Dict[str, Any]]:
    """
    Load a Markdown policy file, split it into chunks, and return a list of
    chunk dicts with text + metadata.
    """
    path = Path(filepath)
    raw_text = path.read_text(encoding="utf-8")

    policy_title = _extract_policy_title(raw_text)
    policy_number = _extract_frontmatter_field(raw_text, "Policy Number")
    effective_date = _extract_frontmatter_field(raw_text, "Effective Date")
    version = _extract_frontmatter_field(raw_text, "Version")
    filename = path.name

    splitter = MarkdownTextSplitter(
        chunk_size=500,
        chunk_overlap=80,
        length_function=_count_tokens,
    )

    chunks = splitter.split_text(raw_text)
    total_chunks = len(chunks)

    result: List[Dict[str, Any]] = []
    char_cursor = 0

    for idx, chunk_text in enumerate(chunks):
        # Find approximate char_start in original text
        try:
            char_start = raw_text.index(chunk_text[:40], max(0, char_cursor - 20))
        except ValueError:
            char_start = char_cursor
        char_end = char_start + len(chunk_text)
        char_cursor = char_end

        text_before = raw_text[:char_start]
        section = _find_nearest_heading(text_before, 2)
        subsection = _find_nearest_heading(text_before, 3)

        chunk_id = f"{filename}::chunk_{idx}"

        result.append(
            {
                "chunk_id": chunk_id,
                "text": chunk_text,
                "metadata": {
                    "chunk_id": chunk_id,
                    "source": filename,
                    "policy_title": policy_title,
                    "policy_number": policy_number,
                    "section": section,
                    "subsection": subsection,
                    "chunk_index": idx,
                    "total_chunks": total_chunks,
                    "effective_date": effective_date,
                    "version": version,
                    "char_start": char_start,
                    "char_end": char_end,
                    "token_count": _count_tokens(chunk_text),
                },
            }
        )

    return result
