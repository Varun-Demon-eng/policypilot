"""
Initialize database tables and seed default users.
"""
from sqlalchemy import text
from backend.db.database import engine, SessionLocal, Base
from backend.db import models  # noqa: F401 — registers all ORM models with Base
from backend.auth.utils import hash_password


def init_db():
    # Create all tables
    Base.metadata.create_all(bind=engine)

    # Lightweight migration: ensure query_logs.session_id exists on older DBs
    with engine.begin() as conn:
        cols = [row[1] for row in conn.execute(text("PRAGMA table_info(query_logs)")).fetchall()]
        if cols and "session_id" not in cols:
            conn.execute(
                text("ALTER TABLE query_logs ADD COLUMN session_id INTEGER REFERENCES chat_sessions(id)")
            )

    db = SessionLocal()
    try:
        _seed_users(db)
    finally:
        db.close()


def _seed_users(db):
    seeds = [
        {
            "name": "Administrator",
            "email": "admin@company.com",
            "password": "Admin@123",
            "role": "admin",
        },
        {
            "name": "Employee",
            "email": "employee@company.com",
            "password": "Employee@123",
            "role": "employee",
        },
    ]

    for seed in seeds:
        exists = (
            db.query(models.User)
            .filter(models.User.email == seed["email"])
            .first()
        )
        if not exists:
            user = models.User(
                name=seed["name"],
                email=seed["email"],
                password_hash=hash_password(seed["password"]),
                role=seed["role"],
                is_active=True,
            )
            db.add(user)

    db.commit()


if __name__ == "__main__":
    init_db()
    print("Database initialised and seeded.")
