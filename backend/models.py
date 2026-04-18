from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import (
    BigInteger, Boolean, DateTime, ForeignKey,
    Integer, String, Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


def _now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    chips_balance: Mapped[int] = mapped_column(BigInteger, default=5000)
    avatar_initials: Mapped[Optional[str]] = mapped_column(String(3), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    total_games: Mapped[int] = mapped_column(Integer, default=0)
    total_hands: Mapped[int] = mapped_column(Integer, default=0)
    total_wins: Mapped[int] = mapped_column(Integer, default=0)
    total_losses: Mapped[int] = mapped_column(Integer, default=0)
    biggest_pot: Mapped[int] = mapped_column(BigInteger, default=0)

    ledger_entries: Mapped[List[ChipsLedger]] = relationship(
        "ChipsLedger", back_populates="user", lazy="select"
    )


class ChipsLedger(Base):
    __tablename__ = "chips_ledger"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    balance_after: Mapped[int] = mapped_column(BigInteger, nullable=False)
    reason: Mapped[str] = mapped_column(String(50), nullable=False)
    game_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    user: Mapped[User] = relationship("User", back_populates="ledger_entries")
