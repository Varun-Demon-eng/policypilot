from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db import models
from backend.auth.utils import require_role
from backend.feedback.schemas import FeedbackRequest, FeedbackResponse

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


@router.post("", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
def submit_feedback(
    body: FeedbackRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("employee", "admin")),
):
    query_log = db.query(models.QueryLog).filter(models.QueryLog.id == body.query_id).first()
    if not query_log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Query log not found",
        )

    feedback = models.Feedback(
        query_id=body.query_id,
        user_id=current_user.id,
        rating=body.rating,
        comment=body.comment,
    )
    db.add(feedback)
    db.commit()

    return FeedbackResponse(success=True)
