"""
game_manager.py — Singleton che gestisce tutte le partite in memoria.

Tiene traccia di:
  - istanze GiocoPoker per ogni tavolo
  - connessioni WebSocket attive
  - timer d'azione per il giocatore di turno
  - mapping seat_number ↔ user_id per ogni tavolo
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, Optional

from fastapi import WebSocket

from poker_engine import AzioneGioco, FaseGioco, GiocoPoker

logger = logging.getLogger("ridotto.game_manager")


class GameManager:
    # ── Costanti ────────────────────────────────────────────────────────────
    SPEED_TIMERS: Dict[str, int] = {"slow": 30, "normal": 20, "fast": 10}

    def __init__(self):
        # table_id (str UUID) → istanza del gioco
        self._tables: Dict[str, GiocoPoker] = {}

        # table_id → { user_id (str): WebSocket }
        self._connections: Dict[str, Dict[str, WebSocket]] = {}

        # table_id → asyncio.Task del timer corrente
        self._action_timers: Dict[str, asyncio.Task] = {}

        # table_id → "slow" | "normal" | "fast"
        self._table_speeds: Dict[str, str] = {}

        # table_id → tournament_id (str UUID) — solo per tavoli Sit & Go
        self._tournament_map: Dict[str, str] = {}

        # table_id → { user_id (str): seat_number (int) }
        # contiene solo i giocatori effettivamente seduti
        self._seat_map: Dict[str, Dict[str, int]] = {}

    # ── Gestione tavoli ─────────────────────────────────────────────────────

    def get_or_create_table(
        self,
        table_id: str,
        small_blind: int,
        big_blind: int,
        speed: str = "normal",
    ) -> GiocoPoker:
        """
        Restituisce il GiocoPoker esistente o ne crea uno nuovo.
        Registra la speed per il timer d'azione.
        """
        if table_id not in self._tables:
            self._tables[table_id] = GiocoPoker(
                small_blind=small_blind,
                big_blind=big_blind,
            )
            self._seat_map[table_id] = {}
            logger.info("Creato nuovo GiocoPoker per tavolo %s (SB=%d BB=%d)", table_id, small_blind, big_blind)
        self._table_speeds[table_id] = speed
        return self._tables[table_id]

    def get_table(self, table_id: str) -> Optional[GiocoPoker]:
        return self._tables.get(table_id)

    def get_player_stack(self, table_id: str, player_id: str) -> Optional[int]:
        """Ritorna lo stack attuale di un giocatore nel motore, o None se non trovato."""
        game = self._tables.get(table_id)
        if game is None:
            return None
        seat = game.seats.get(player_id)
        return seat.stack if seat is not None else None

    def remove_table(self, table_id: str):
        """Rimuove il tavolo dalla memoria (chiamato quando status='closed')."""
        self.cancel_action_timer(table_id)
        self._tables.pop(table_id, None)
        self._connections.pop(table_id, None)
        self._action_timers.pop(table_id, None)
        self._table_speeds.pop(table_id, None)
        self._seat_map.pop(table_id, None)

    # ── Gestione tournament map ──────────────────────────────────────────────

    def register_tournament(self, table_id: str, tournament_id: str):
        self._tournament_map[table_id] = tournament_id

    def unregister_tournament(self, table_id: str):
        self._tournament_map.pop(table_id, None)

    def get_tournament_id(self, table_id: str) -> Optional[str]:
        return self._tournament_map.get(table_id)

    # ── Gestione seat map ───────────────────────────────────────────────────

    def seat_for_user(self, table_id: str, user_id: str) -> Optional[int]:
        return self._seat_map.get(table_id, {}).get(user_id)

    def user_for_seat(self, table_id: str, seat_number: int) -> Optional[str]:
        for uid, sn in self._seat_map.get(table_id, {}).items():
            if sn == seat_number:
                return uid
        return None

    def register_seat(self, table_id: str, user_id: str, seat_number: int):
        if table_id not in self._seat_map:
            self._seat_map[table_id] = {}
        self._seat_map[table_id][user_id] = seat_number

    def unregister_seat(self, table_id: str, user_id: str):
        self._seat_map.get(table_id, {}).pop(user_id, None)

    def is_seated(self, table_id: str, user_id: str) -> bool:
        return user_id in self._seat_map.get(table_id, {})

    # ── Gestione connessioni WebSocket ──────────────────────────────────────

    def add_connection(self, table_id: str, user_id: str, ws: WebSocket):
        if table_id not in self._connections:
            self._connections[table_id] = {}
        self._connections[table_id][user_id] = ws
        logger.debug("Connessione aggiunta: tavolo=%s user=%s (tot=%d)",
                     table_id, user_id, len(self._connections[table_id]))

    def remove_connection(self, table_id: str, user_id: str):
        conns = self._connections.get(table_id, {})
        conns.pop(user_id, None)
        logger.debug("Connessione rimossa: tavolo=%s user=%s", table_id, user_id)

    def get_connections_count(self, table_id: str) -> int:
        return len(self._connections.get(table_id, {}))

    def get_spectators_count(self, table_id: str) -> int:
        """Connessioni WS di utenti NON seduti al tavolo."""
        seated = set(self._seat_map.get(table_id, {}).keys())
        connected = set(self._connections.get(table_id, {}).keys())
        return len(connected - seated)

    # ── Broadcast / send ────────────────────────────────────────────────────

    async def broadcast(self, table_id: str, message: dict):
        """Invia un messaggio a tutti gli utenti connessi al tavolo."""
        conns = self._connections.get(table_id, {})
        dead: list[str] = []
        for uid, ws in list(conns.items()):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(uid)
        for uid in dead:
            conns.pop(uid, None)

    async def send_to(self, table_id: str, user_id: str, message: dict):
        """Invia un messaggio a un singolo utente."""
        ws = self._connections.get(table_id, {}).get(user_id)
        if ws is None:
            return
        try:
            await ws.send_json(message)
        except Exception:
            self._connections.get(table_id, {}).pop(user_id, None)

    async def broadcast_state(self, table_id: str):
        """
        Invia lo stato pubblico a tutti + hole cards private a ciascun giocatore seduto.
        """
        game = self._tables.get(table_id)
        if game is None:
            return

        public = game.get_stato_pubblico()

        # Stato pubblico a tutti
        await self.broadcast(table_id, {"type": "state", "state": public})

        # Hole cards private a chi è seduto e ha carte
        for user_id, seat_number in self._seat_map.get(table_id, {}).items():
            cards = game.hole_cards_for(user_id)
            if cards:
                await self.send_to(table_id, user_id, {
                    "type": "hole_cards",
                    "cards": cards,
                    "seat": seat_number,
                })

    # ── Timer azione ────────────────────────────────────────────────────────

    async def start_action_timer(self, table_id: str, player_id: str):
        """
        Avvia il conto alla rovescia per il giocatore di turno.
        Alla scadenza: fold automatico (o check se disponibile).
        Cancella eventuali timer precedenti.
        """
        self.cancel_action_timer(table_id)

        seconds = self.SPEED_TIMERS.get(
            self._table_speeds.get(table_id, "normal"), 20
        )

        async def _timer():
            # Notifica il tempo rimasto al client
            await self.send_to(table_id, player_id, {
                "type": "action_timer",
                "seconds": seconds,
                "player_id": player_id,
            })
            await self.broadcast(table_id, {
                "type": "action_timer",
                "seconds": seconds,
                "player_id": player_id,
            })
            await asyncio.sleep(seconds)

            game = self._tables.get(table_id)
            if game is None or game.turno_attivo != player_id:
                return  # Il giocatore ha già agito

            # Determina azione automatica: check se disponibile, altrimenti fold
            azioni = game.azioni_valide(player_id)
            azione_auto = AzioneGioco.FOLD
            for az in azioni:
                if az["azione"] == AzioneGioco.CHECK:
                    azione_auto = AzioneGioco.CHECK
                    break

            logger.info("Timer scaduto per %s al tavolo %s → %s", player_id, table_id, azione_auto.value)
            game.applica_azione(player_id, azione_auto, 0)
            await self.broadcast_state(table_id)

            # Avvia il prossimo timer se la mano è ancora in corso
            if game.hand_in_progress() and game.turno_attivo:
                await self.start_action_timer(table_id, game.turno_attivo)

        task = asyncio.create_task(_timer())
        self._action_timers[table_id] = task

    def cancel_action_timer(self, table_id: str):
        task = self._action_timers.pop(table_id, None)
        if task and not task.done():
            task.cancel()
            logger.debug("Timer annullato per tavolo %s", table_id)


# ── Singleton globale ────────────────────────────────────────────────────────
game_manager = GameManager()
