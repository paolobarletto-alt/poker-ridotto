from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import AsyncSessionLocal, get_db
from game_manager import game_manager
from models import (
    BLIND_SCHEDULES,
    ChipsLedger,
    PlayerGameSession,
    PokerTable,
    SitGoRegistration,
    SitGoTournament,
    TableSeat,
    User,
)
from schemas import SitGoCreate, SitGoDetail, SitGoRegistrationInfo, SitGoResponse

logger = logging.getLogger("ridotto.sitgo")

router = APIRouter(prefix="/sitgo", tags=["sitgo"])

_blind_timer_tasks: Dict[str, asyncio.Task] = {}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _payout_structure_for_players(players: int) -> list[int]:
    if players == 2:
        return [100]
    if 3 <= players <= 4:
        return [70, 30]
    return [50, 30, 20]


async def _build_response(tournament: SitGoTournament, db: AsyncSession) -> dict:
    n_result = await db.execute(
        select(func.count()).select_from(SitGoRegistration).where(
            SitGoRegistration.tournament_id == tournament.id
        )
    )
    n_registered = n_result.scalar() or 0
    creator_result = await db.execute(select(User.username).where(User.id == tournament.created_by))
    creator_username = creator_result.scalar() or ""

    return {
        "id": tournament.id,
        "name": tournament.name,
        "min_players": tournament.min_players,
        "max_seats": tournament.max_seats,
        "max_players": tournament.max_seats,
        "speed": tournament.speed,
        "starting_chips": tournament.starting_chips,
        "buy_in": tournament.buy_in,
        "prize_pool": tournament.prize_pool,
        "payout_structure": tournament.payout_structure or [],
        "payout_awarded": tournament.payout_awarded,
        "status": tournament.status,
        "blind_schedule": tournament.blind_schedule,
        "current_blind_level": tournament.current_blind_level,
        "table_id": tournament.table_id,
        "created_by": tournament.created_by,
        "started_at": tournament.started_at,
        "finished_at": tournament.finished_at,
        "n_registered": n_registered,
        "creator_username": creator_username,
    }


async def _register_player(
    db: AsyncSession,
    tournament: SitGoTournament,
    user: User,
) -> int:
    if tournament.status != "waiting":
        raise HTTPException(status_code=400, detail="Il torneo non accetta più iscrizioni")

    dup = await db.execute(
        select(SitGoRegistration).where(
            SitGoRegistration.tournament_id == tournament.id,
            SitGoRegistration.user_id == user.id,
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Sei già iscritto a questo torneo")

    n_result = await db.execute(
        select(func.count()).select_from(SitGoRegistration).where(
            SitGoRegistration.tournament_id == tournament.id
        )
    )
    n_registered = n_result.scalar() or 0
    if n_registered >= tournament.max_seats:
        raise HTTPException(status_code=400, detail="Torneo pieno")

    db.add(
        SitGoRegistration(
            tournament_id=tournament.id,
            user_id=user.id,
            buy_in_amount=0,
            player_status="active",
        )
    )
    await db.flush()
    return n_registered + 1


@router.get("", response_model=list[SitGoResponse])
async def list_sitgo(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SitGoTournament)
        .where(SitGoTournament.status != "finished")
        .order_by(SitGoTournament.started_at.desc().nullslast(), SitGoTournament.id.desc())
    )
    tournaments = result.scalars().all()
    rows = []
    for t in tournaments:
        rows.append(await _build_response(t, db))
    return rows


@router.post("", response_model=SitGoResponse, status_code=201)
async def create_sitgo(
    payload: SitGoCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    schedule = BLIND_SCHEDULES.get(payload.speed, BLIND_SCHEDULES["normal"])
    target_players = payload.max_seats
    payout_structure = _payout_structure_for_players(target_players)
    tournament = SitGoTournament(
        name=payload.name,
        min_players=target_players,
        max_seats=target_players,
        starting_chips=payload.starting_chips,
        buy_in=payload.buy_in,
        speed=payload.speed,
        status="waiting",
        blind_schedule=schedule,
        current_blind_level=1,
        payout_structure=payout_structure,
        created_by=current_user.id,
    )
    db.add(tournament)
    await db.flush()
    n_registered = await _register_player(db, tournament, current_user)
    await db.commit()
    await db.refresh(tournament)

    if n_registered >= tournament.max_seats:
        asyncio.create_task(_start_tournament(tournament.id))

    return await _build_response(tournament, db)


@router.get("/{tournament_id}", response_model=SitGoDetail)
async def get_sitgo(
    tournament_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SitGoTournament).where(SitGoTournament.id == tournament_id))
    tournament = result.scalar_one_or_none()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Torneo non trovato")

    base = await _build_response(tournament, db)
    regs_result = await db.execute(
        select(SitGoRegistration, User.username, User.avatar_initials)
        .join(User, User.id == SitGoRegistration.user_id)
        .where(SitGoRegistration.tournament_id == tournament_id)
        .order_by(SitGoRegistration.registered_at)
    )
    base["registrations"] = [
        SitGoRegistrationInfo(
            user_id=row.SitGoRegistration.user_id,
            username=row.username,
            avatar_initials=row.avatar_initials,
            registered_at=row.SitGoRegistration.registered_at,
            final_position=row.SitGoRegistration.final_position,
            player_status=row.SitGoRegistration.player_status,
            elimination_reason=row.SitGoRegistration.elimination_reason,
            eliminated_at=row.SitGoRegistration.eliminated_at,
            payout_awarded=row.SitGoRegistration.payout_awarded,
        )
        for row in regs_result
    ]
    return base


@router.post("/{tournament_id}/register")
async def register_sitgo(
    tournament_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SitGoTournament).where(SitGoTournament.id == tournament_id).with_for_update()
    )
    tournament = result.scalar_one_or_none()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Torneo non trovato")

    n_registered = await _register_player(db, tournament, current_user)
    await db.commit()

    if n_registered >= tournament.max_seats:
        asyncio.create_task(_start_tournament(tournament_id))

    return {"message": "Iscrizione completata", "n_registered": n_registered, "max_seats": tournament.max_seats}


@router.delete("/{tournament_id}/register")
async def unregister_sitgo(
    tournament_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SitGoTournament).where(SitGoTournament.id == tournament_id).with_for_update()
    )
    tournament = result.scalar_one_or_none()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Torneo non trovato")
    if tournament.status != "waiting":
        raise HTTPException(status_code=400, detail="Impossibile disiscriversi: torneo già avviato")

    reg_result = await db.execute(
        select(SitGoRegistration).where(
            SitGoRegistration.tournament_id == tournament_id,
            SitGoRegistration.user_id == current_user.id,
        )
    )
    reg = reg_result.scalar_one_or_none()
    if reg is None:
        raise HTTPException(status_code=404, detail="Non sei iscritto a questo torneo")

    if reg.buy_in_amount > 0:
        user_db = await db.get(User, current_user.id)
        if user_db is None:
            raise HTTPException(status_code=404, detail="Utente non trovato")
        refund = reg.buy_in_amount
        user_db.chips_balance += refund
        reg.refunded_at = _now()
        db.add(
            ChipsLedger(
                user_id=user_db.id,
                amount=refund,
                balance_after=user_db.chips_balance,
                reason="sitgo_refund",
                game_id=tournament.id,
                description=f"Rimborso disiscrizione Sit&Go '{tournament.name}'",
            )
        )
    await db.delete(reg)
    await db.flush()

    n_result = await db.execute(
        select(func.count()).select_from(SitGoRegistration).where(
            SitGoRegistration.tournament_id == tournament_id
        )
    )
    remaining = n_result.scalar() or 0
    if remaining == 0:
        tournament.status = "finished"
        tournament.finished_at = _now()

    await db.commit()
    return {"message": "Disiscrizione completata"}


async def _start_tournament(tournament_id: uuid.UUID):
    async with AsyncSessionLocal() as db:
        try:
            t_result = await db.execute(
                select(SitGoTournament).where(SitGoTournament.id == tournament_id).with_for_update()
            )
            tournament = t_result.scalar_one_or_none()
            if tournament is None or tournament.status != "waiting":
                return

            regs_result = await db.execute(
                select(SitGoRegistration)
                .where(SitGoRegistration.tournament_id == tournament_id)
                .order_by(SitGoRegistration.registered_at)
            )
            registrations = regs_result.scalars().all()
            if len(registrations) < tournament.max_seats:
                return

            schedule = tournament.blind_schedule
            first_level = schedule[0]
            first_sb = first_level["small_blind"]
            first_bb = first_level["big_blind"]
            tournament.prize_pool = 0
            tournament.payout_structure = _payout_structure_for_players(len(registrations))

            poker_table = PokerTable(
                name=tournament.name,
                table_type="sitgo",
                min_players=2,
                max_seats=tournament.max_seats,
                speed=tournament.speed,
                small_blind=first_sb,
                big_blind=first_bb,
                min_buyin=tournament.starting_chips,
                max_buyin=tournament.starting_chips,
                status="waiting",
                created_by=tournament.created_by,
            )
            db.add(poker_table)
            await db.flush()
            table_id = str(poker_table.id)

            game_manager.get_or_create_table(
                table_id=table_id,
                small_blind=first_sb,
                big_blind=first_bb,
                speed=tournament.speed,
            )

            tournament.status = "running"
            tournament.table_id = poker_table.id
            tournament.started_at = _now()
            tournament.level_started_at = None
            game_manager.register_tournament(table_id, str(tournament_id))
            await db.commit()

            await game_manager.broadcast(
                table_id,
                {
                    "type": "waiting_players",
                    "needed": tournament.max_seats,
                },
            )

            logger.info(
                "Sit&Go %s avviato su tavolo %s (%d giocatori)",
                tournament_id,
                table_id,
                len(registrations),
            )
        except Exception:
            logger.exception("Errore avvio Sit&Go %s", tournament_id)


async def _blind_level_timer(tournament_id: str, table_id: str):
    while True:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(SitGoTournament).where(SitGoTournament.id == uuid.UUID(tournament_id))
            )
            tournament = result.scalar_one_or_none()
        if tournament is None or tournament.status != "running":
            break
        if tournament.level_started_at is None:
            await asyncio.sleep(1)
            continue

        schedule = tournament.blind_schedule or []
        current_level_idx = max(tournament.current_blind_level - 1, 0)
        if current_level_idx >= len(schedule):
            await asyncio.sleep(30)
            continue

        duration = schedule[current_level_idx]["duration_seconds"]
        await asyncio.sleep(duration)

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(SitGoTournament).where(SitGoTournament.id == uuid.UUID(tournament_id)).with_for_update()
            )
            tournament = result.scalar_one_or_none()
            if tournament is None or tournament.status != "running":
                break

            next_level = tournament.current_blind_level + 1
            if next_level > len(tournament.blind_schedule or []):
                await asyncio.sleep(30)
                continue

            level_data = tournament.blind_schedule[next_level - 1]
            tournament.current_blind_level = next_level
            tournament.level_started_at = _now()

            if tournament.table_id:
                table = await db.get(PokerTable, tournament.table_id)
                if table:
                    table.small_blind = level_data["small_blind"]
                    table.big_blind = level_data["big_blind"]

            await db.commit()

        game = game_manager.get_table(table_id)
        if game:
            game.min_bet = level_data["big_blind"]

        await game_manager.broadcast(
            table_id,
            {
                "type": "blind_level_up",
                "level": next_level,
                "small_blind": level_data["small_blind"],
                "big_blind": level_data["big_blind"],
                "next_level_in": level_data["duration_seconds"],
            },
        )


async def ensure_sitgo_blinds_started(table_id: str) -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(SitGoTournament).where(SitGoTournament.table_id == uuid.UUID(table_id)).with_for_update()
        )
        tournament = result.scalar_one_or_none()
        if tournament is None or tournament.status != "running":
            return

        if tournament.level_started_at is None:
            tournament.level_started_at = _now()
            await db.commit()
        else:
            await db.rollback()

    tid = str(tournament.id)
    task = _blind_timer_tasks.get(tid)
    if task is None or task.done():
        _blind_timer_tasks[tid] = asyncio.create_task(_blind_level_timer(tid, table_id))


async def handle_sitgo_hand_end(table_id: str, db: AsyncSession):
    tournament_id = game_manager.get_tournament_id(table_id)
    if not tournament_id:
        return

    tournament_result = await db.execute(
        select(SitGoTournament).where(SitGoTournament.id == uuid.UUID(tournament_id))
    )
    tournament = tournament_result.scalar_one_or_none()
    if tournament is None or tournament.status != "running":
        return

    game = game_manager.get_table(table_id)
    if game is None:
        return

    regs_result = await db.execute(
        select(SitGoRegistration, User.username)
        .join(User, User.id == SitGoRegistration.user_id)
        .where(
            SitGoRegistration.tournament_id == uuid.UUID(tournament_id),
            SitGoRegistration.final_position.is_(None),
        )
        .order_by(SitGoRegistration.registered_at)
    )
    active_rows = list(regs_result)
    players_in_game = len(active_rows)

    eliminated_rows = []
    for row in active_rows:
        reg = row.SitGoRegistration
        uid = str(reg.user_id)
        stack = game_manager.get_player_stack(table_id, uid)
        if stack is not None and stack <= 0:
            eliminated_rows.append(row)

    if not eliminated_rows:
        return

    next_position = players_in_game
    for row in eliminated_rows:
        reg = row.SitGoRegistration
        uid = str(reg.user_id)
        seat = game_manager.seat_for_user(table_id, uid)

        reg.final_position = next_position
        reg.player_status = "eliminated"
        reg.elimination_reason = "busted"
        reg.eliminated_at = _now()
        reg.chips_at_end = 0
        next_position -= 1

        if uid in game.seats:
            game.rimuovi_giocatore(uid)
        game_manager.unregister_seat(table_id, uid)

        seat_result = await db.execute(
            select(TableSeat).where(
                TableSeat.table_id == uuid.UUID(table_id),
                TableSeat.user_id == reg.user_id,
            )
        )
        table_seat = seat_result.scalar_one_or_none()
        if table_seat:
            await db.delete(table_seat)

        await game_manager.broadcast(
            table_id,
            {
                "type": "player_eliminated",
                "seat": seat,
                "position": reg.final_position,
                "username": row.username,
            },
        )

    await db.flush()

    remaining_result = await db.execute(
        select(func.count()).select_from(SitGoRegistration).where(
            SitGoRegistration.tournament_id == uuid.UUID(tournament_id),
            SitGoRegistration.final_position.is_(None),
        )
    )
    remaining = remaining_result.scalar() or 0
    if remaining != 1:
        await db.commit()
        return

    winner_result = await db.execute(
        select(SitGoRegistration, User.username)
        .join(User, User.id == SitGoRegistration.user_id)
        .where(
            SitGoRegistration.tournament_id == uuid.UUID(tournament_id),
            SitGoRegistration.final_position.is_(None),
        )
    )
    winner_row = winner_result.first()
    if winner_row is None:
        await db.commit()
        return

    winner_user_id = str(winner_row.SitGoRegistration.user_id)
    winner_stack = game_manager.get_player_stack(table_id, winner_user_id) or 0
    await _finish_tournament(
        tournament_id=tournament_id,
        winner_user_id=winner_user_id,
        winner_stack=winner_stack,
        table_id=table_id,
        db=db,
    )


async def _finish_tournament(
    tournament_id: str,
    winner_user_id: str,
    winner_stack: int,
    table_id: str,
    db: AsyncSession,
):
    now = _now()
    tournament = await db.get(SitGoTournament, uuid.UUID(tournament_id))
    if tournament is None:
        return

    winner_reg_result = await db.execute(
        select(SitGoRegistration).where(
            SitGoRegistration.tournament_id == tournament.id,
            SitGoRegistration.user_id == uuid.UUID(winner_user_id),
        )
    )
    winner_reg = winner_reg_result.scalar_one_or_none()
    if winner_reg:
        winner_reg.final_position = 1
        winner_reg.player_status = "active"
        winner_reg.elimination_reason = None
        winner_reg.eliminated_at = None
        winner_reg.chips_at_end = winner_stack

    tournament.status = "finished"
    tournament.finished_at = now

    results_result = await db.execute(
        select(SitGoRegistration, User)
        .join(User, User.id == SitGoRegistration.user_id)
        .where(SitGoRegistration.tournament_id == tournament.id)
        .order_by(SitGoRegistration.final_position.asc().nullslast())
    )
    results = results_result.all()

    percentages = tournament.payout_structure or _payout_structure_for_players(len(results))
    payouts: dict[int, int] = {}
    distributed = 0
    for idx, pct in enumerate(percentages, start=1):
        amount = (tournament.prize_pool * int(pct)) // 100
        payouts[idx] = amount
        distributed += amount
    if payouts:
        payouts[1] += tournament.prize_pool - distributed

    for row in results:
        reg = row.SitGoRegistration
        user = row.User
        position = reg.final_position or 0
        payout = payouts.get(position, 0)
        reg.payout_awarded = payout
        reg.payout_awarded_at = now if payout > 0 else None
        if position > 1 and reg.player_status == "active":
            reg.player_status = "eliminated"
            reg.elimination_reason = reg.elimination_reason or "busted"
            reg.eliminated_at = reg.eliminated_at or now
        if payout > 0:
            user.chips_balance += payout
            db.add(
                ChipsLedger(
                    user_id=user.id,
                    amount=payout,
                    balance_after=user.chips_balance,
                    reason="sitgo_payout",
                    game_id=tournament.id,
                    description=f"Premio Sit&Go '{tournament.name}' posizione {position}",
                )
            )

    tournament.payout_awarded = True
    table_uuid = tournament.table_id

    if tournament.table_id:
        sessions_result = await db.execute(
            select(PlayerGameSession).where(
                PlayerGameSession.table_id == tournament.table_id,
                PlayerGameSession.status == "open",
            )
        )
        sessions = sessions_result.scalars().all()
        reg_map = {r.SitGoRegistration.user_id: r.SitGoRegistration for r in results}
        for session in sessions:
            reg = reg_map.get(session.user_id)
            if reg is None:
                continue
            session.current_stack = reg.chips_at_end or 0
            session.cashout = reg.payout_awarded
            session.result_chips = reg.payout_awarded - session.total_buyin
            session.status = "closed"
            session.close_reason = "tournament_finished"
            session.ended_at = now
            session.last_activity_at = now

    await db.commit()

    winner_name_result = await db.execute(select(User.username).where(User.id == uuid.UUID(winner_user_id)))
    winner_username = winner_name_result.scalar() or winner_user_id
    payload_results = [
        {
            "position": row.SitGoRegistration.final_position,
            "user_id": str(row.SitGoRegistration.user_id),
            "username": row.User.username,
            "chips_at_end": row.SitGoRegistration.chips_at_end,
            "payout": row.SitGoRegistration.payout_awarded,
        }
        for row in results
    ]
    await game_manager.broadcast(
        table_id,
        {
            "type": "tournament_ended",
            "winner_username": winner_username,
            "prize_pool": tournament.prize_pool,
            "buy_in": tournament.buy_in,
            "position_results": payload_results,
        },
    )

    task = _blind_timer_tasks.pop(tournament_id, None)
    if task and not task.done():
        task.cancel()

    async def _close_table():
        await asyncio.sleep(30)
        async with AsyncSessionLocal() as close_db:
            if table_uuid:
                table = await close_db.get(PokerTable, table_uuid)
                if table:
                    table.status = "closed"
                seats_result = await close_db.execute(
                    select(TableSeat).where(TableSeat.table_id == table_uuid)
                )
                for seat in seats_result.scalars().all():
                    await close_db.delete(seat)
                await close_db.commit()
        game_manager.remove_table(table_id)
        game_manager.unregister_tournament(table_id)

    asyncio.create_task(_close_table())
