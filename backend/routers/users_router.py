from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import get_db
from models import ChipsLedger, GameHand, HandAction, PlayerGameSession, TableSeat, User
from schemas import UserPublic, UserResponse
from datetime import datetime, timedelta, timezone

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
    result = await db.execute(
        select(TableSeat)
        .where(
            TableSeat.user_id == current_user.id,
            TableSeat.status != "away",
        )
        .limit(1)
    )
    seat = result.scalar_one_or_none()
    if seat is None:
        return None
    return {"table_id": str(seat.table_id), "seat_number": seat.seat_number}


@router.get("/me/game-history")
async def game_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sessions_result = await db.execute(
        select(PlayerGameSession)
        .where(PlayerGameSession.user_id == current_user.id)
        .order_by(PlayerGameSession.started_at.desc())
        .limit(50)
    )
    sessions = sessions_result.scalars().all()
    now = datetime.now(timezone.utc)

    result = []
    for s in sessions:
        end_at = s.ended_at or now
        delta = end_at - s.started_at if s.started_at else None
        duration_minutes = max(0, int(delta.total_seconds() / 60)) if delta else None
        result.append({
            "date": s.started_at.date().isoformat() if s.started_at else None,
            "time": s.started_at.strftime("%H:%M") if s.started_at else None,
            "table_name": s.table_name,
            "table_type": s.table_type,
            "hands_played": s.hands_played,
            "duration_minutes": duration_minutes,
            "result_chips": s.result_chips,
        })

    return result


@router.get("/me/stats")
async def user_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    uid = current_user.id

    total_hands: int = await db.scalar(
        select(func.count(distinct(HandAction.hand_id)))
        .where(HandAction.user_id == uid, HandAction.phase == "preflop")
    ) or 0

    if total_hands == 0:
        return {
            "total_hands": 0,
            "vpip": None, "pfr": None, "af": None,
            "win_rate": None, "biggest_pot": None, "net_result": None,
        }

    vpip_hands: int = await db.scalar(
        select(func.count(distinct(HandAction.hand_id)))
        .where(
            HandAction.user_id == uid,
            HandAction.phase == "preflop",
            HandAction.action.in_(["call", "raise", "allin"]),
        )
    ) or 0

    pfr_hands: int = await db.scalar(
        select(func.count(distinct(HandAction.hand_id)))
        .where(
            HandAction.user_id == uid,
            HandAction.phase == "preflop",
            HandAction.action.in_(["raise", "allin"]),
        )
    ) or 0

    af_aggro: int = await db.scalar(
        select(func.count())
        .where(
            HandAction.user_id == uid,
            HandAction.phase != "preflop",
            HandAction.action.in_(["raise", "allin"]),
        )
    ) or 0

    af_call: int = await db.scalar(
        select(func.count())
        .where(
            HandAction.user_id == uid,
            HandAction.phase != "preflop",
            HandAction.action == "call",
        )
    ) or 0

    # Hands won: winner_seat matches user's seat_number in that hand
    won_subq = (
        select(GameHand.id)
        .join(HandAction, HandAction.hand_id == GameHand.id)
        .where(
            HandAction.user_id == uid,
            GameHand.winner_seat == HandAction.seat_number,
        )
        .distinct()
        .subquery()
    )
    won_count: int = await db.scalar(select(func.count()).select_from(won_subq)) or 0

    biggest_pot: int = await db.scalar(
        select(func.max(GameHand.pot))
        .join(HandAction, HandAction.hand_id == GameHand.id)
        .where(
            HandAction.user_id == uid,
            GameHand.winner_seat == HandAction.seat_number,
        )
    ) or 0

    net_result: int = await db.scalar(
        select(func.sum(ChipsLedger.amount))
        .where(
            ChipsLedger.user_id == uid,
            ChipsLedger.reason.in_(["hand_win", "hand_loss", "sitgo_win", "sitgo_loss"]),
        )
    ) or 0

    vpip = round(vpip_hands / total_hands * 100, 1) if total_hands >= 20 else None
    pfr = round(pfr_hands / total_hands * 100, 1) if total_hands >= 20 else None
    af = round(af_aggro / af_call, 2) if (af_call > 0 and total_hands >= 20) else (0.0 if total_hands >= 20 else None)

    return {
        "total_hands": total_hands,
        "vpip": vpip,
        "pfr": pfr,
        "af": af,
        "win_rate": round(won_count / total_hands * 100, 1),
        "biggest_pot": biggest_pot,
        "net_result": net_result,
    }


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


@router.get('/race')
async def race_leaderboard(period: str = 'weekly', db: AsyncSession = Depends(get_db)):
    """Return profit leaderboard for all users for the given period: weekly|monthly|annual"""
    now = datetime.now(timezone.utc)
    if period == 'weekly':
        start = now - timedelta(days=7)
    elif period == 'monthly':
        start = now - timedelta(days=30)
    elif period == 'annual' or period == 'yearly' or period == 'year':
        start = now - timedelta(days=365)
    else:
        raise HTTPException(status_code=400, detail='Invalid period')

    # Profitto Race: somma del risultato delle sessioni (vincite - perdite),
    # senza movimenti esterni come ricariche admin.
    profit_subq = (
        select(
            PlayerGameSession.user_id.label('user_id'),
            func.coalesce(func.sum(PlayerGameSession.result_chips), 0).label('profit')
        )
        .where(PlayerGameSession.started_at >= start)
        .group_by(PlayerGameSession.user_id)
        .subquery()
    )

    q = (
        select(User, func.coalesce(profit_subq.c.profit, 0).label('profit'))
        .outerjoin(profit_subq, User.id == profit_subq.c.user_id)
        .order_by(func.coalesce(profit_subq.c.profit, 0).desc())
    )

    res = await db.execute(q)
    rows = []
    for user_row, profit in res.all():
        rows.append({
            'username': user_row.username,
            'display_name': user_row.display_name or user_row.username,
            'avatar_initials': user_row.avatar_initials or (user_row.username[:2].upper() if user_row.username else '?'),
            'profit': int(profit) if profit is not None else 0,
        })
    return rows


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
