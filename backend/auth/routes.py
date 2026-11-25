from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.db import models
from backend.auth.utils import (
    verify_password,
    hash_password,
    create_access_token,
    get_current_user,
    require_role,
)
from backend.auth.schemas import LoginRequest, LoginResponse, RegisterRequest, UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )
    token = create_access_token({"sub": user.email})
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        role=user.role,
        name=user.name,
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    body: RegisterRequest,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_role("admin")),
):
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


@router.get("/me", response_model=UserResponse)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user
