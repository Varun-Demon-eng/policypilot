from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache

_backend_dir = Path(__file__).resolve().parent
_env_file = _backend_dir / ".env"

class Settings(BaseSettings):
    GROQ_API_KEY: str = ""
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    DATABASE_URL: str = f"sqlite:///{(_backend_dir / 'hr_rag.db').as_posix()}"
    CHROMA_PERSIST_DIR: str = str((_backend_dir.parent / "chroma_db").resolve())
    POLICIES_DIR: str = str((_backend_dir.parent / "policies").resolve())
    COLLECTION_NAME: str = "hr_policies"

    class Config:
        env_file = str(_env_file)
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
