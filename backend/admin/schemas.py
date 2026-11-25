from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr


class PolicyDocumentResponse(BaseModel):
    id: int
    filename: str
    title: Optional[str]
    uploaded_by: Optional[int]
    uploaded_at: datetime
    chunk_count: int
    is_active: bool

    class Config:
        from_attributes = True


class UploadPolicyResponse(BaseModel):
    filename: str
    chunk_count: int


class QueryLogResponse(BaseModel):
    id: int
    user_id: int
    question: str
    answer: str
    sources: Optional[str]
    confidence_score: Optional[float]
    response_time_ms: Optional[int]
    timestamp: datetime
    feedback_rating: Optional[int] = None

    class Config:
        from_attributes = True


class PaginatedQueryLogsResponse(BaseModel):
    items: List[QueryLogResponse]
    total: int
    page: int
    limit: int


class FeedbackAdminResponse(BaseModel):
    id: int
    query_id: int
    user_id: int
    rating: int
    comment: Optional[str]
    created_at: datetime
    question: Optional[str] = None

    class Config:
        from_attributes = True


class StatsResponse(BaseModel):
    total_queries: int
    helpful_rate: float
    avg_confidence: float
    fallback_rate: float
    avg_response_time_ms: float
    policy_usage: List[dict]


class CreateUserRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "employee"


class UserAdminResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
