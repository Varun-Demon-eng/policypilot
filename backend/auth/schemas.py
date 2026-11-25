from typing import Optional
from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "employee"


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool

    class Config:
        from_attributes = True
