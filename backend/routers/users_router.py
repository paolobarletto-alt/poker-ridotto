from __future__ import annotations

import uuid
from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import get_db
from models import ChipsLedger, GameHand, HandAction, PokerTable, TableSeat, User
from schemas import UserPublic, UserResponse

router = APIRouter(prefix="/users", tags=["users"])


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    avatar_initials: Optional[str] = None


@router.get("/online")
async def online_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from presence import get_online_ids
    ids = [uuid.UUID(i) for i in get_online_ids()]
    if not ids:
        return []
    result = await db.execute(
        select(User).where(User.id.in_(ids), User.is_active == True)
    )
    users = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "username": u.username,
            "display_name": u.display_name or u.username,
            "avatar_initials": u.avatar_initials or u.username[:2].upper(),
        }
        for u in users
    ]


@router.get("/me/current-seat")
async def get_current_seat(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Endpoint removed: frontend no longer uses current-seat
    raise HTTPException(status_code=404, detail="Endpoint rimosso")


@router.get("/me/game-history")
async def game_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Endpoint removed: user game history is disabled
    raise HTTPException(status_code=404, detail="Endpoint rimosso")


@router.get("/me/stats")
async def user_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Endpoint removed: user stats disabled
    raise HTTPException(status_code=404, detail="Endpoint rimosso")


@router.get("/me/chips-history")
async def chips_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChipsLedger)
        .where(ChipsLedger.user_id == current_user.id)
        .order_by(ChipsLedger.created_at.desc())
        .limit(50)
    )
    entries = result.scalars().all()
    return [
        {
            "amount": e.amount,
            "balance_after": e.balance_after,
            "reason": e.reason,
            "description": e.description,
            "created_at": e.created_at,
        }
        for e in entries
    ]


@router.get("/{username}", response_model=UserPublic)
async def get_user_public(username: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    return user


@router.put("/me", response_model=UserResponse)
async def update_me(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.display_name is not None:
        current_user.display_name = payload.display_name
    if payload.avatar_initials is not None:
        current_user.avatar_initials = payload.avatar_initials
    await db.commit()
    await db.refresh(current_user)
    return current_user
