from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator


class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str
    display_name: Optional[str] = None

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


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenData(BaseModel):
    user_id: Optional[uuid.UUID] = None
