from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import create_access_token, get_current_user, hash_password, verify_password
from database import get_db
from models import ChipsLedger, User
from schemas import Token, UserLogin, UserRegister, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


def _make_initials(display_name: Optional[str], username: str) -> str:
    source = display_name or username
    parts = source.split()
    if len(parts) >= 2:
        return (parts[0][0] + parts[1][0]).upper()
    return source[:2].upper()


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(payload: UserRegister, db: AsyncSession = Depends(get_db)):
    existing_email = await db.execute(select(User).where(User.email == payload.email))
    if existing_email.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email già registrata")

    existing_username = await db.execute(select(User).where(User.username == payload.username))
    if existing_username.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username già in uso")

    user = User(
        id=uuid.uuid4(),
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
        display_name=payload.display_name,
        avatar_initials=_make_initials(payload.display_name, payload.username),
        chips_balance=5000,
    )
    db.add(user)
    await db.flush()

    ledger = ChipsLedger(
        id=uuid.uuid4(),
        user_id=user.id,
        amount=5000,
        balance_after=5000,
        reason="registration_bonus",
        description="Bonus benvenuto al Ridotto",
    )
    db.add(ledger)
    await db.commit()
    await db.refresh(user)

    access_token = create_access_token({"sub": str(user.id)})
    return Token(access_token=access_token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=Token)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email o password errati")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account disabilitato")

    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)

    access_token = create_access_token({"sub": str(user.id)})
    return Token(access_token=access_token, user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return current_user
