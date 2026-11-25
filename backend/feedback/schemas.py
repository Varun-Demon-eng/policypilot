from typing import Optional
from pydantic import BaseModel, field_validator


class FeedbackRequest(BaseModel):
    query_id: int
    rating: int   # 0 or 1
    comment: Optional[str] = None

    @field_validator("rating")
    @classmethod
    def rating_must_be_binary(cls, v):
        if v not in (0, 1):
            raise ValueError("rating must be 0 (thumbs down) or 1 (thumbs up)")
        return v


class FeedbackResponse(BaseModel):
    success: bool
