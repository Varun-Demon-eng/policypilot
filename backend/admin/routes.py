import json
import os
import shutil
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from backend.config import settings
from backend.db.database import get_db
from backend.db import models
from backend.auth.utils import hash_password, require_role
from backend.rag.embedder import delete_policy, ingest_policy
from backend.admin.schemas import (
    CreateUserRequest,
    FeedbackAdminResponse,
    PaginatedQueryLogsResponse,
    PolicyDocumentResponse,
    QueryLogResponse,
    StatsResponse,
    UploadPolicyResponse,
    UserAdminResponse,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])

_admin_dep = Depends(require_role("admin"))


def _policies_dir() -> Path:
    path = Path(settings.POLICIES_DIR).resolve()
    path.mkdir(parents=True, exist_ok=True)
    return path


# ---------------------------------------------------------------------------
# Policy management
# ---------------------------------------------------------------------------

@router.post(
    "/policies/upload",
    response_model=UploadPolicyResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[_admin_dep],
)
async def upload_policy(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin")),
):
    if not file.filename.endswith(".md"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only Markdown (.md) files are accepted",
        )

    policies_dir = _policies_dir()
    dest = policies_dir / file.filename

    contents = await file.read()
    dest.write_bytes(contents)

    # Create or reactivate PolicyDocument record
    policy_doc = (
        db.query(models.PolicyDocument)
        .filter(models.PolicyDocument.filename == file.filename)
        .first()
    )
    if policy_doc:
        policy_doc.is_active = True
        policy_doc.uploaded_by = current_user.id
    else:
        policy_doc = models.PolicyDocument(
            filename=file.filename,
            uploaded_by=current_user.id,
        )
        db.add(policy_doc)
    db.flush()

    chunk_count = ingest_policy(str(dest), policy_doc.id)

    policy_doc.chunk_count = chunk_count
    # Extract title from first line
    first_line = contents.decode("utf-8", errors="replace").split("\n")[0]
    policy_doc.title = first_line.lstrip("#").strip() or file.filename

    db.commit()
    db.refresh(policy_doc)

    return UploadPolicyResponse(filename=file.filename, chunk_count=chunk_count)


@router.delete("/policies/{policy_identifier}", status_code=status.HTTP_200_OK, dependencies=[_admin_dep])
def remove_policy(policy_identifier: str, db: Session = Depends(get_db)):
    q = db.query(models.PolicyDocument)
    if policy_identifier.isdigit():
        policy_doc = q.filter(
            (models.PolicyDocument.id == int(policy_identifier))
            | (models.PolicyDocument.filename == policy_identifier)
        ).first()
    else:
        policy_doc = q.filter(models.PolicyDocument.filename == policy_identifier).first()

    if not policy_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Policy not found")

    filename = policy_doc.filename

    # Remove from ChromaDB
    delete_policy(filename)

    # Remove from disk
    policies_dir = _policies_dir()
    file_path = policies_dir / filename
    if file_path.exists():
        file_path.unlink()

    # Mark inactive
    policy_doc.is_active = False
    db.commit()

    return {"detail": f"{filename} deleted successfully"}


@router.get("/policies", response_model=List[PolicyDocumentResponse], dependencies=[_admin_dep])
def list_policies(db: Session = Depends(get_db)):
    return db.query(models.PolicyDocument).all()


# ---------------------------------------------------------------------------
# Query logs
# ---------------------------------------------------------------------------

@router.get("/queries", response_model=PaginatedQueryLogsResponse, dependencies=[_admin_dep])
@router.get("/logs", response_model=PaginatedQueryLogsResponse, dependencies=[_admin_dep])
def get_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    min_confidence: Optional[float] = Query(None, ge=0.0, le=1.0),
    db: Session = Depends(get_db),
):
    q = db.query(models.QueryLog)
    if min_confidence is not None:
        q = q.filter(models.QueryLog.confidence_score >= min_confidence)
    total = q.count()
    logs = q.order_by(models.QueryLog.timestamp.desc()).offset((page - 1) * limit).limit(limit).all()

    result = []
    for log in logs:
        fb = (
            db.query(models.Feedback)
            .filter(models.Feedback.query_id == log.id)
            .first()
        )
        entry = QueryLogResponse(
            id=log.id,
            user_id=log.user_id,
            question=log.question,
            answer=log.answer,
            sources=log.sources,
            confidence_score=log.confidence_score,
            response_time_ms=log.response_time_ms,
            timestamp=log.timestamp,
            feedback_rating=fb.rating if fb else None,
        )
        result.append(entry)
    return PaginatedQueryLogsResponse(
        items=result,
        total=total,
        page=page,
        limit=limit,
    )


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@router.get("/stats", response_model=StatsResponse, dependencies=[_admin_dep])
def get_stats(db: Session = Depends(get_db)):
    total_queries = db.query(models.QueryLog).count()

    all_logs = db.query(models.QueryLog).all()

    fallback_count = sum(
        1 for l in all_logs if (l.confidence_score or 0.0) < 0.45
    )
    fallback_rate = (fallback_count / total_queries * 100) if total_queries else 0.0

    scores = [l.confidence_score for l in all_logs if l.confidence_score is not None]
    avg_confidence = float(sum(scores) / len(scores)) if scores else 0.0

    times = [l.response_time_ms for l in all_logs if l.response_time_ms is not None]
    avg_response_time_ms = float(sum(times) / len(times)) if times else 0.0

    # Helpful rate from feedback
    all_feedback = db.query(models.Feedback).all()
    helpful_count = sum(1 for f in all_feedback if f.rating == 1)
    helpful_rate = (helpful_count / len(all_feedback) * 100) if all_feedback else 0.0

    # Policy usage: count queries referencing each policy filename in sources
    policy_usage_map: dict = {}
    for log in all_logs:
        if log.sources:
            try:
                sources = json.loads(log.sources)
                seen = set()
                for src in sources:
                    fn = src.get("filename", "")
                    if fn and fn not in seen:
                        policy_usage_map[fn] = policy_usage_map.get(fn, 0) + 1
                        seen.add(fn)
            except (json.JSONDecodeError, TypeError):
                pass

    policy_usage = [
        {"filename": k, "query_count": v}
        for k, v in sorted(policy_usage_map.items(), key=lambda x: -x[1])
    ]

    return StatsResponse(
        total_queries=total_queries,
        helpful_rate=round(helpful_rate, 2),
        avg_confidence=round(avg_confidence, 4),
        fallback_rate=round(fallback_rate, 2),
        avg_response_time_ms=round(avg_response_time_ms, 2),
        policy_usage=policy_usage,
    )


# ---------------------------------------------------------------------------
# Feedback
# ---------------------------------------------------------------------------

@router.get("/feedback", response_model=List[FeedbackAdminResponse], dependencies=[_admin_dep])
def get_all_feedback(db: Session = Depends(get_db)):
    feedbacks = db.query(models.Feedback).order_by(models.Feedback.created_at.desc()).all()
    result = []
    for fb in feedbacks:
        log = db.query(models.QueryLog).filter(models.QueryLog.id == fb.query_id).first()
        result.append(
            FeedbackAdminResponse(
                id=fb.id,
                query_id=fb.query_id,
                user_id=fb.user_id,
                rating=fb.rating,
                comment=fb.comment,
                created_at=fb.created_at,
                question=log.question if log else None,
            )
        )
    return result


# ---------------------------------------------------------------------------
# User management
# ---------------------------------------------------------------------------

@router.post(
    "/users",
    response_model=UserAdminResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[_admin_dep],
)
def create_user(body: CreateUserRequest, db: Session = Depends(get_db)):
    if len(body.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Password must be at least 8 characters",
        )
    if body.role not in ("employee", "admin"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Role must be 'employee' or 'admin'",
        )
    existing = db.query(models.User).filter(models.User.email == body.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    user = models.User(
        name=body.name,
        email=body.email,
        password_hash=hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/users", response_model=List[UserAdminResponse], dependencies=[_admin_dep])
def list_users(db: Session = Depends(get_db)):
    return db.query(models.User).order_by(models.User.created_at.asc()).all()


@router.delete("/users/{user_id}", status_code=status.HTTP_200_OK, dependencies=[_admin_dep])
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("admin")),
):
    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if target_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own admin account while logged in",
        )

    # 1. Policies uploaded by this user -> set uploaded_by to None
    db.query(models.PolicyDocument).filter(models.PolicyDocument.uploaded_by == user_id).update({"uploaded_by": None})

    # 2. Feedback left by this user
    db.query(models.Feedback).filter(models.Feedback.user_id == user_id).delete(synchronize_session=False)

    # 3. Query logs by this user (and feedback attached to those queries)
    user_query_ids = [q.id for q in db.query(models.QueryLog.id).filter(models.QueryLog.user_id == user_id).all()]
    if user_query_ids:
        db.query(models.Feedback).filter(models.Feedback.query_id.in_(user_query_ids)).delete(synchronize_session=False)
        db.query(models.QueryLog).filter(models.QueryLog.user_id == user_id).delete(synchronize_session=False)

    # 4. Chat sessions owned by this user
    db.query(models.ChatSession).filter(models.ChatSession.user_id == user_id).delete(synchronize_session=False)

    db.delete(target_user)
    db.commit()

    return {"detail": f"User '{target_user.name}' ({target_user.email}) deleted successfully"}
