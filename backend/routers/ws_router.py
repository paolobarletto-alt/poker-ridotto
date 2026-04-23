"""
ws_router.py — REST endpoints per i tavoli + WebSocket per il gioco in tempo reale.

REST  (prefix /tables):
  GET    /tables
  POST   /tables
  GET    /tables/{table_id}
  DELETE /tables/{table_id}

WebSocket:
  WS /ws/table/{table_id}?token={jwt}
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt
from pydantic import BaseModel, field_validator, model_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth import get_current_user
from config import settings
from database import AsyncSessionLocal, get_db
from game_manager import game_manager
from models import ChipsLedger, GameHand, HandAction, PlayerGameSession, PokerTable, SitGoRegistration, SitGoTournament, TableSeat, User
from poker_engine import AzioneGioco, FaseGioco, StatoSeat
from routers.sitgo_router import _finish_tournament, ensure_sitgo_blinds_started, handle_sitgo_hand_end

logger = logging.getLogger("ridotto.ws_router")

router = APIRouter()


def _enrich_state(public: dict, seat_map: dict) -> dict:
    """Aggiunge seat number a ogni giocatore nello stato pubblico."""
    for g in public.get("giocatori", []):
        if g.get("seat") is None:
            g["seat"] = seat_map.get(g["player_id"])
    return public


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


async def _get_open_session(
    db: AsyncSession,
    table_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Optional[PlayerGameSession]:
    result = await db.execute(
        select(PlayerGameSession)
        .where(
            PlayerGameSession.table_id == table_id,
            PlayerGameSession.user_id == user_id,
            PlayerGameSession.status == "open",
        )
        .order_by(PlayerGameSession.started_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()

# ─────────────────────────────────────────────────────────────────────────────
# SCHEMI PYDANTIC
# ─────────────────────────────────────────────────────────────────────────────

class TableCreate(BaseModel):
    name: str
    table_type: str          # "cash" | "sitgo"
    min_players: int         # 2-9
    max_seats: int           # 2-9, >= min_players
    speed: str               # "slow" | "normal" | "fast"
    small_blind: int
    big_blind: int
    min_buyin: int
    max_buyin: Optional[int] = None

    @field_validator("name")
    @classmethod
    def name_len(cls, v: str) -> str:
        v = v.strip()
        if not (3 <= len(v) <= 50):
            raise ValueError("Il nome deve essere tra 3 e 50 caratteri")
        return v

    @field_validator("table_type")
    @classmethod
    def table_type_valid(cls, v: str) -> str:
        if v not in ("cash", "sitgo"):
            raise ValueError("table_type deve essere 'cash' o 'sitgo'")
        return v

    @field_validator("speed")
    @classmethod
    def speed_valid(cls, v: str) -> str:
        if v not in ("slow", "normal", "fast"):
            raise ValueError("speed deve essere 'slow', 'normal' o 'fast'")
        return v

    @field_validator("min_players", "max_seats")
    @classmethod
    def seats_range(cls, v: int) -> int:
        if not (2 <= v <= 9):
            raise ValueError("Il valore deve essere tra 2 e 9")
        return v

    @model_validator(mode="after")
    def validate_consistency(self) -> "TableCreate":
        if self.max_seats < self.min_players:
            raise ValueError("max_seats deve essere >= min_players")
        if self.small_blind <= 0:
            raise ValueError("small_blind deve essere > 0")
        if self.big_blind != self.small_blind * 2:
            raise ValueError("big_blind deve essere esattamente small_blind × 2")
        if self.min_buyin < self.big_blind * 10:
            raise ValueError(f"min_buyin deve essere >= big_blind × 10 ({self.big_blind * 10})")
        return self


class TableResponse(BaseModel):
    id: uuid.UUID
    name: str
    table_type: str
    min_players: int
    max_seats: int
    speed: str
    small_blind: int
    big_blind: int
    min_buyin: int
    max_buyin: Optional[int]
    status: str
    is_private: bool
    created_by: uuid.UUID
    created_at: datetime
    players_seated: int = 0
    spectators: int = 0

    model_config = {"from_attributes": True}


class SeatInfo(BaseModel):
    seat_number: int
    username: str
    display_name: Optional[str]
    stack: int
    status: str

    model_config = {"from_attributes": True}


class TableDetail(TableResponse):
    seats: list[SeatInfo] = []


# ─────────────────────────────────────────────────────────────────────────────
# REST — GET /tables
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/tables", response_model=list[TableResponse])
async def list_tables(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PokerTable)
        .where(PokerTable.status != "closed")
        .order_by(PokerTable.created_at.desc())
    )
    tables = result.scalars().all()

    # Conta i posti occupati per ogni tavolo con una query aggregata
    seated_counts_result = await db.execute(
        select(TableSeat.table_id, func.count(TableSeat.id).label("cnt"))
        .group_by(TableSeat.table_id)
    )
    seated_map: dict[uuid.UUID, int] = {
        row.table_id: row.cnt for row in seated_counts_result
    }

    responses = []
    for t in tables:
        tid = str(t.id)
        responses.append(TableResponse(
            id=t.id,
            name=t.name,
            table_type=t.table_type,
            min_players=t.min_players,
            max_seats=t.max_seats,
            speed=t.speed,
            small_blind=t.small_blind,
            big_blind=t.big_blind,
            min_buyin=t.min_buyin,
            max_buyin=t.max_buyin,
            status=t.status,
            is_private=t.is_private,
            created_by=t.created_by,
            created_at=t.created_at,
            players_seated=seated_map.get(t.id, 0),
            spectators=game_manager.get_spectators_count(tid),
        ))
    return responses


# ─────────────────────────────────────────────────────────────────────────────
# REST — POST /tables
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/tables", response_model=TableResponse, status_code=201)
async def create_table(
    body: TableCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    table = PokerTable(
        name=body.name,
        table_type=body.table_type,
        min_players=body.min_players,
        max_seats=body.max_seats,
        speed=body.speed,
        small_blind=body.small_blind,
        big_blind=body.big_blind,
        min_buyin=body.min_buyin,
        max_buyin=body.max_buyin,
        status="waiting",
        is_private=False,
        created_by=current_user.id,
    )
    db.add(table)
    await db.commit()
    await db.refresh(table)
    logger.info("Tavolo creato: %s (%s) da %s", table.id, table.name, current_user.username)
    return TableResponse(
        id=table.id,
        name=table.name,
        table_type=table.table_type,
        min_players=table.min_players,
        max_seats=table.max_seats,
        speed=table.speed,
        small_blind=table.small_blind,
        big_blind=table.big_blind,
        min_buyin=table.min_buyin,
        max_buyin=table.max_buyin,
        status=table.status,
        is_private=table.is_private,
        created_by=table.created_by,
        created_at=table.created_at,
        players_seated=0,
        spectators=0,
    )


# ─────────────────────────────────────────────────────────────────────────────
# REST — GET /tables/{table_id}
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/tables/{table_id}", response_model=TableDetail)
async def get_table(
    table_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PokerTable)
        .options(selectinload(PokerTable.seats).selectinload(TableSeat.user))
        .where(PokerTable.id == table_id)
    )
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(status_code=404, detail="Tavolo non trovato")

    tid = str(table_id)
    seats_info = [
        SeatInfo(
            seat_number=s.seat_number,
            username=s.user.username,
            display_name=s.user.display_name,
            stack=s.stack,
            status=s.status,
        )
        for s in table.seats
    ]

    return TableDetail(
        id=table.id,
        name=table.name,
        table_type=table.table_type,
        min_players=table.min_players,
        max_seats=table.max_seats,
        speed=table.speed,
        small_blind=table.small_blind,
        big_blind=table.big_blind,
        min_buyin=table.min_buyin,
        max_buyin=table.max_buyin,
        status=table.status,
        is_private=table.is_private,
        created_by=table.created_by,
        created_at=table.created_at,
        players_seated=len(seats_info),
        spectators=game_manager.get_spectators_count(tid),
        seats=seats_info,
    )


# ─────────────────────────────────────────────────────────────────────────────
# REST — DELETE /tables/{table_id}
# ─────────────────────────────────────────────────────────────────────────────

@router.delete("/tables/{table_id}", status_code=204)
async def close_table(
    table_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PokerTable)
        .options(selectinload(PokerTable.seats))
        .where(PokerTable.id == table_id)
    )
    table = result.scalar_one_or_none()
    if not table:
        raise HTTPException(status_code=404, detail="Tavolo non trovato")

    # Solo il creatore o un admin
    if table.created_by != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Non autorizzato")

    # Non chiudere se c'è una mano in corso
    game = game_manager.get_table(str(table_id))
    if game and game.hand_in_progress():
        raise HTTPException(status_code=409, detail="Impossibile chiudere: mano in corso")

    # Restituisci lo stack ai giocatori seduti
    for seat in table.seats:
        user_res = await db.execute(select(User).where(User.id == seat.user_id))
        u = user_res.scalar_one_or_none()
        if u and seat.stack > 0:
            u.chips_balance += seat.stack
            db.add(ChipsLedger(
                user_id=u.id,
                amount=seat.stack,
                balance_after=u.chips_balance,
                reason="table_closed",
                description=f"Tavolo '{table.name}' chiuso",
            ))
        open_session = await _get_open_session(db, table.id, seat.user_id)
        if open_session:
            open_session.current_stack = seat.stack
            open_session.cashout = seat.stack
            open_session.result_chips = seat.stack - open_session.total_buyin
            open_session.ended_at = _now_utc()
            open_session.last_activity_at = _now_utc()
            open_session.status = "closed"
            open_session.close_reason = "table_closed"
        await db.delete(seat)

    table.status = "closed"
    await db.commit()

    game_manager.remove_table(str(table_id))
    logger.info("Tavolo %s chiuso da %s", table_id, current_user.username)


# ─────────────────────────────────────────────────────────────────────────────
# HELPER — validazione JWT per WebSocket
# ─────────────────────────────────────────────────────────────────────────────

async def _get_user_from_token(token: str, db: AsyncSession) -> Optional[User]:
    """Valida il JWT e restituisce l'utente. None se non valido."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id_str: Optional[str] = payload.get("sub")
        if not user_id_str:
            return None
        uid = uuid.UUID(user_id_str)
    except (JWTError, ValueError):
        return None
    result = await db.execute(select(User).where(User.id == uid))
    return result.scalar_one_or_none()


# ─────────────────────────────────────────────────────────────────────────────
# HELPER — costruisce il payload hand_end (con info split)
# ─────────────────────────────────────────────────────────────────────────────

def _build_hand_end_payload(game, table_id: str) -> dict:
    """
    Costruisce il dizionario da inviare come messaggio 'hand_end'.
    Gestisce sia il vincitore singolo che il pareggio (split pot).
    """
    vincite = game.vincite_mano
    seat_map = game_manager._seat_map.get(table_id, {})
    pid_to_seat = {pid: sn for pid, sn in seat_map.items()}

    seat_results: dict[int, int] = {}
    for pid in game.ordine:
        sn = pid_to_seat.get(pid)
        if sn is None:
            continue
        puntata = game.seats[pid].puntata_totale_mano
        vincita = vincite.get(pid, 0)
        seat_results[sn] = vincita - puntata

    # Vincitore principale (o primo in caso di pareggio)
    winner_name = None
    winner_seat = None
    winner_net = 0
    if vincite:
        main_pid = max(vincite, key=lambda p: vincite[p])
        winner_name = game.seats[main_pid].nome
        winner_seat = pid_to_seat.get(main_pid)
        winner_net = seat_results.get(winner_seat, vincite[main_pid])

    # Pareggio: più giocatori con la stessa vincita massima
    is_split = len(vincite) > 1
    split_winners = [
        {
            "name": game.seats[pid].nome,
            "seat": pid_to_seat.get(pid),
            "amount": amt,
        }
        for pid, amt in vincite.items()
    ] if is_split else []

    return {
        "type": "hand_end",
        "pot": sum(vincite.values()),
        "winner_name": winner_name,
        "winner_seat": winner_seat,
        "winner_net": winner_net,
        "seat_results": seat_results,
        "winners": [
            {"player_id": pid, "amount": amt}
            for pid, amt in vincite.items()
        ],
        "is_split": is_split,
        "split_winners": split_winners,
        "log": game.log[-10:],
    }


# ─────────────────────────────────────────────────────────────────────────────
# HELPER — persistenza fine mano
# ─────────────────────────────────────────────────────────────────────────────

async def _persist_hand_end(
    db: AsyncSession,
    table: PokerTable,
    game,
    hand_number: int,
):
    """
    Salva GameHand + HandAction in DB dopo la fine di una mano.
    Aggiorna chips_balance degli utenti e TableSeat.stack.
    """
    public = game.get_stato_pubblico()
    board_cards: list[str] = public.get("board", [])

    # Determina vincitore principale (seat con più vincite)
    vincite = game.vincite_mano   # {player_id (str user_id): importo}
    winner_pid: Optional[str] = None
    winner_desc: Optional[str] = None
    if vincite:
        winner_pid = max(vincite, key=lambda p: vincite[p])

    # Salva GameHand
    hand_record = GameHand(
        table_id=table.id,
        hand_number=hand_number,
        dealer_seat=_find_dealer_seat(game),
        small_blind_seat=_find_sb_seat(game),
        big_blind_seat=_find_bb_seat(game),
        community_cards=board_cards,
        pot=public.get("piatto_precedente", 0),  # il piatto viene azzerato dopo showdown
        ended_at=datetime.now(timezone.utc),
    )
    db.add(hand_record)
    await db.flush()  # per avere hand_record.id

    # Aggiorna stack nei TableSeat e chips_balance utenti (solo cash game)
    seats_result = await db.execute(
        select(TableSeat).where(TableSeat.table_id == table.id)
    )
    db_seats = {str(s.user_id): s for s in seats_result.scalars().all()}

    # Stack aggiornati nell'engine
    stacks_by_player: dict[str, int] = {}
    for player in public.get("giocatori", []):
        pid = player["player_id"]
        new_stack = player["stack"]
        stacks_by_player[pid] = new_stack
        db_seat = db_seats.get(pid)
        if db_seat is None:
            continue

        old_stack = db_seat.stack
        diff = new_stack - old_stack
        db_seat.stack = new_stack

        # Aggiorna chips_balance utente (solo cash game)
        user_res = await db.execute(select(User).where(User.id == uuid.UUID(pid)))
        u = user_res.scalar_one_or_none()
        if u is None:
            continue
        if diff != 0 and table.table_type == "cash":
            u.chips_balance += diff
            reason = "hand_win" if diff > 0 else "hand_loss"
            db.add(ChipsLedger(
                user_id=u.id,
                amount=diff,
                balance_after=u.chips_balance,
                reason=reason,
                game_id=hand_record.id,
                description=f"Mano #{hand_number} al tavolo '{table.name}'",
            ))

    # Aggiorna le sessioni aperte dei giocatori ancora seduti:
    # stack corrente, risultato progressivo e mani giocate.
    if stacks_by_player:
        session_result = await db.execute(
            select(PlayerGameSession).where(
                PlayerGameSession.table_id == table.id,
                PlayerGameSession.status == "open",
            )
        )
        for session in session_result.scalars().all():
            pid = str(session.user_id)
            if pid not in stacks_by_player:
                continue
            db_seat = db_seats.get(pid)
            if db_seat is None or db_seat.status == "away":
                continue
            session.current_stack = stacks_by_player[pid]
            session.result_chips = session.current_stack - session.total_buyin
            session.hands_played += 1
            session.last_activity_at = _now_utc()

    await db.commit()
    return hand_record


def _find_dealer_seat(game) -> int:
    for pid, s in game.seats.items():
        if s.è_dealer:
            return game_manager.seat_for_user("_", pid) or 0
    return 0


def _find_sb_seat(game) -> int:
    for pid, s in game.seats.items():
        if s.è_small_blind:
            return game_manager.seat_for_user("_", pid) or 0
    return 0


def _find_bb_seat(game) -> int:
    for pid, s in game.seats.items():
        if s.è_big_blind:
            return game_manager.seat_for_user("_", pid) or 0
    return 0


# ─────────────────────────────────────────────────────────────────────────────
# WEBSOCKET — /ws/table/{table_id}?token={jwt}
# ─────────────────────────────────────────────────────────────────────────────

@router.websocket("/ws/table/{table_id}")
async def websocket_table(
    websocket: WebSocket,
    table_id: str,
    token: str = Query(...),
):
    # ── 1. Valida JWT ──────────────────────────────────────────────────────
    async with AsyncSessionLocal() as db:
        current_user = await _get_user_from_token(token, db)

    if current_user is None:
        await websocket.close(code=4001)
        return

    user_id = str(current_user.id)

    # ── 2. Carica il tavolo dal DB ─────────────────────────────────────────
    async with AsyncSessionLocal() as db:
        tbl_result = await db.execute(
            select(PokerTable).where(PokerTable.id == uuid.UUID(table_id))
        )
        db_table = tbl_result.scalar_one_or_none()

    if db_table is None:
        await websocket.close(code=4004)
        return
    if db_table.status == "closed":
        await websocket.close(code=4004)
        return

    # ── 3. Accetta e registra la connessione ───────────────────────────────
    await websocket.accept()

    # Crea o recupera il GiocoPoker in memoria
    game = game_manager.get_or_create_table(
        table_id=table_id,
        small_blind=db_table.small_blind,
        big_blind=db_table.big_blind,
        speed=db_table.speed,
    )

    # Se il game in memoria è vuoto ma nel DB ci sono giocatori seduti,
    # ricostruisce lo stato (es. dopo riavvio del server)
    if len(game.ordine) == 0:
        async with AsyncSessionLocal() as db:
            seats_result = await db.execute(
                select(TableSeat, User)
                .join(User, TableSeat.user_id == User.id)
                .where(TableSeat.table_id == uuid.UUID(table_id))
            )
            db_seats = seats_result.all()
        for db_seat, seat_user in db_seats:
            uid = str(seat_user.id)
            display = seat_user.display_name or seat_user.username
            game.aggiungi_giocatore(uid, display, db_seat.stack)
            game_manager.register_seat(table_id, uid, db_seat.seat_number)
        if db_seats:
            logger.info("Stato tavolo %s ricostruito dal DB (%d giocatori)", table_id, len(db_seats))

    game_manager.add_connection(table_id, user_id, websocket)

    tournament_payload = None
    if db_table.table_type == "sitgo":
        async with AsyncSessionLocal() as db:
            t_result = await db.execute(
                select(SitGoTournament).where(SitGoTournament.table_id == db_table.id)
            )
            tournament = t_result.scalar_one_or_none()
        if tournament:
            level_ends_at = None
            schedule = tournament.blind_schedule or []
            level_idx = max(tournament.current_blind_level - 1, 0)
            if tournament.level_started_at and level_idx < len(schedule):
                duration = int(schedule[level_idx].get("duration_seconds", 0) or 0)
                if duration > 0:
                    level_ends_at = tournament.level_started_at + timedelta(seconds=duration)

            tournament_payload = {
                "id": str(tournament.id),
                "name": tournament.name,
                "speed": tournament.speed,
                "current_blind_level": tournament.current_blind_level,
                "blind_schedule": schedule,
                "level_ends_at": level_ends_at.isoformat() if level_ends_at else None,
            }

    # ── 4. Messaggio di benvenuto ──────────────────────────────────────────
    await websocket.send_json({
        "type": "welcome",
        "table": {
            "id": table_id,
            "name": db_table.name,
            "table_type": db_table.table_type,
            "min_players": db_table.min_players,
            "max_seats": db_table.max_seats,
            "speed": db_table.speed,
            "small_blind": db_table.small_blind,
            "big_blind": db_table.big_blind,
            "min_buyin": db_table.min_buyin,
            "max_buyin": db_table.max_buyin,
        },
        "state": _enrich_state(game.get_stato_pubblico(), game_manager._seat_map.get(table_id, {})),
        "user": {
            "id": user_id,
            "username": current_user.username,
            "display_name": current_user.display_name,
            "chips_balance": current_user.chips_balance,
        },
        "tournament": tournament_payload,
    })

    # Invia subito anche un messaggio "state" separato: garantisce che il frontend
    # veda i giocatori già seduti indipendentemente da come processa il welcome
    await websocket.send_json({
        "type": "state",
        "state": _enrich_state(game.get_stato_pubblico(), game_manager._seat_map.get(table_id, {})),
    })

    logger.info("WS connesso: user=%s tavolo=%s", current_user.username, table_id)

    # ── 5. Loop ricezione messaggi ─────────────────────────────────────────
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "JSON non valido"})
                continue

            msg_type = msg.get("type", "")

            try:
                # ── join_seat ────────────────────────────────────────────
                if msg_type == "join_seat":
                    await _handle_join_seat(websocket, db_table, game, current_user, msg, table_id)

                # ── leave_seat ───────────────────────────────────────────
                elif msg_type == "leave_seat":
                    await _handle_leave_seat(websocket, db_table, game, current_user, table_id)

                # ── action ───────────────────────────────────────────────
                elif msg_type == "action":
                    await _handle_action(websocket, db_table, game, current_user, msg, table_id)

                # ── chat ─────────────────────────────────────────────────
                elif msg_type == "chat":
                    text = str(msg.get("message", "")).strip()[:200]
                    if text:
                        await game_manager.broadcast(table_id, {
                            "type": "chat",
                            "from": current_user.username,
                            "message": text,
                            "ts": datetime.now(timezone.utc).isoformat(),
                        })

                # ── rebuy ────────────────────────────────────────────────
                elif msg_type == "rebuy":
                    await _handle_rebuy(websocket, db_table, game, current_user, msg, table_id)

                # ── ping ─────────────────────────────────────────────────
                elif msg_type == "ping":
                    await websocket.send_json({"type": "pong"})

                else:
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Tipo messaggio sconosciuto: {msg_type}",
                    })

            except Exception as e:
                logger.exception("Errore gestione messaggio %s da %s", msg_type, current_user.username)
                await websocket.send_json({
                    "type": "error",
                    "message": f"Errore interno: {str(e)[:100]}",
                })

    except WebSocketDisconnect:
        logger.info("WS disconnesso: user=%s tavolo=%s", current_user.username, table_id)
    except Exception:
        logger.exception("WS errore inatteso: user=%s", current_user.username)
    finally:
        # ── Pulizia disconnessione ─────────────────────────────────────────
        game_manager.remove_connection(table_id, user_id)

        # Disconnessione: il giocatore resta seduto nell'engine (timer gestirà
        # i suoi turni con auto check/fold). Sit-out solo se stack == 0.
        if game_manager.is_seated(table_id, user_id):
            # Aggiorna solo lo stato DB a "away" senza toccare l'engine
            async with AsyncSessionLocal() as db:
                seat_res = await db.execute(
                    select(TableSeat).where(
                        TableSeat.table_id == uuid.UUID(table_id),
                        TableSeat.user_id == current_user.id,
                    )
                )
                db_seat = seat_res.scalar_one_or_none()
                if db_seat:
                    db_seat.status = "away"
                    await db.commit()

            await game_manager.broadcast_state(table_id)


# ─────────────────────────────────────────────────────────────────────────────
# HANDLER join_seat
# ─────────────────────────────────────────────────────────────────────────────

async def _handle_join_seat(
    ws: WebSocket,
    db_table: PokerTable,
    game: Any,
    user: User,
    msg: dict,
    table_id: str,
):
    user_id = str(user.id)

    # Già seduto?
    if game_manager.is_seated(table_id, user_id):
        await ws.send_json({"type": "error", "message": "Sei già seduto a questo tavolo"})
        return

    seat_number = msg.get("seat")
    if not isinstance(seat_number, int) or not (0 <= seat_number < db_table.max_seats):
        await ws.send_json({"type": "error", "message": f"Posto non valido (0–{db_table.max_seats - 1})"})
        return

    if db_table.table_type == "sitgo":
        async with AsyncSessionLocal() as db:
            t_result = await db.execute(
                select(SitGoTournament).where(SitGoTournament.table_id == db_table.id)
            )
            tournament = t_result.scalar_one_or_none()
            if tournament is None:
                await ws.send_json({"type": "error", "message": "Torneo Sit&Go non trovato"})
                return
            if tournament.status != "running":
                await ws.send_json({"type": "error", "message": "Il torneo non è pronto per il seat-in"})
                return

            reg_result = await db.execute(
                select(SitGoRegistration).where(
                    SitGoRegistration.tournament_id == tournament.id,
                    SitGoRegistration.user_id == user.id,
                )
            )
            registration = reg_result.scalar_one_or_none()
            if registration is None:
                await ws.send_json({"type": "error", "message": "Non sei registrato a questo Sit&Go"})
                return
            if registration.final_position is not None:
                await ws.send_json({"type": "error", "message": "Sei già eliminato da questo torneo"})
                return

            if game_manager.user_for_seat(table_id, seat_number) is not None:
                await ws.send_json({"type": "error", "message": f"Il posto {seat_number} è già occupato"})
                return

            existing = await db.execute(
                select(TableSeat).where(
                    TableSeat.table_id == db_table.id,
                    TableSeat.seat_number == seat_number,
                )
            )
            if existing.scalar_one_or_none():
                await ws.send_json({"type": "error", "message": f"Il posto {seat_number} è già occupato"})
                return

            existing_user_seat = await db.execute(
                select(TableSeat).where(
                    TableSeat.table_id == db_table.id,
                    TableSeat.user_id == user.id,
                )
            )
            if existing_user_seat.scalar_one_or_none():
                await ws.send_json({"type": "error", "message": "Sei già seduto a questo tavolo"})
                return

            buyin = int(tournament.starting_chips)
            user_db = await db.get(User, user.id)
            if user_db is None:
                await ws.send_json({"type": "error", "message": "Utente non trovato"})
                return

            if registration.buy_in_amount <= 0:
                if user_db.chips_balance < tournament.buy_in:
                    await ws.send_json({"type": "error", "message": "Saldo insufficiente per il buy-in Sit&Go"})
                    return
                user_db.chips_balance -= tournament.buy_in
                registration.buy_in_amount = tournament.buy_in
                tournament.prize_pool += tournament.buy_in
                db.add(ChipsLedger(
                    user_id=user.id,
                    amount=-tournament.buy_in,
                    balance_after=user_db.chips_balance,
                    reason="sitgo_buyin",
                    game_id=tournament.id,
                    description=f"Buy-in Sit&Go '{tournament.name}'",
                ))

            db.add(
                TableSeat(
                    table_id=db_table.id,
                    user_id=user.id,
                    seat_number=seat_number,
                    stack=buyin,
                    status="active",
                )
            )
            open_session = await _get_open_session(db, db_table.id, user.id)
            if open_session:
                open_session.seat_number = seat_number
                open_session.current_stack = buyin
                open_session.last_activity_at = _now_utc()
            else:
                db.add(PlayerGameSession(
                    user_id=user.id,
                    table_id=db_table.id,
                    table_name=db_table.name,
                    table_type="sitgo",
                    seat_number=seat_number,
                    total_buyin=registration.buy_in_amount,
                    current_stack=buyin,
                    result_chips=0,
                    hands_played=0,
                    status="open",
                    started_at=_now_utc(),
                    last_activity_at=_now_utc(),
                ))
            seated_count_result = await db.execute(
                select(func.count()).select_from(TableSeat).where(
                    TableSeat.table_id == db_table.id,
                    TableSeat.status == "active",
                )
            )
            seated_count_db = seated_count_result.scalar() or 0
            await db.commit()

        display = user.display_name or user.username
        game.aggiungi_giocatore(user_id, display, buyin)
        game_manager.register_seat(table_id, user_id, seat_number)

        await game_manager.broadcast(table_id, {
            "type": "player_joined",
            "seat": seat_number,
            "user_id": user_id,
            "username": user.username,
            "display_name": display,
            "stack": buyin,
        })
        await game_manager.broadcast_state(table_id)

        seated = seated_count_db
        if not game.hand_in_progress() and game.num_mano == 0:
            if seated >= db_table.max_seats:
                asyncio.create_task(_delayed_start_hand(table_id, db_table, game, delay=3))
            else:
                await game_manager.broadcast(
                    table_id,
                    {
                        "type": "waiting_players",
                        "needed": max(0, db_table.max_seats - seated),
                    },
                )
        return

    buyin = msg.get("buyin")
    if not isinstance(buyin, (int, float)) or buyin <= 0:
        await ws.send_json({"type": "error", "message": "Buy-in non valido"})
        return
    buyin = int(buyin)

    # Controllo buyin
    async with AsyncSessionLocal() as db:
        user_res = await db.execute(select(User).where(User.id == user.id))
        fresh_user = user_res.scalar_one_or_none()

    if fresh_user is None:
        await ws.send_json({"type": "error", "message": "Utente non trovato"})
        return
    if buyin < db_table.min_buyin:
        await ws.send_json({"type": "error", "message": f"Buy-in minimo: {db_table.min_buyin}"})
        return
    if db_table.max_buyin and buyin > db_table.max_buyin:
        await ws.send_json({"type": "error", "message": f"Buy-in massimo: {db_table.max_buyin}"})
        return
    if buyin > fresh_user.chips_balance:
        await ws.send_json({"type": "error", "message": "Saldo insufficiente"})
        return

    # Posto già occupato? (controlla nell'engine e nel DB)
    if game_manager.user_for_seat(table_id, seat_number) is not None:
        await ws.send_json({"type": "error", "message": f"Il posto {seat_number} è già occupato"})
        return

    # Crea TableSeat nel DB e scala le chips
    async with AsyncSessionLocal() as db:
        # Verifica doppio nel DB (race condition)
        existing = await db.execute(
            select(TableSeat).where(
                TableSeat.table_id == db_table.id,
                TableSeat.seat_number == seat_number,
            )
        )
        if existing.scalar_one_or_none():
            await ws.send_json({"type": "error", "message": f"Il posto {seat_number} è già occupato"})
            return

        user_db_res = await db.execute(select(User).where(User.id == user.id))
        user_db = user_db_res.scalar_one()
        user_db.chips_balance -= buyin

        db_seat = TableSeat(
            table_id=db_table.id,
            user_id=user.id,
            seat_number=seat_number,
            stack=buyin,
            status="active",
        )
        db.add(db_seat)
        db.add(PlayerGameSession(
            user_id=user.id,
            table_id=db_table.id,
            table_name=db_table.name,
            table_type=db_table.table_type,
            seat_number=seat_number,
            total_buyin=buyin,
            current_stack=buyin,
            result_chips=0,
            hands_played=0,
            status="open",
            started_at=_now_utc(),
            last_activity_at=_now_utc(),
        ))
        db.add(ChipsLedger(
            user_id=user.id,
            amount=-buyin,
            balance_after=user_db.chips_balance,
            reason="table_buyin",
            description=f"Buy-in al tavolo '{db_table.name}' posto {seat_number}",
        ))
        await db.commit()

    # Registra nell'engine e nella seat map
    display = user.display_name or user.username
    game.aggiungi_giocatore(user_id, display, buyin)
    game_manager.register_seat(table_id, user_id, seat_number)

    logger.info("Giocatore %s si è seduto al posto %d (buy-in %d)", user.username, seat_number, buyin)

    await game_manager.broadcast(table_id, {
        "type": "player_joined",
        "seat": seat_number,
        "user_id": user_id,
        "username": user.username,
        "display_name": display,
        "stack": buyin,
    })
    await game_manager.broadcast_state(table_id)

    # Avvia la mano se ci sono abbastanza giocatori
    active = game.players_active_count()
    if active >= db_table.min_players and not game.hand_in_progress():
        asyncio.create_task(_delayed_start_hand(table_id, db_table, game, delay=3))


# ─────────────────────────────────────────────────────────────────────────────
# HANDLER leave_seat
# ─────────────────────────────────────────────────────────────────────────────

async def _handle_leave_seat(
    ws: WebSocket,
    db_table: PokerTable,
    game: Any,
    user: User,
    table_id: str,
):
    user_id = str(user.id)

    if not game_manager.is_seated(table_id, user_id):
        await ws.send_json({"type": "error", "message": "Non sei seduto a questo tavolo"})
        return
    tournament = None
    tournament_running = False
    if db_table.table_type == "sitgo":
        async with AsyncSessionLocal() as db:
            t_result = await db.execute(
                select(SitGoTournament).where(SitGoTournament.table_id == db_table.id)
            )
            tournament = t_result.scalar_one_or_none()
        tournament_running = bool(tournament and tournament.status == "running")

    seat_number = game_manager.seat_for_user(table_id, user_id)

    hand_was_in_progress = game.hand_in_progress()
    hand_num_before = game.num_mano

    # Se mano in corso: fold automatico
    if hand_was_in_progress:
        if game.turno_attivo == user_id:
            game_manager.cancel_action_timer(table_id)
        game.sit_out_player(user_id)

    # Recupera lo stack rimanente dall'engine
    engine_seat = game.seats.get(user_id)
    remaining_stack = engine_seat.stack if engine_seat else 0
    if db_table.table_type == "sitgo":
        remaining_stack = 0

    # Rimuovi dall'engine
    game.rimuovi_giocatore(user_id)
    game_manager.unregister_seat(table_id, user_id)

    # DB: restituisci stack e rimuovi TableSeat
    eliminated_now = False
    winner_user_id = None
    winner_stack = 0
    async with AsyncSessionLocal() as db:
        seat_res = await db.execute(
            select(TableSeat).where(
                TableSeat.table_id == db_table.id,
                TableSeat.user_id == user.id,
            )
        )
        db_seat = seat_res.scalar_one_or_none()
        if db_seat:
            await db.delete(db_seat)

        user_res = await db.execute(select(User).where(User.id == user.id))
        user_db = user_res.scalar_one()
        if remaining_stack > 0:
            user_db.chips_balance += remaining_stack
            db.add(ChipsLedger(
                user_id=user.id,
                amount=remaining_stack,
                balance_after=user_db.chips_balance,
                reason="table_cashout",
                description=f"Uscita dal tavolo '{db_table.name}' posto {seat_number}",
            ))
        final_position = None
        payout_awarded = 0
        if db_table.table_type == "sitgo" and tournament:
            reg_result = await db.execute(
                select(SitGoRegistration).where(
                    SitGoRegistration.tournament_id == tournament.id,
                    SitGoRegistration.user_id == user.id,
                )
            )
            reg = reg_result.scalar_one_or_none()
            if reg:
                if tournament_running and reg.final_position is None:
                    active_regs_result = await db.execute(
                        select(func.count()).select_from(SitGoRegistration).where(
                            SitGoRegistration.tournament_id == tournament.id,
                            SitGoRegistration.final_position.is_(None),
                        )
                    )
                    active_regs = active_regs_result.scalar() or 0
                    if active_regs > 0:
                        reg.final_position = active_regs
                        reg.chips_at_end = 0
                        eliminated_now = True

                    remaining_regs_result = await db.execute(
                        select(SitGoRegistration).where(
                            SitGoRegistration.tournament_id == tournament.id,
                            SitGoRegistration.final_position.is_(None),
                        )
                    )
                    remaining_regs = remaining_regs_result.scalars().all()
                    if len(remaining_regs) == 1:
                        winner_user_id = str(remaining_regs[0].user_id)
                        winner_stack = game_manager.get_player_stack(table_id, winner_user_id) or 0
                final_position = reg.final_position
                payout_awarded = reg.payout_awarded
        open_session = await _get_open_session(db, db_table.id, user.id)
        if open_session and db_table.table_type != "sitgo":
            open_session.current_stack = remaining_stack
            open_session.cashout = remaining_stack
            open_session.result_chips = remaining_stack - open_session.total_buyin
            open_session.ended_at = _now_utc()
            open_session.last_activity_at = _now_utc()
            open_session.status = "closed"
            open_session.close_reason = "left_table"
        if db_table.table_type == "sitgo" and tournament_running and winner_user_id:
            await db.flush()
            await _finish_tournament(
                tournament_id=str(tournament.id),
                winner_user_id=winner_user_id,
                winner_stack=winner_stack,
                table_id=table_id,
                db=db,
            )
            reg_result = await db.execute(
                select(SitGoRegistration).where(
                    SitGoRegistration.tournament_id == tournament.id,
                    SitGoRegistration.user_id == user.id,
                )
            )
            reg = reg_result.scalar_one_or_none()
            if reg:
                final_position = reg.final_position
                payout_awarded = reg.payout_awarded
        else:
            await db.commit()

    display = user.display_name or user.username
    if eliminated_now and final_position:
        await game_manager.broadcast(
            table_id,
            {
                "type": "player_eliminated",
                "seat": seat_number,
                "position": final_position,
                "username": user.username,
            },
        )
    await game_manager.broadcast(table_id, {
        "type": "player_left",
        "seat": seat_number,
        "username": user.username,
        "display_name": display,
        "stack_returned": remaining_stack,
        "final_position": final_position,
        "payout_awarded": payout_awarded,
    })
    await game_manager.broadcast_state(table_id)

    # Se il fold ha concluso la mano, trasmetti hand_end e persisti
    if hand_was_in_progress and game.fase == FaseGioco.FINE_MANO and game.num_mano == hand_num_before:
        await game_manager.broadcast(table_id, _build_hand_end_payload(game, table_id))
        async with AsyncSessionLocal() as db:
            tbl_res = await db.execute(select(PokerTable).where(PokerTable.id == db_table.id))
            db_table_fresh = tbl_res.scalar_one_or_none()
            if db_table_fresh:
                await _persist_hand_end(db, db_table_fresh, game, game.num_mano)
                if db_table_fresh.table_type == "sitgo":
                    await handle_sitgo_hand_end(table_id, db)

    # Torna a "waiting" se non ci sono abbastanza giocatori
    active = game.players_active_count()
    if db_table.table_type != "sitgo" and active < db_table.min_players and not game.hand_in_progress():
        async with AsyncSessionLocal() as db:
            tbl = await db.get(PokerTable, db_table.id)
            if tbl:
                tbl.status = "waiting"
                await db.commit()
        await game_manager.broadcast(table_id, {
            "type": "waiting_players",
            "needed": db_table.min_players - active,
        })


# ─────────────────────────────────────────────────────────────────────────────
# HANDLER rebuy
# ─────────────────────────────────────────────────────────────────────────────

async def _handle_rebuy(
    ws: WebSocket,
    db_table: PokerTable,
    game: Any,
    user: User,
    msg: dict,
    table_id: str,
):
    user_id = str(user.id)
    if not game_manager.is_seated(table_id, user_id):
        await ws.send_json({"type": "error", "message": "Non sei seduto a questo tavolo"})
        return
    if db_table.table_type == "sitgo":
        await ws.send_json({"type": "error", "message": "Nel Sit&Go il rebuy non è consentito"})
        return

    amount = int(msg.get("amount", 0))
    if amount <= 0:
        await ws.send_json({"type": "error", "message": "Importo ricarica non valido"})
        return

    async with AsyncSessionLocal() as db:
        user_res = await db.execute(select(User).where(User.id == user.id))
        user_db = user_res.scalar_one()
        if user_db.chips_balance < amount:
            await ws.send_json({"type": "error", "message": "Saldo profilo insufficiente"})
            return

        seat_res = await db.execute(
            select(TableSeat).where(
                TableSeat.table_id == db_table.id,
                TableSeat.user_id == user.id,
            )
        )
        db_seat = seat_res.scalar_one_or_none()
        if not db_seat:
            await ws.send_json({"type": "error", "message": "Posto non trovato"})
            return

        # Verifica limite max_buyin
        current_stack = db_seat.stack
        max_buyin = db_table.max_buyin
        if max_buyin and (current_stack + amount) > max_buyin:
            amount = max_buyin - current_stack
            if amount <= 0:
                await ws.send_json({"type": "error", "message": "Hai già raggiunto il massimo al tavolo"})
                return

        # Aggiorna DB
        user_db.chips_balance -= amount
        db_seat.stack += amount
        open_session = await _get_open_session(db, db_table.id, user.id)
        if open_session:
            open_session.total_buyin += amount
            open_session.current_stack = db_seat.stack
            open_session.result_chips = open_session.current_stack - open_session.total_buyin
            open_session.last_activity_at = _now_utc()
        db.add(ChipsLedger(
            user_id=user.id,
            amount=-amount,
            balance_after=user_db.chips_balance,
            reason="table_buyin",
            description=f"Ricarica al tavolo '{db_table.name}'",
        ))
        await db.commit()

    # Aggiorna stack nell'engine e rimetti ATTIVO se era SEDUTO_OUT
    engine_seat = game.seats.get(user_id)
    if engine_seat:
        engine_seat.stack += amount
        if engine_seat.stato == StatoSeat.SEDUTO_OUT and engine_seat.stack > 0:
            engine_seat.stato = StatoSeat.ATTIVO

    # Notifica tutti del rebuy
    await game_manager.broadcast(table_id, {
        "type": "rebuy_done",
        "seat": game_manager.seat_for_user(table_id, user_id),
        "username": user.username,
        "amount": amount,
        "new_stack": engine_seat.stack if engine_seat else db_seat.stack + amount,
    })
    await game_manager.broadcast_state(table_id)

    # Avvia nuova mano se ora ci sono abbastanza giocatori attivi
    active = game.players_active_count()
    if active >= db_table.min_players and not game.hand_in_progress():
        asyncio.create_task(_delayed_start_hand(table_id, db_table, game, delay=2, show_countdown=False))


# ─────────────────────────────────────────────────────────────────────────────
# HANDLER action
# ─────────────────────────────────────────────────────────────────────────────

_ACTION_MAP = {
    "fold":  AzioneGioco.FOLD,
    "check": AzioneGioco.CHECK,
    "call":  AzioneGioco.CALL,
    "raise": AzioneGioco.RAISE,
    "allin": AzioneGioco.ALL_IN,
}

async def _handle_action(
    ws: WebSocket,
    db_table: PokerTable,
    game: Any,
    user: User,
    msg: dict,
    table_id: str,
):
    user_id = str(user.id)

    if not game_manager.is_seated(table_id, user_id):
        await ws.send_json({"type": "error", "message": "Non sei seduto a questo tavolo"})
        return
    if not game.hand_in_progress():
        await ws.send_json({"type": "error", "message": "Nessuna mano in corso"})
        return
    if game.turno_attivo != user_id:
        await ws.send_json({"type": "error", "message": "Non è il tuo turno"})
        return

    action_str = msg.get("action", "")
    azione = _ACTION_MAP.get(action_str)
    if azione is None:
        await ws.send_json({"type": "error", "message": f"Azione non valida: {action_str}"})
        return

    amount = int(msg.get("amount", 0))

    # Cancella il timer prima di applicare l'azione
    game_manager.cancel_action_timer(table_id)

    # Cattura la fase prima dell'azione
    fase_before = game.fase

    ok = game.applica_azione(user_id, azione, amount)
    if not ok:
        await ws.send_json({"type": "error", "message": "Azione non consentita"})
        # Riavvia il timer perché il turno non è cambiato
        if game.hand_in_progress() and game.turno_attivo:
            await game_manager.start_action_timer(table_id, game.turno_attivo)
        return

    await _post_action_advance(table_id, fase_before, db_table=db_table)


async def _post_action_advance(
    table_id: str,
    fase_before: Any,
    db_table: Optional[PokerTable] = None,
) -> None:
    """
    Gestisce tutto ciò che segue l'applicazione di un'azione (manuale o da timeout):
    hand_end → persist + broadcast, new_street, avvio timer prossimo giocatore.
    Usato sia da _handle_action che dal callback timer in game_manager.
    """
    game = game_manager.get_table(table_id)
    if game is None:
        return

    # Carica db_table se non passato (caso timeout timer)
    if db_table is None:
        async with AsyncSessionLocal() as db:
            tbl_res = await db.execute(select(PokerTable).where(PokerTable.id == uuid.UUID(table_id)))
            db_table = tbl_res.scalar_one_or_none()
        if db_table is None:
            return

    # ── Fine mano ─────────────────────────────────────────────────────────
    if game.fase == FaseGioco.FINE_MANO:
        vincite = game.vincite_mano
        await game_manager.broadcast_state(table_id)

        await game_manager.broadcast(table_id, _build_hand_end_payload(game, table_id))

        async with AsyncSessionLocal() as db:
            tbl_res = await db.execute(select(PokerTable).where(PokerTable.id == db_table.id))
            db_table_fresh = tbl_res.scalar_one()
            await _persist_hand_end(db, db_table_fresh, game, game.num_mano)
            if db_table_fresh.table_type == "sitgo":
                await handle_sitgo_hand_end(table_id, db)

        await _handle_busted_players(table_id, game, db_table.id)

        active = game.players_active_count()
        if active >= db_table.min_players:
            asyncio.create_task(_delayed_start_hand(table_id, db_table, game, delay=3, show_countdown=False))
        else:
            await game_manager.broadcast(table_id, {
                "type": "waiting_players",
                "needed": db_table.min_players - active,
            })
        return

    # ── Fase cambiata (nuova street) ──────────────────────────────────────
    if game.fase != fase_before:
        await game_manager.broadcast_state(table_id)
        await game_manager.broadcast(table_id, {
            "type": "new_street",
            "phase": game.fase.value,
            "board": [str(c) for c in game.board],
        })
        # All-in runout: nessun turno attivo → rivela le carte rimanenti una street alla volta
        if game.turno_attivo is None and game.fase not in (FaseGioco.FINE_MANO, FaseGioco.IN_ATTESA):
            asyncio.create_task(_run_out_cards(table_id, db_table, game.num_mano))
            return
    else:
        await game_manager.broadcast_state(table_id)

    # ── Avvia timer per il prossimo giocatore ─────────────────────────────
    if game.hand_in_progress() and game.turno_attivo:
        await game_manager.start_action_timer(table_id, game.turno_attivo)


# ─────────────────────────────────────────────────────────────────────────────
# HELPER — all-in runout: rivela carte community una street alla volta
# ─────────────────────────────────────────────────────────────────────────────

async def _run_out_cards(table_id: str, db_table: Any, num_mano: int) -> None:
    """
    Quando tutti i giocatori sono all-in, rivela le carte community
    una street alla volta con un delay tra l'una e l'altra:
    - FLOP (3 carte) già mostrato: aspetta 2s → gira TURN
    - TURN: aspetta 1.5s → gira RIVER
    - RIVER: aspetta 1.5s → showdown + fine mano
    """
    while True:
        game = game_manager.get_table(table_id)
        if game is None or game.num_mano != num_mano:
            return

        if game.fase == FaseGioco.FINE_MANO:
            break

        # Delay in base a quante carte sono appena state mostrate
        delay = 2.0 if game.fase == FaseGioco.FLOP else 1.5
        await asyncio.sleep(delay)

        game = game_manager.get_table(table_id)
        if game is None or game.num_mano != num_mano:
            return

        fase_before = game.fase
        game._avanza_fase()

        await game_manager.broadcast_state(table_id)

        if game.fase != fase_before and game.fase != FaseGioco.FINE_MANO:
            await game_manager.broadcast(table_id, {
                "type": "new_street",
                "phase": game.fase.value,
                "board": [str(c) for c in game.board],
            })

        if game.fase == FaseGioco.FINE_MANO:
            break

    # ── Fine mano dopo runout ──────────────────────────────────────────────
    game = game_manager.get_table(table_id)
    if game is None or game.num_mano != num_mano:
        return

    await game_manager.broadcast(table_id, _build_hand_end_payload(game, table_id))

    if db_table is None:
        async with AsyncSessionLocal() as db:
            tbl_res = await db.execute(select(PokerTable).where(PokerTable.id == uuid.UUID(table_id)))
            db_table = tbl_res.scalar_one_or_none()
        if db_table is None:
            return

    async with AsyncSessionLocal() as db:
        tbl_res = await db.execute(select(PokerTable).where(PokerTable.id == db_table.id))
        db_table_fresh = tbl_res.scalar_one()
        await _persist_hand_end(db, db_table_fresh, game, game.num_mano)
        if db_table_fresh.table_type == "sitgo":
            await handle_sitgo_hand_end(table_id, db)

    await _handle_busted_players(table_id, game, db_table.id)

    active = game.players_active_count()
    async with AsyncSessionLocal() as db:
        tbl_res = await db.execute(select(PokerTable).where(PokerTable.id == db_table.id))
        db_table_latest = tbl_res.scalar_one_or_none()
    if db_table_latest and active >= db_table_latest.min_players:
        asyncio.create_task(_delayed_start_hand(table_id, db_table_latest, game, delay=3, show_countdown=False))
    else:
        await game_manager.broadcast(table_id, {
            "type": "waiting_players",
            "needed": (db_table_latest.min_players if db_table_latest else 2) - active,
        })


# ─────────────────────────────────────────────────────────────────────────────
# HELPER — avvio mano ritardato
# ─────────────────────────────────────────────────────────────────────────────

async def _handle_busted_players(table_id: str, game: Any, db_table_id) -> None:
    """
    Dopo fine mano: mette in SEDUTO_OUT i giocatori con stack == 0
    e notifica tutti i connessi.
    """
    seat_map = game_manager._seat_map.get(table_id, {})
    pid_to_seat = {pid: sn for pid, sn in seat_map.items()}
    busted = []
    for pid, s in game.seats.items():
        if s.stack == 0 and s.stato != StatoSeat.SEDUTO_OUT:
            s.stato = StatoSeat.SEDUTO_OUT
            busted.append((pid, s.nome, pid_to_seat.get(pid)))

    if not busted:
        return

    # Aggiorna DB + broadcast
    async with AsyncSessionLocal() as db:
        for pid, nome, seat_num in busted:
            seat_res = await db.execute(
                select(TableSeat).where(
                    TableSeat.table_id == db_table_id,
                    TableSeat.user_id == uuid.UUID(pid),
                )
            )
            db_seat = seat_res.scalar_one_or_none()
            if db_seat:
                db_seat.status = "sit_out"
        await db.commit()

    for pid, nome, seat_num in busted:
        await game_manager.broadcast(table_id, {
            "type": "player_sit_out",
            "seat": seat_num,
            "username": nome,
            "reason": "busted",
        })
        logger.info("Giocatore %s (posto %s) a 0 chips → sit-out", nome, seat_num)


async def _delayed_start_hand(
    table_id: str,
    db_table: PokerTable,
    game: Any,
    delay: float = 3.0,
    show_countdown: bool = True,
):
    """Attende delay secondi poi avvia una nuova mano se le condizioni sono soddisfatte."""
    if show_countdown:
        await game_manager.broadcast(table_id, {
            "type": "game_starting",
            "countdown": int(delay),
        })
    await asyncio.sleep(delay)

    if game.hand_in_progress():
        return  # nel frattempo qualcuno ha già avviato una mano

    active = game.players_active_count()
    if active < db_table.min_players:
        await game_manager.broadcast(table_id, {
            "type": "waiting_players",
            "needed": db_table.min_players - active,
        })
        return

    started = game.inizia_mano()
    if not started:
        return

    # Aggiorna status tavolo nel DB
    async with AsyncSessionLocal() as db:
        tbl_res = await db.execute(select(PokerTable).where(PokerTable.id == db_table.id))
        tbl = tbl_res.scalar_one_or_none()
        if tbl and tbl.status == "waiting":
            tbl.status = "running"
            await db.commit()

    if db_table.table_type == "sitgo" and game.num_mano == 1:
        await ensure_sitgo_blinds_started(table_id)

    logger.info("Nuova mano #%d avviata al tavolo %s", game.num_mano, table_id)

    await game_manager.broadcast(table_id, {
        "type": "hand_start",
        "hand_number": game.num_mano,
    })

    # Invia hole cards in privato a ciascun giocatore
    for user_id, seat_number in (game_manager._seat_map.get(table_id) or {}).items():
        cards = game.hole_cards_for(user_id)
        if cards:
            await game_manager.send_to(table_id, user_id, {
                "type": "hole_cards",
                "cards": cards,
                "seat": seat_number,
            })

    await game_manager.broadcast_state(table_id)

    # Avvia il timer per il primo giocatore di turno
    if game.turno_attivo:
        await game_manager.start_action_timer(table_id, game.turno_attivo)


# ── Registra il callback post-azione per i timeout timer ─────────────────────
# Fatto a fine modulo così _post_action_advance è già definita.
game_manager.set_post_action_handler(_post_action_advance)
