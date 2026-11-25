from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Text, DateTime,
    ForeignKey
)
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from backend.db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="employee")  # employee | admin
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    is_active = Column(Boolean, default=True)

    query_logs = relationship("QueryLog", back_populates="user")
    feedbacks = relationship("Feedback", back_populates="user")
    uploaded_policies = relationship("PolicyDocument", back_populates="uploader")
    chat_sessions = relationship("ChatSession", back_populates="user")


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", back_populates="chat_sessions")
    messages = relationship(
        "QueryLog",
        back_populates="session",
        order_by="QueryLog.timestamp.asc()",
    )


class QueryLog(Base):
    __tablename__ = "query_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=True, index=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    sources = Column(Text, nullable=True)  # JSON string
    confidence_score = Column(Float, nullable=True)
    response_time_ms = Column(Integer, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="query_logs")
    session = relationship("ChatSession", back_populates="messages")
    feedbacks = relationship("Feedback", back_populates="query")


class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, index=True)
    query_id = Column(Integer, ForeignKey("query_logs.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    rating = Column(Integer, nullable=False)   # 1 = thumbs up, 0 = thumbs down
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    query = relationship("QueryLog", back_populates="feedbacks")
    user = relationship("User", back_populates="feedbacks")


class PolicyDocument(Base):
    __tablename__ = "policy_documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), unique=True, index=True, nullable=False)
    title = Column(String(500), nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    uploaded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    chunk_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

    uploader = relationship("User", back_populates="uploaded_policies")
