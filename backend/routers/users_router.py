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
from datetime import datetime, timedelta, timezone
from sqlalchemy import func

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
    uid = current_user.id

    # 1. Find all hands the user participated in (via HandAction)
    actions_result = await db.execute(
        select(HandAction)
        .where(HandAction.user_id == uid)
        .order_by(HandAction.hand_id, HandAction.created_at.asc())
        .limit(5000)
    )
    all_actions = actions_result.scalars().all()
    if not all_actions:
        return []

    # Build per-hand stack diff from HandAction as fallback P&L
    actions_by_hand: dict = defaultdict(list)
    for a in all_actions:
        actions_by_hand[a.hand_id].append(a)

    hand_ids = list(actions_by_hand.keys())

    # 2. Fetch GameHand + PokerTable for all those hands
    hands_result = await db.execute(
        select(GameHand, PokerTable)
        .join(PokerTable, GameHand.table_id == PokerTable.id)
        .where(GameHand.id.in_(hand_ids))
        .order_by(GameHand.started_at.asc())
    )
    hands_with_tables = hands_result.all()
    if not hands_with_tables:
        return []

    hand_meta: dict = {str(hand.id): (hand, table) for hand, table in hands_with_tables}

    # 3. Fetch ChipsLedger P&L entries for these hands (most accurate)
    ledger_result = await db.execute(
        select(ChipsLedger)
        .where(
            ChipsLedger.user_id == uid,
            ChipsLedger.game_id.in_(hand_ids),
            ChipsLedger.reason.in_(["hand_win", "hand_loss"]),
        )
    )
    ledger_by_hand: dict = defaultdict(int)
    for entry in ledger_result.scalars().all():
        ledger_by_hand[str(entry.game_id)] += entry.amount

    # 4. Group by (table_id, date) → sessions
    sessions: dict = defaultdict(lambda: {
        "table_name": "", "table_type": "", "date": None,
        "time": None, "pnl": 0, "hand_ids": [], "first_at": None, "last_at": None,
    })

    for hid_raw, acts in actions_by_hand.items():
        hid = str(hid_raw)
        meta = hand_meta.get(hid)
        if not meta:
            continue
        hand, table = meta
        date_key = hand.started_at.date() if hand.started_at else None
        key = (str(hand.table_id), str(date_key))
        s = sessions[key]
        s["table_name"] = table.name
        s["table_type"] = table.table_type
        s["date"] = date_key
        if s["time"] is None and hand.started_at:
            s["time"] = hand.started_at.strftime("%H:%M")
        s["hand_ids"].append(hid)

        # Use ChipsLedger P&L if available, else HandAction stack diff as fallback
        if hid in ledger_by_hand:
            s["pnl"] += ledger_by_hand[hid]
        elif acts:
            s["pnl"] += acts[-1].stack_after - acts[0].stack_before

        ts = hand.started_at
        if ts:
            if s["first_at"] is None or ts < s["first_at"]:
                s["first_at"] = ts
        ts2 = hand.ended_at
        if ts2:
            if s["last_at"] is None or ts2 > s["last_at"]:
                s["last_at"] = ts2

    result = []
    for s in sessions.values():
        duration_minutes = None
        if s["first_at"] and s["last_at"]:
            delta = s["last_at"] - s["first_at"]
            duration_minutes = max(0, int(delta.total_seconds() / 60))
        result.append({
            "date": s["date"].isoformat() if s["date"] else None,
            "time": s["time"],
            "table_name": s["table_name"],
            "table_type": s["table_type"],
            "hands_played": len(s["hand_ids"]),
            "duration_minutes": duration_minutes,
            "result_chips": s["pnl"],
        })

    result.sort(key=lambda x: x["date"] or "", reverse=True)
    return result[:50]


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

    # Profitto = vincite - perdite di gioco (esclude ricariche admin e altri movimenti)
    profit_subq = (
        select(
            ChipsLedger.user_id.label('user_id'),
            func.coalesce(func.sum(ChipsLedger.amount), 0).label('profit')
        )
        .where(
            ChipsLedger.created_at >= start,
            ChipsLedger.reason.in_(["hand_win", "hand_loss", "sitgo_win", "sitgo_loss"]),
        )
        .group_by(ChipsLedger.user_id)
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
