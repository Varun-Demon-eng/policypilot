import json
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db import models
from backend.auth.utils import require_role
from backend.rag.pipeline import query_rag, _confidence_label
from backend.chat.schemas import (
    ChatRequest,
    ChatResponse,
    ChatSessionSummary,
    ChatSessionDetail,
    ChatMessageItem,
)

router = APIRouter(prefix="/api/chat", tags=["chat"])


def _make_session_title(first_question: str, max_len: int = 80) -> str:
    """Name a chat session after the first question asked."""
    clean = " ".join(first_question.strip().split())
    if len(clean) <= max_len:
        return clean
    return clean[: max_len - 1].rstrip() + "…"


def _parse_sources(raw_sources: str | None) -> list:
    if not raw_sources:
        return []
    try:
        data = json.loads(raw_sources)
        return data if isinstance(data, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


@router.post("", response_model=ChatResponse, status_code=status.HTTP_200_OK)
def chat(
    body: ChatRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("employee", "admin")),
):
    question = (body.question or "").strip()
    if not question:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Question cannot be empty",
        )

    chat_history = []
    if body.session_id is not None:
        session = (
            db.query(models.ChatSession)
            .filter(
                models.ChatSession.id == body.session_id,
                models.ChatSession.user_id == current_user.id,
            )
            .first()
        )
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Chat session not found",
            )
        # Retrieve the past 5 conversation turns in chronological order
        recent_logs = (
            db.query(models.QueryLog)
            .filter(models.QueryLog.session_id == session.id)
            .order_by(models.QueryLog.timestamp.desc(), models.QueryLog.id.desc())
            .limit(5)
            .all()
        )
        recent_logs.reverse()
        chat_history = [
            {"question": item.question, "answer": item.answer}
            for item in recent_logs
        ]
    else:
        session = models.ChatSession(
            user_id=current_user.id,
            title=_make_session_title(question),
        )
        db.add(session)
        db.flush()

    result = query_rag(question, chat_history=chat_history)

    # Persist query log linked to this session
    log = models.QueryLog(
        user_id=current_user.id,
        session_id=session.id,
        question=question,
        answer=result["answer"],
        sources=json.dumps(result.get("sources", [])),
        confidence_score=result.get("confidence_score"),
        response_time_ms=result.get("response_time_ms"),
    )
    session.updated_at = datetime.now(timezone.utc)
    db.add(log)
    db.commit()
    db.refresh(log)
    db.refresh(session)

    return ChatResponse(
        answer=result["answer"],
        sources=result.get("sources", []),
        confidence_score=result.get("confidence_score", 0.0),
        confidence_label=result.get("confidence_label", "fallback"),
        query_id=log.id,
        session_id=session.id,
        session_title=session.title,
    )


@router.get("/sessions", response_model=List[ChatSessionSummary], status_code=status.HTTP_200_OK)
def list_chat_sessions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("employee", "admin")),
):
    sessions = (
        db.query(models.ChatSession)
        .filter(models.ChatSession.user_id == current_user.id)
        .order_by(models.ChatSession.updated_at.desc(), models.ChatSession.id.desc())
        .all()
    )
    summaries = []
    for s in sessions:
        msg_count = (
            db.query(models.QueryLog)
            .filter(models.QueryLog.session_id == s.id)
            .count()
        )
        summaries.append(
            ChatSessionSummary(
                id=s.id,
                title=s.title,
                created_at=s.created_at,
                updated_at=s.updated_at,
                message_count=msg_count,
            )
        )
    return summaries


@router.get("/sessions/{session_id}", response_model=ChatSessionDetail, status_code=status.HTTP_200_OK)
def get_chat_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("employee", "admin")),
):
    session = (
        db.query(models.ChatSession)
        .filter(
            models.ChatSession.id == session_id,
            models.ChatSession.user_id == current_user.id,
        )
        .first()
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found",
        )

    logs = (
        db.query(models.QueryLog)
        .filter(models.QueryLog.session_id == session.id)
        .order_by(models.QueryLog.timestamp.asc(), models.QueryLog.id.asc())
        .all()
    )

    items = []
    for log in logs:
        fb = (
            db.query(models.Feedback)
            .filter(
                models.Feedback.query_id == log.id,
                models.Feedback.user_id == current_user.id,
            )
            .first()
        )
        score = log.confidence_score if log.confidence_score is not None else 0.0
        items.append(
            ChatMessageItem(
                id=log.id,
                question=log.question,
                answer=log.answer,
                sources=_parse_sources(log.sources),
                confidence_score=log.confidence_score,
                confidence_label=_confidence_label(score),
                timestamp=log.timestamp,
                feedback_rating=fb.rating if fb else None,
            )
        )

    return ChatSessionDetail(
        id=session.id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        messages=items,
    )


@router.delete("/sessions/{session_id}", status_code=status.HTTP_200_OK)
def delete_chat_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("employee", "admin")),
):
    session = (
        db.query(models.ChatSession)
        .filter(
            models.ChatSession.id == session_id,
            models.ChatSession.user_id == current_user.id,
        )
        .first()
    )
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat session not found",
        )

    # Unlink query logs from the session (preserving admin audit logs)
    db.query(models.QueryLog).filter(models.QueryLog.session_id == session.id).update(
        {"session_id": None}, synchronize_session=False
    )
    db.delete(session)
    db.commit()
    return {"detail": "Chat session deleted"}
