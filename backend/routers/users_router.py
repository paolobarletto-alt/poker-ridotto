from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import get_db
from models import ChipsLedger, User
from schemas import UserPublic, UserResponse

router = APIRouter(prefix="/users", tags=["users"])


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    avatar_initials: Optional[str] = None


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
