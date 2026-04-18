from __future__ import annotations

import secrets
import string
import uuid
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from config import settings
from database import get_db
from models import ChipsLedger, InviteCode, User
from schemas import (
    AddChipsPayload,
    InviteCodeCreate,
    InviteCodeResponse,
    UserAdminView,
)

router = APIRouter(prefix="/admin", tags=["admin"])

_CODE_CHARS = string.ascii_uppercase + string.digits


def _generate_code(length: int = 12) -> str:
    return "".join(secrets.choice(_CODE_CHARS) for _ in range(length))


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accesso riservato agli amministratori",
        )
    return current_user


def _invite_link(code: str) -> str:
    return f"{settings.FRONTEND_URL}/join?code={code}"


def _to_response(invite: InviteCode, include_link: bool = False) -> InviteCodeResponse:
    data = InviteCodeResponse.model_validate(invite)
    if include_link:
        data.invite_link = _invite_link(invite.code)
    return data


# ————— Invite codes —————

@router.post("/invites", response_model=InviteCodeResponse, status_code=status.HTTP_201_CREATED)
async def create_invite(
    payload: InviteCodeCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    # Ensure uniqueness (collision extremely unlikely but guard anyway)
    for _ in range(5):
        code = _generate_code()
        existing = await db.execute(select(InviteCode).where(InviteCode.code == code))
        if not existing.scalar_one_or_none():
            break
    else:
        raise HTTPException(status_code=500, detail="Impossibile generare codice univoco")

    expires_at = None
    if payload.expires_in_days is not None:
        expires_at = datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days)

    invite = InviteCode(
        id=uuid.uuid4(),
        code=code,
        created_by=admin.id,
        max_uses=payload.max_uses,
        expires_at=expires_at,
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)

    return _to_response(invite, include_link=True)


@router.get("/invites", response_model=List[InviteCodeResponse])
async def list_invites(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(
        select(InviteCode).order_by(InviteCode.created_at.desc())
    )
    invites = result.scalars().all()
    return [_to_response(inv, include_link=True) for inv in invites]


@router.delete("/invites/{code}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_invite(
    code: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(select(InviteCode).where(InviteCode.code == code.upper()))
    invite = result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=404, detail="Codice non trovato")
    invite.is_active = False
    await db.commit()


# ————— User management —————

@router.get("/users", response_model=List[UserAdminView])
async def list_users(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return result.scalars().all()


@router.patch("/users/{user_id}/toggle-active", response_model=UserAdminView)
async def toggle_user_active(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Non puoi disabilitare te stesso")
    user.is_active = not user.is_active
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/users/{user_id}/add-chips", response_model=UserAdminView)
async def add_chips(
    user_id: uuid.UUID,
    payload: AddChipsPayload,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if payload.amount == 0:
        raise HTTPException(status_code=400, detail="L'importo non può essere zero")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Utente non trovato")

    user.chips_balance += payload.amount
    if user.chips_balance < 0:
        raise HTTPException(status_code=400, detail="Saldo insufficiente per questa operazione")

    entry = ChipsLedger(
        id=uuid.uuid4(),
        user_id=user.id,
        amount=payload.amount,
        balance_after=user.chips_balance,
        reason="admin_adjustment",
        description=f"[Admin: {admin.username}] {payload.reason}",
    )
    db.add(entry)
    await db.commit()
    await db.refresh(user)
    return user
