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
    # Fetch all actions for current user (capped for performance)
    actions_result = await db.execute(
        select(HandAction)
        .where(HandAction.user_id == current_user.id)
        .order_by(HandAction.hand_id, HandAction.created_at.asc())
        .limit(2000)
    )
    all_actions = actions_result.scalars().all()
    if not all_actions:
        return []

    # Group actions by hand_id
    actions_by_hand: dict = defaultdict(list)
    for a in all_actions:
        actions_by_hand[a.hand_id].append(a)

    hand_ids = list(actions_by_hand.keys())

    # Fetch hands + tables
    hands_result = await db.execute(
        select(GameHand, PokerTable)
        .join(PokerTable, GameHand.table_id == PokerTable.id)
        .where(GameHand.id.in_(hand_ids))
        .order_by(GameHand.started_at.asc())
    )
    hands_with_tables = hands_result.all()

    # Group by (table_id, date)
    sessions: dict = defaultdict(list)
    hand_meta: dict = {}
    for hand, table in hands_with_tables:
        hand_meta[hand.id] = (hand, table)
        date_key = hand.started_at.date() if hand.started_at else None
        sessions[(str(hand.table_id), date_key)].append(hand.id)

    result = []
    for (_, date_key), h_ids in sessions.items():
        session_hands = [(hand_meta[h][0], hand_meta[h][1]) for h in h_ids if h in hand_meta]
        if not session_hands:
            continue

        first_hand, table = session_hands[0]
        last_hand = session_hands[-1][0]

        total_result = 0
        for hand, _ in session_hands:
            acts = actions_by_hand.get(hand.id, [])
            if acts:
                total_result += acts[-1].stack_after - acts[0].stack_before

        duration_minutes = None
        if first_hand.started_at and last_hand.ended_at:
            delta = last_hand.ended_at - first_hand.started_at
            duration_minutes = max(0, int(delta.total_seconds() / 60))

        result.append({
            "date": date_key.isoformat() if date_key else None,
            "time": first_hand.started_at.strftime("%H:%M") if first_hand.started_at else None,
            "table_name": table.name,
            "table_type": table.table_type,
            "hands_played": len(session_hands),
            "duration_minutes": duration_minutes,
            "result_chips": total_result,
        })

    result.sort(key=lambda x: x["date"] or "", reverse=True)
    return result[:30]


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
