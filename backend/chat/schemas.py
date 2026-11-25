from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class ChatRequest(BaseModel):
    question: str
    session_id: Optional[int] = None


class SourceItem(BaseModel):
    policy_title: str
    section: str
    subsection: str
    filename: str


class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceItem]
    confidence_score: float
    confidence_label: str
    query_id: int
    session_id: int
    session_title: str


class ChatSessionSummary(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0

    class Config:
        from_attributes = True


class ChatMessageItem(BaseModel):
    id: int
    question: str
    answer: str
    sources: List[SourceItem] = []
    confidence_score: Optional[float] = None
    confidence_label: str = "fallback"
    timestamp: datetime
    feedback_rating: Optional[int] = None


class ChatSessionDetail(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    messages: List[ChatMessageItem] = []
