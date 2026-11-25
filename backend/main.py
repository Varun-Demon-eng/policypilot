"""
FastAPI application entry point.
"""
import os
import sys
from pathlib import Path
from contextlib import asynccontextmanager

# Ensure both project root and backend dir are in sys.path
_current_dir = Path(__file__).resolve().parent
_root_dir = _current_dir.parent
for p in (str(_root_dir), str(_current_dir)):
    if p not in sys.path:
        sys.path.insert(0, p)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.db.init_db import init_db
from backend.db.database import SessionLocal
from backend.db import models
from backend.rag.embedder import ingest_policy

from backend.auth.routes import router as auth_router
from backend.chat.routes import router as chat_router
from backend.feedback.routes import router as feedback_router
from backend.admin.routes import router as admin_router


# ---------------------------------------------------------------------------
# Startup logic
# ---------------------------------------------------------------------------

def _auto_ingest_policies():
    """Ingest any .md files in /policies/ not yet tracked in PolicyDocument."""
    policies_dir = Path(settings.POLICIES_DIR).resolve()
    if not policies_dir.exists():
        return

    db = SessionLocal()
    try:
        tracked = {
            row.filename
            for row in db.query(models.PolicyDocument.filename).all()
        }
        for md_file in policies_dir.glob("*.md"):
            if md_file.name not in tracked:
                policy_doc = models.PolicyDocument(
                    filename=md_file.name,
                    title=md_file.stem,
                    is_active=True,
                )
                db.add(policy_doc)
                db.flush()
                chunk_count = ingest_policy(str(md_file), policy_doc.id)
                policy_doc.chunk_count = chunk_count
                db.commit()
                print(f"[startup] Ingested {md_file.name} → {chunk_count} chunks")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    _auto_ingest_policies()
    yield
    # Shutdown (nothing to tear down for now)


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="HR RAG API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(feedback_router)
app.include_router(admin_router)


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}
