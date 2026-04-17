from datetime import datetime
from pydantic import BaseModel, EmailStr
from uuid import UUID

from app.models.user import UserRole


class TokenData(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: UUID
    email: str
    name: str
    role: UserRole
    is_active: bool
    last_login_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    role: UserRole = UserRole.ACCOUNTANT


class UserUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    role: UserRole | None = None
    is_active: bool | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str
