"""
sitgo_router.py — Gestione tornei Sit & Go.

Endpoints:
  GET    /sitgo                   → lista tornei attivi
  POST   /sitgo                   → crea torneo
  GET    /sitgo/{id}              → dettaglio + iscritti
  POST   /sitgo/{id}/register     → iscriviti
  DELETE /sitgo/{id}/register     → disiscrivi
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_current_user
from database import AsyncSessionLocal, get_db
from game_manager import game_manager
from models import (
    BLIND_SCHEDULES,
    PokerTable,
    SitGoRegistration,
    SitGoTournament,
    TableSeat,
    User,
)
from schemas import SitGoCreate, SitGoDetail, SitGoRegistrationInfo, SitGoResponse

logger = logging.getLogger("ridotto.sitgo")

router = APIRouter(prefix="/sitgo", tags=["sitgo"])

# tournament_id → asyncio.Task (blind level timer)
_blind_timer_tasks: Dict[str, asyncio.Task] = {}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _build_response(tournament: SitGoTournament, db: AsyncSession) -> dict:
    """Calcola n_registered e creator_username per un torneo."""
    n_result = await db.execute(
        select(func.count()).select_from(SitGoRegistration)
        .where(SitGoRegistration.tournament_id == tournament.id)
    )
    n_registered = n_result.scalar() or 0

    creator_result = await db.execute(
        select(User.username).where(User.id == tournament.created_by)
    )
    creator_username = creator_result.scalar() or ""

    return {
        "id": tournament.id,
        "name": tournament.name,
        "min_players": tournament.min_players,
        "max_seats": tournament.max_seats,
        "speed": tournament.speed,
        "starting_chips": tournament.starting_chips,
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


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[SitGoResponse])
async def list_sitgo(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SitGoTournament)
        .where(SitGoTournament.status != "finished")
        .order_by(SitGoTournament.started_at.desc().nullslast(),
                  SitGoTournament.id.desc())
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

    tournament = SitGoTournament(
        name=payload.name,
        min_players=payload.min_players,
        max_seats=payload.max_seats,
        starting_chips=payload.starting_chips,
        speed=payload.speed,
        status="registering",
        blind_schedule=schedule,
        current_blind_level=1,
        created_by=current_user.id,
    )
    db.add(tournament)
    await db.flush()  # get tournament.id before commit

    # Auto-register creator
    reg = SitGoRegistration(
        tournament_id=tournament.id,
        user_id=current_user.id,
    )
    db.add(reg)
    await db.commit()
    await db.refresh(tournament)

    return await _build_response(tournament, db)


@router.get("/{tournament_id}", response_model=SitGoDetail)
async def get_sitgo(
    tournament_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SitGoTournament).where(SitGoTournament.id == tournament_id)
    )
    tournament = result.scalar_one_or_none()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Torneo non trovato")

    base = await _build_response(tournament, db)

    # Load registrations with user info
    regs_result = await db.execute(
        select(SitGoRegistration, User.username, User.avatar_initials)
        .join(User, User.id == SitGoRegistration.user_id)
        .where(SitGoRegistration.tournament_id == tournament_id)
        .order_by(SitGoRegistration.registered_at)
    )
    registrations = [
        SitGoRegistrationInfo(
            user_id=row.SitGoRegistration.user_id,
            username=row.username,
            avatar_initials=row.avatar_initials,
            registered_at=row.SitGoRegistration.registered_at,
        )
        for row in regs_result
    ]
    base["registrations"] = registrations
    return base


@router.post("/{tournament_id}/register")
async def register_sitgo(
    tournament_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SitGoTournament).where(SitGoTournament.id == tournament_id)
    )
    tournament = result.scalar_one_or_none()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Torneo non trovato")
    if tournament.status != "registering":
        raise HTTPException(status_code=400, detail="Il torneo non accetta più iscrizioni")

    # Check duplicate
    dup = await db.execute(
        select(SitGoRegistration).where(
            SitGoRegistration.tournament_id == tournament_id,
            SitGoRegistration.user_id == current_user.id,
        )
    )
    if dup.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Sei già iscritto a questo torneo")

    # Count current registrations
    n_result = await db.execute(
        select(func.count()).select_from(SitGoRegistration)
        .where(SitGoRegistration.tournament_id == tournament_id)
    )
    n_registered = (n_result.scalar() or 0) + 1  # +1 for the new one

    reg = SitGoRegistration(
        tournament_id=tournament_id,
        user_id=current_user.id,
    )
    db.add(reg)
    await db.commit()

    # Auto-start if full
    if n_registered >= tournament.max_seats:
        asyncio.create_task(_start_tournament(tournament_id))

    return {"message": "Iscritto", "n_registered": n_registered, "max_seats": tournament.max_seats}


@router.delete("/{tournament_id}/register")
async def unregister_sitgo(
    tournament_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SitGoTournament).where(SitGoTournament.id == tournament_id)
    )
    tournament = result.scalar_one_or_none()
    if tournament is None:
        raise HTTPException(status_code=404, detail="Torneo non trovato")
    if tournament.status != "registering":
        raise HTTPException(status_code=400, detail="Impossibile ritirarsi: il torneo è già iniziato")

    reg_result = await db.execute(
        select(SitGoRegistration).where(
            SitGoRegistration.tournament_id == tournament_id,
            SitGoRegistration.user_id == current_user.id,
        )
    )
    reg = reg_result.scalar_one_or_none()
    if reg is None:
        raise HTTPException(status_code=404, detail="Non sei iscritto a questo torneo")

    await db.delete(reg)
    await db.commit()

    # Check if tournament is now empty → close it
    n_result = await db.execute(
        select(func.count()).select_from(SitGoRegistration)
        .where(SitGoRegistration.tournament_id == tournament_id)
    )
    remaining = n_result.scalar() or 0
    if remaining == 0:
        t_result = await db.execute(
            select(SitGoTournament).where(SitGoTournament.id == tournament_id)
        )
        t = t_result.scalar_one_or_none()
        if t:
            t.status = "finished"
            await db.commit()

    return {"message": "Disiscritto"}


# ── Background tasks ──────────────────────────────────────────────────────────

async def _start_tournament(tournament_id: uuid.UUID):
    """
    Avviato come asyncio.Task quando il torneo raggiunge max_seats.
    Crea il PokerTable, assegna i posti, e avvia la prima mano.
    """
    async with AsyncSessionLocal() as db:
        try:
            # 1. Carica torneo e registrazioni
            t_result = await db.execute(
                select(SitGoTournament).where(SitGoTournament.id == tournament_id)
            )
            tournament = t_result.scalar_one_or_none()
            if tournament is None or tournament.status != "registering":
                return

            regs_result = await db.execute(
                select(SitGoRegistration)
                .where(SitGoRegistration.tournament_id == tournament_id)
                .order_by(SitGoRegistration.registered_at)
            )
            registrations = regs_result.scalars().all()

            schedule = tournament.blind_schedule
            first_sb = schedule[0]["small_blind"]
            first_bb = schedule[0]["big_blind"]

            # 2. Crea PokerTable in DB
            poker_table = PokerTable(
                name=tournament.name,
                table_type="sitgo",
                min_players=tournament.min_players,
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

            # 3. Crea TableSeat per ogni iscritto
            for seat_number, reg in enumerate(registrations):
                seat = TableSeat(
                    table_id=poker_table.id,
                    user_id=reg.user_id,
                    seat_number=seat_number,
                    stack=tournament.starting_chips,
                    status="active",
                )
                db.add(seat)
                game_manager.register_seat(table_id, str(reg.user_id), seat_number)

            # 4. Crea GiocoPoker in game_manager
            game = game_manager.get_or_create_table(
                table_id=table_id,
                small_blind=first_sb,
                big_blind=first_bb,
                speed=tournament.speed,
            )

            # Aggiungi giocatori al motore
            for seat_number, reg in enumerate(registrations):
                game.aggiungi_giocatore(
                    player_id=str(reg.user_id),
                    nome=str(reg.user_id),
                    stack=tournament.starting_chips,
                )

            # Registra mapping tournament
            game_manager.register_tournament(table_id, str(tournament_id))

            # 5. Aggiorna tournament
            tournament.status = "running"
            tournament.table_id = poker_table.id
            tournament.started_at = _now()
            tournament.level_started_at = _now()
            poker_table.status = "running"

            await db.commit()

            logger.info(
                "Torneo %s avviato → tavolo %s con %d giocatori",
                tournament_id, table_id, len(registrations)
            )

            # 6. Avvia blind level timer
            timer_task = asyncio.create_task(
                _blind_level_timer(str(tournament_id), table_id)
            )
            _blind_timer_tasks[str(tournament_id)] = timer_task

            # 7. Avvia prima mano
            game.inizia_mano()

            # 8. Broadcast stato iniziale
            await game_manager.broadcast_state(table_id)

            # Avvia timer per il primo giocatore di turno
            if game.turno_attivo:
                await game_manager.start_action_timer(table_id, game.turno_attivo)

        except Exception:
            logger.exception("Errore avvio torneo %s", tournament_id)


async def _blind_level_timer(tournament_id: str, table_id: str):
    """
    Ciclo che gestisce l'avanzamento dei livelli dei blind.
    Gira per tutta la durata del torneo.
    """
    while True:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(SitGoTournament).where(SitGoTournament.id == uuid.UUID(tournament_id))
            )
            tournament = result.scalar_one_or_none()

        if tournament is None or tournament.status != "running":
            break

        schedule = tournament.blind_schedule
        current_level = tournament.current_blind_level
        level_idx = current_level - 1

        if level_idx >= len(schedule):
            # Siamo all'ultimo livello, aspettiamo ma non aggiorniamo
            await asyncio.sleep(60)
            continue

        duration = schedule[level_idx]["duration_seconds"]
        await asyncio.sleep(duration)

        # Ricontrolla dopo il sleep
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(SitGoTournament).where(SitGoTournament.id == uuid.UUID(tournament_id))
            )
            tournament = result.scalar_one_or_none()
            if tournament is None or tournament.status != "running":
                break

            next_level = tournament.current_blind_level + 1
            if next_level > len(schedule):
                # Ultimo livello raggiunto, i blind rimangono fissi
                continue

            new_level_data = schedule[next_level - 1]
            tournament.current_blind_level = next_level
            tournament.level_started_at = _now()
            await db.commit()

            # Aggiorna game engine
            game = game_manager.get_table(table_id)
            if game:
                game.min_bet = new_level_data["big_blind"]

            # Calcola durata prossimo livello (se esiste)
            next_dur = schedule[next_level]["duration_seconds"] if next_level < len(schedule) else 0

            await game_manager.broadcast(table_id, {
                "type": "blind_level_up",
                "level": next_level,
                "small_blind": new_level_data["small_blind"],
                "big_blind": new_level_data["big_blind"],
                "next_level_in": next_dur,
            })

            logger.info(
                "Torneo %s → livello blind %d (SB=%d BB=%d)",
                tournament_id, next_level,
                new_level_data["small_blind"], new_level_data["big_blind"],
            )


async def handle_sitgo_hand_end(table_id: str, db: AsyncSession):
    """
    Da chiamare alla fine di ogni mano in un torneo Sit & Go.
    Controlla eliminazioni e vittoria.
    """
    tournament_id = game_manager.get_tournament_id(table_id)
    if not tournament_id:
        return

    game = game_manager.get_table(table_id)
    if game is None:
        return

    # Carica iscrizioni ancora attive
    regs_result = await db.execute(
        select(SitGoRegistration, User.username)
        .join(User, User.id == SitGoRegistration.user_id)
        .where(
            SitGoRegistration.tournament_id == uuid.UUID(tournament_id),
            SitGoRegistration.final_position.is_(None),
        )
        .order_by(SitGoRegistration.registered_at)
    )
    active_regs = list(regs_result)
    players_in_game = len(active_regs)

    eliminated: list[str] = []

    for row in active_regs:
        reg = row.SitGoRegistration
        user_id_str = str(reg.user_id)
        seat = game_manager.seat_for_user(table_id, user_id_str)
        if seat is None:
            continue
        stack = game_manager.get_player_stack(table_id, user_id_str)
        if stack is not None and stack == 0:
            eliminated.append(user_id_str)

    # Assegna posizioni agli eliminati (dal peggiore al migliore, inverso all'ordine di uscita)
    remaining_after = players_in_game - len(eliminated)

    for user_id_str in eliminated:
        position = remaining_after + 1
        remaining_after -= 1

        reg_result = await db.execute(
            select(SitGoRegistration).where(
                SitGoRegistration.tournament_id == uuid.UUID(tournament_id),
                SitGoRegistration.user_id == uuid.UUID(user_id_str),
            )
        )
        reg = reg_result.scalar_one_or_none()
        if reg:
            reg.final_position = position
            reg.chips_at_end = 0

        # Rimuovi da game manager
        seat = game_manager.seat_for_user(table_id, user_id_str)
        game_manager.unregister_seat(table_id, user_id_str)

        # Rimuovi TableSeat da DB
        seat_result = await db.execute(
            select(TableSeat).where(
                TableSeat.table_id == uuid.UUID(table_id),
                TableSeat.user_id == uuid.UUID(user_id_str),
            )
        )
        ts = seat_result.scalar_one_or_none()
        if ts:
            await db.delete(ts)

        # Ottieni username per broadcast
        user_result = await db.execute(select(User.username).where(User.id == uuid.UUID(user_id_str)))
        username = user_result.scalar() or user_id_str

        await game_manager.broadcast(table_id, {
            "type": "player_eliminated",
            "seat": seat,
            "position": position,
            "username": username,
        })
        logger.info("Torneo %s: %s eliminato in posizione %d", tournament_id, username, position)

    await db.commit()

    # Ricontrolla quanti restano
    remaining_result = await db.execute(
        select(func.count()).select_from(SitGoRegistration).where(
            SitGoRegistration.tournament_id == uuid.UUID(tournament_id),
            SitGoRegistration.final_position.is_(None),
        )
    )
    remaining = remaining_result.scalar() or 0

    if remaining == 1:
        # Trova vincitore
        winner_result = await db.execute(
            select(SitGoRegistration, User.username)
            .join(User, User.id == SitGoRegistration.user_id)
            .where(
                SitGoRegistration.tournament_id == uuid.UUID(tournament_id),
                SitGoRegistration.final_position.is_(None),
            )
        )
        winner_row = winner_result.first()
        if winner_row:
            winner_uid = str(winner_row.SitGoRegistration.user_id)
            winner_stack = game_manager.get_player_stack(table_id, winner_uid) or 0
            await _finish_tournament(tournament_id, winner_uid, winner_stack, table_id, db)


async def _finish_tournament(
    tournament_id: str,
    winner_user_id: str,
    winner_stack: int,
    table_id: str,
    db: AsyncSession,
):
    """Chiude il torneo, assegna posizione 1 al vincitore, broadcast finale."""
    # 1. Vincitore
    reg_result = await db.execute(
        select(SitGoRegistration).where(
            SitGoRegistration.tournament_id == uuid.UUID(tournament_id),
            SitGoRegistration.user_id == uuid.UUID(winner_user_id),
        )
    )
    reg = reg_result.scalar_one_or_none()
    if reg:
        reg.final_position = 1
        reg.chips_at_end = winner_stack

    # 2. Aggiorna torneo
    t_result = await db.execute(
        select(SitGoTournament).where(SitGoTournament.id == uuid.UUID(tournament_id))
    )
    tournament = t_result.scalar_one_or_none()
    if tournament:
        tournament.status = "finished"
        tournament.finished_at = _now()

    await db.commit()

    # 3. Cancella blind timer
    task = _blind_timer_tasks.pop(tournament_id, None)
    if task and not task.done():
        task.cancel()

    # 4. Carica risultati
    results_result = await db.execute(
        select(SitGoRegistration, User.username)
        .join(User, User.id == SitGoRegistration.user_id)
        .where(SitGoRegistration.tournament_id == uuid.UUID(tournament_id))
        .order_by(SitGoRegistration.final_position)
    )
    results = results_result.all()

    winner_username_result = await db.execute(
        select(User.username).where(User.id == uuid.UUID(winner_user_id))
    )
    winner_username = winner_username_result.scalar() or winner_user_id

    position_results = [
        {
            "position": row.SitGoRegistration.final_position,
            "username": row.username,
            "chips_at_end": row.SitGoRegistration.chips_at_end,
        }
        for row in results
    ]

    # 5. Broadcast
    await game_manager.broadcast(table_id, {
        "type": "tournament_ended",
        "winner_username": winner_username,
        "position_results": position_results,
    })

    logger.info("Torneo %s terminato. Vincitore: %s", tournament_id, winner_username)

    # 6. Dopo 30s: chiudi il PokerTable
    async def _close_table():
        await asyncio.sleep(30)
        async with AsyncSessionLocal() as close_db:
            tbl_result = await close_db.execute(
                select(PokerTable).where(PokerTable.id == uuid.UUID(table_id))
            )
            tbl = tbl_result.scalar_one_or_none()
            if tbl:
                tbl.status = "closed"
                await close_db.commit()
        game_manager.remove_table(table_id)
        game_manager.unregister_tournament(table_id)

    asyncio.create_task(_close_table())
