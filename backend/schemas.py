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


# ————— Sit & Go schemas —————

class SitGoCreate(BaseModel):
    name: str
    min_players: int
    max_seats: int
    speed: str
    starting_chips: int
    buy_in: int

    @field_validator("name")
    @classmethod
    def name_length(cls, v: str) -> str:
        if not (3 <= len(v) <= 100):
            raise ValueError("Il nome deve essere tra 3 e 100 caratteri")
        return v

    @field_validator("min_players")
    @classmethod
    def min_players_range(cls, v: int) -> int:
        if not (2 <= v <= 8):
            raise ValueError("min_players deve essere tra 2 e 8")
        return v

    @field_validator("max_seats")
    @classmethod
    def max_seats_range(cls, v: int) -> int:
        if not (2 <= v <= 8):
            raise ValueError("max_seats deve essere tra 2 e 8")
        return v

    @field_validator("speed")
    @classmethod
    def speed_valid(cls, v: str) -> str:
        if v not in ("slow", "normal", "fast"):
            raise ValueError("speed deve essere 'slow', 'normal' o 'fast'")
        return v

    @field_validator("starting_chips")
    @classmethod
    def chips_min(cls, v: int) -> int:
        if v < 1000:
            raise ValueError("starting_chips deve essere almeno 1000")
        return v

    @field_validator("buy_in")
    @classmethod
    def buyin_min(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("buy_in deve essere maggiore di 0")
        return v

    def model_post_init(self, __context) -> None:
        if self.max_seats < self.min_players:
            raise ValueError("max_seats deve essere >= min_players")


class SitGoRegistrationInfo(BaseModel):
    user_id: uuid.UUID
    username: str
    avatar_initials: Optional[str]
    registered_at: datetime
    final_position: Optional[int] = None
    player_status: str = "active"
    elimination_reason: Optional[str] = None
    eliminated_at: Optional[datetime] = None
    payout_awarded: int = 0

    model_config = {"from_attributes": True}


class SitGoResponse(BaseModel):
    id: uuid.UUID
    name: str
    min_players: int
    max_seats: int
    speed: str
    starting_chips: int
    buy_in: int
    prize_pool: int
    payout_structure: list[int]
    payout_awarded: bool
    status: str
    blind_schedule: list
    current_blind_level: int
    table_id: Optional[uuid.UUID]
    created_by: uuid.UUID
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    n_registered: int
    max_players: int
    creator_username: str

    model_config = {"from_attributes": True}


class SitGoDetail(SitGoResponse):
    registrations: list[SitGoRegistrationInfo] = []
