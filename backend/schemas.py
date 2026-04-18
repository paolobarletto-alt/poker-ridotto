from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, EmailStr, computed_field, field_validator


class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str
    display_name: Optional[str] = None
    invite_code: str

    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        if not (3 <= len(v) <= 20):
            raise ValueError("Username deve essere tra 3 e 20 caratteri")
        if not v.replace("_", "").isalnum():
            raise ValueError("Username può contenere solo lettere, numeri e underscore")
        return v

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("La password deve essere di almeno 6 caratteri")
        return v

    @field_validator("invite_code")
    @classmethod
    def invite_code_strip(cls, v: str) -> str:
        return v.strip().upper()


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: uuid.UUID
    username: str
    email: str
    display_name: Optional[str]
    chips_balance: int
    avatar_initials: Optional[str]
    is_admin: bool
    created_at: datetime
    total_games: int
    total_wins: int

    model_config = {"from_attributes": True}


class UserPublic(BaseModel):
    id: uuid.UUID
    username: str
    display_name: Optional[str]
    avatar_initials: Optional[str]

    model_config = {"from_attributes": True}


class UserAdminView(BaseModel):
    id: uuid.UUID
    username: str
    email: str
    display_name: Optional[str]
    chips_balance: int
    is_active: bool
    is_admin: bool
    created_at: datetime
    last_login_at: Optional[datetime]
    total_games: int

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenData(BaseModel):
    user_id: Optional[uuid.UUID] = None


# ————— Invite codes —————

class InviteCodeCreate(BaseModel):
    expires_in_days: Optional[int] = None
    max_uses: int = 1


class InviteCodeResponse(BaseModel):
    id: uuid.UUID
    code: str
    created_by: uuid.UUID
    used_by: Optional[uuid.UUID]
    used_at: Optional[datetime]
    expires_at: Optional[datetime]
    max_uses: int
    use_count: int
    is_active: bool
    created_at: datetime
    invite_link: Optional[str] = None

    @computed_field
    @property
    def is_valid(self) -> bool:
        if not self.is_active:
            return False
        if self.use_count >= self.max_uses:
            return False
        if self.expires_at is not None and self.expires_at < datetime.now(timezone.utc):
            return False
        return True

    model_config = {"from_attributes": True}


class AddChipsPayload(BaseModel):
    amount: int
    reason: str
