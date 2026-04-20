from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, List, Optional

from sqlalchemy import (
    BigInteger, Boolean, DateTime, ForeignKey,
    Integer, JSON, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


def _now():
    return datetime.now(timezone.utc)


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS — schedule blind per Sit & Go
# ─────────────────────────────────────────────────────────────────────────────

BLIND_SCHEDULES: dict[str, list[dict[str, Any]]] = {
    "slow": [
        {"level": 1, "small_blind":  25, "big_blind":   50, "duration_seconds": 900},
        {"level": 2, "small_blind":  50, "big_blind":  100, "duration_seconds": 900},
        {"level": 3, "small_blind":  75, "big_blind":  150, "duration_seconds": 900},
        {"level": 4, "small_blind": 150, "big_blind":  300, "duration_seconds": 900},
        {"level": 5, "small_blind": 300, "big_blind":  600, "duration_seconds": 900},
    ],
    "normal": [
        {"level": 1, "small_blind":  25, "big_blind":   50, "duration_seconds": 600},
        {"level": 2, "small_blind":  50, "big_blind":  100, "duration_seconds": 600},
        {"level": 3, "small_blind":  75, "big_blind":  150, "duration_seconds": 600},
        {"level": 4, "small_blind": 150, "big_blind":  300, "duration_seconds": 600},
        {"level": 5, "small_blind": 300, "big_blind":  600, "duration_seconds": 600},
    ],
    "fast": [
        {"level": 1, "small_blind":  25, "big_blind":   50, "duration_seconds": 300},
        {"level": 2, "small_blind":  50, "big_blind":  100, "duration_seconds": 300},
        {"level": 3, "small_blind": 100, "big_blind":  200, "duration_seconds": 300},
        {"level": 4, "small_blind": 200, "big_blind":  400, "duration_seconds": 300},
        {"level": 5, "small_blind": 400, "big_blind":  800, "duration_seconds": 300},
    ],
}

# Timer d'azione in secondi per ogni velocità
ACTION_TIMERS: dict[str, int] = {"slow": 30, "normal": 20, "fast": 10}


def default_blind_schedule(speed: str) -> list[dict[str, Any]]:
    """Restituisce il blind schedule standard per la velocità indicata."""
    return BLIND_SCHEDULES.get(speed, BLIND_SCHEDULES["normal"])


# ─────────────────────────────────────────────────────────────────────────────
# USER
# ─────────────────────────────────────────────────────────────────────────────

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
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    total_games: Mapped[int] = mapped_column(Integer, default=0)
    total_hands: Mapped[int] = mapped_column(Integer, default=0)
    total_wins: Mapped[int] = mapped_column(Integer, default=0)
    total_losses: Mapped[int] = mapped_column(Integer, default=0)
    biggest_pot: Mapped[int] = mapped_column(BigInteger, default=0)

    # ── Relazioni ──────────────────────────────────────────────
    ledger_entries: Mapped[List[ChipsLedger]] = relationship(
        "ChipsLedger", back_populates="user", lazy="select"
    )
    tables_created: Mapped[List[PokerTable]] = relationship(
        "PokerTable", back_populates="creator",
        foreign_keys="PokerTable.created_by", lazy="select"
    )
    table_seats: Mapped[List[TableSeat]] = relationship(
        "TableSeat", back_populates="user", lazy="select"
    )
    sitgo_registrations: Mapped[List[SitGoRegistration]] = relationship(
        "SitGoRegistration", back_populates="user", lazy="select"
    )


# ─────────────────────────────────────────────────────────────────────────────
# CHIPS LEDGER
# ─────────────────────────────────────────────────────────────────────────────

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


# ─────────────────────────────────────────────────────────────────────────────
# INVITE CODE
# ─────────────────────────────────────────────────────────────────────────────

class InviteCode(Base):
    __tablename__ = "invite_codes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(12), unique=True, nullable=False, index=True)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    used_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    max_uses: Mapped[int] = mapped_column(Integer, default=1)
    use_count: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    creator: Mapped[User] = relationship("User", foreign_keys=[created_by])
    used_by_user: Mapped[Optional[User]] = relationship("User", foreign_keys=[used_by])


# ─────────────────────────────────────────────────────────────────────────────
# POKER TABLE
# ─────────────────────────────────────────────────────────────────────────────

class PokerTable(Base):
    __tablename__ = "poker_tables"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    # "cash" | "sitgo"
    table_type: Mapped[str] = mapped_column(String(20), nullable=False)
    min_players: Mapped[int] = mapped_column(Integer, nullable=False)
    max_seats: Mapped[int] = mapped_column(Integer, nullable=False)
    # "slow" | "normal" | "fast"  → timer d'azione: 30s / 20s / 10s
    speed: Mapped[str] = mapped_column(String(20), nullable=False, default="normal")
    small_blind: Mapped[int] = mapped_column(BigInteger, nullable=False)
    big_blind: Mapped[int] = mapped_column(BigInteger, nullable=False)
    min_buyin: Mapped[int] = mapped_column(BigInteger, nullable=False)
    # per cash game: massimo buy-in; per sit&go: starting chips
    max_buyin: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    # "waiting" | "running" | "paused" | "closed"
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="waiting")
    is_private: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    # ── Relazioni ──────────────────────────────────────────────
    creator: Mapped[User] = relationship(
        "User", back_populates="tables_created", foreign_keys=[created_by]
    )
    seats: Mapped[List[TableSeat]] = relationship(
        "TableSeat", back_populates="table", lazy="select",
        cascade="all, delete-orphan"
    )
    hands: Mapped[List[GameHand]] = relationship(
        "GameHand", back_populates="table", lazy="select",
        cascade="all, delete-orphan"
    )


# ─────────────────────────────────────────────────────────────────────────────
# TABLE SEAT
# ─────────────────────────────────────────────────────────────────────────────

class TableSeat(Base):
    __tablename__ = "table_seats"

    __table_args__ = (
        # Un posto è occupato da un solo giocatore per volta
        UniqueConstraint("table_id", "seat_number", name="uq_table_seat"),
        # Un giocatore può sedersi a un tavolo solo una volta
        UniqueConstraint("table_id", "user_id", name="uq_table_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    table_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("poker_tables.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    # 0-8
    seat_number: Mapped[int] = mapped_column(Integer, nullable=False)
    # chips portate al tavolo, aggiornate mano per mano
    stack: Mapped[int] = mapped_column(BigInteger, nullable=False)
    # "active" | "sitting_out" | "away"
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    # ── Relazioni ──────────────────────────────────────────────
    table: Mapped[PokerTable] = relationship("PokerTable", back_populates="seats")
    user: Mapped[User] = relationship("User", back_populates="table_seats")


# ─────────────────────────────────────────────────────────────────────────────
# GAME HAND
# ─────────────────────────────────────────────────────────────────────────────

class GameHand(Base):
    __tablename__ = "game_hands"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    table_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("poker_tables.id"), nullable=False)
    hand_number: Mapped[int] = mapped_column(Integer, nullable=False)
    dealer_seat: Mapped[int] = mapped_column(Integer, nullable=False)
    small_blind_seat: Mapped[int] = mapped_column(Integer, nullable=False)
    big_blind_seat: Mapped[int] = mapped_column(Integer, nullable=False)
    # es. ["A♠","K♥","Q♦","J♣","T♠"]  — da 0 a 5 elementi
    community_cards: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    pot: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    winner_seat: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # es. "Scala Reale", "Full A su K" …
    winning_hand_description: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Relazioni ──────────────────────────────────────────────
    table: Mapped[PokerTable] = relationship("PokerTable", back_populates="hands")
    actions: Mapped[List[HandAction]] = relationship(
        "HandAction", back_populates="hand", lazy="select",
        cascade="all, delete-orphan", order_by="HandAction.created_at"
    )


# ─────────────────────────────────────────────────────────────────────────────
# HAND ACTION
# ─────────────────────────────────────────────────────────────────────────────

class HandAction(Base):
    __tablename__ = "hand_actions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hand_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("game_hands.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    seat_number: Mapped[int] = mapped_column(Integer, nullable=False)
    # "preflop" | "flop" | "turn" | "river"
    phase: Mapped[str] = mapped_column(String(20), nullable=False)
    # "fold" | "check" | "call" | "raise" | "allin"
    action: Mapped[str] = mapped_column(String(20), nullable=False)
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    stack_before: Mapped[int] = mapped_column(BigInteger, nullable=False)
    stack_after: Mapped[int] = mapped_column(BigInteger, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    # ── Relazioni ──────────────────────────────────────────────
    hand: Mapped[GameHand] = relationship("GameHand", back_populates="actions")
    user: Mapped[User] = relationship("User")


# ─────────────────────────────────────────────────────────────────────────────
# SIT & GO TOURNAMENT
# ─────────────────────────────────────────────────────────────────────────────

class SitGoTournament(Base):
    __tablename__ = "sitgo_tournaments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    min_players: Mapped[int] = mapped_column(Integer, nullable=False)
    max_seats: Mapped[int] = mapped_column(Integer, nullable=False)
    starting_chips: Mapped[int] = mapped_column(BigInteger, nullable=False)
    # "slow" | "normal" | "fast"
    # slow  → livelli da 900s, timer 30s
    # normal→ livelli da 600s, timer 20s
    # fast  → livelli da 300s, timer 10s
    speed: Mapped[str] = mapped_column(String(20), nullable=False, default="normal")
    # "registering" | "running" | "finished"
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="registering")
    # lista di {level, small_blind, big_blind, duration_seconds}
    # popolata automaticamente in base alla speed al momento della creazione
    blind_schedule: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    current_blind_level: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    level_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # tavolo fisico associato al torneo (creato quando il torneo parte)
    table_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("poker_tables.id"), nullable=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Relazioni ──────────────────────────────────────────────
    registrations: Mapped[List[SitGoRegistration]] = relationship(
        "SitGoRegistration", back_populates="tournament", lazy="select",
        cascade="all, delete-orphan"
    )
    table: Mapped[Optional[PokerTable]] = relationship("PokerTable", foreign_keys=[table_id])
    creator: Mapped[User] = relationship("User", foreign_keys=[created_by])


# ─────────────────────────────────────────────────────────────────────────────
# SIT & GO REGISTRATION
# ─────────────────────────────────────────────────────────────────────────────

class SitGoRegistration(Base):
    __tablename__ = "sitgo_registrations"

    __table_args__ = (
        # Un giocatore può iscriversi a un torneo una sola volta
        UniqueConstraint("tournament_id", "user_id", name="uq_sitgo_registration"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tournament_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sitgo_tournaments.id"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    # 1 = vincitore, null = ancora in gioco / torneo non finito
    final_position: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    chips_at_end: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    registered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    # ── Relazioni ──────────────────────────────────────────────
    tournament: Mapped[SitGoTournament] = relationship("SitGoTournament", back_populates="registrations")
    user: Mapped[User] = relationship("User", back_populates="sitgo_registrations")
