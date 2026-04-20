# CLAUDE.md — Backend Ridotto Poker

## Stack
Python 3.12 · FastAPI · SQLAlchemy 2.0 async · Pydantic v2 · Supabase PostgreSQL

## File esistenti e loro stato

### ✅ COMPLETI — non riscrivere
| File | Cosa contiene |
|---|---|
| `poker_engine.py` | Motore Texas Hold'em completo. Classi: `Carta`, `Mazzo`, `GiocoPoker`, `ValutatoreRisultato`, `FaseGioco`, `StatoSeat`. Testato. |
| `game_manager.py` | Singleton `GameManager`. Gestisce tavoli in memoria (`_tables`), connessioni WS (`_connections`), timer azioni (`_action_timers`), speed (`_table_speeds`). |
| `auth.py` | `hash_password`, `verify_password`, `create_access_token`, `get_current_user` (Depends). |
| `database.py` | `AsyncSessionLocal`, `get_db()` dependency, `Base`. |
| `config.py` | `Settings` con pydantic-settings, legge da `.env`. |
| `models.py` | User, ChipsLedger, InviteCode, PokerTable, TableSeat, GameHand, HandAction, SitGoTournament, SitGoRegistration. Tutti con UUID pk e datetime timezone. |
| `schemas.py` | Schemi Pydantic per auth, user, tavoli. Da estendere con SitGoCreate/Response. |
| `routers/auth_router.py` | POST /auth/register (con invite_code), POST /auth/login, GET /auth/me |
| `routers/admin_router.py` | Inviti, gestione utenti, add chips. Richiede `is_admin=True`. |
| `routers/ws_router.py` | GET/POST/DELETE /tables, GET /tables/{id}, WebSocket /ws/table/{id} |
| `migrations/001_invite_codes.sql` | Schema invite_codes + is_admin su users |
| `migrations/002_tables_hands_sitgo.sql` | Schema poker_tables, table_seats, game_hands, hand_actions, sitgo_* |

### ⚠️ DA COMPLETARE
| File | Cosa manca |
|---|---|
| `routers/users_router.py` | Aggiungere `GET /users/me/stats` e `GET /users/me/game-history` e `GET /users/me/current-seat` |
| `routers/ws_router.py` | Verificare sync DB in join_seat/leave_seat; aggiungere recupero stato su reconnect |

### ❌ DA CREARE
| File | Cosa deve fare |
|---|---|
| `routers/sitgo_router.py` | CRUD sit&go, register/unregister, start tournament, blind timer, eliminazioni |
| `scheduler.py` | APScheduler daily_chips_refill (ogni giorno alle 06:00 Europe/Rome) |

## Convenzioni obbligatorie

### Async ovunque
```python
# SEMPRE così
async def get_tables(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PokerTable).where(...))
    return result.scalars().all()
```

### UUID e datetime
```python
# UUID
id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

# Datetime
created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
```

### Errori HTTP in italiano
```python
raise HTTPException(status_code=400, detail="Codice invito non valido")
raise HTTPException(status_code=403, detail="Non autorizzato")
raise HTTPException(status_code=404, detail="Tavolo non trovato")
```

### Schemi in schemas.py
Non definire mai schemi Pydantic dentro i file router. Vanno tutti in `schemas.py`.

### WebSocket — pattern standard
```python
@router.websocket("/ws/table/{table_id}")
async def ws_table(websocket: WebSocket, table_id: str, token: str = Query(...)):
    # 1. valida token
    # 2. accetta connessione
    # 3. registra in game_manager
    # 4. loop try/except WebSocketDisconnect
    # 5. finally: rimuovi connessione
```

## Modelli importanti — riferimento rapido

### PokerTable
```python
table_type: "cash" | "sitgo"
speed: "slow" | "normal" | "fast"
status: "waiting" | "running" | "paused" | "closed"
min_players: int  # minimo per tenere attiva la mano
max_seats: int    # massimo posti al tavolo
```

### SitGoTournament
```python
status: "registering" | "running" | "finished"
# Il torneo parte quando n_registered == max_seats (non min_players)
# min_players serve solo per il gioco durante il torneo
```

### GameHand + HandAction
```python
# HandAction.phase: "preflop" | "flop" | "turn" | "river"
# HandAction.action: "fold" | "check" | "call" | "raise" | "allin"
# ChipsLedger.reason: "registration_bonus" | "daily_refill" | "hand_win" | "hand_loss" | "sitgo_win" | "sitgo_loss" | "admin_add"
```

## Speed → valori
```python
ACTION_TIMERS   = {"slow": 30, "normal": 20, "fast": 10}   # secondi per azione
BLIND_DURATIONS = {"slow": 900, "normal": 600, "fast": 300} # secondi per livello

BLIND_SCHEDULES = {
    "slow":   [{"level":1,"sb":25,"bb":50,"dur":900}, {"level":2,"sb":50,"bb":100,"dur":900},
               {"level":3,"sb":75,"bb":150,"dur":900}, {"level":4,"sb":150,"bb":300,"dur":900},
               {"level":5,"sb":300,"bb":600,"dur":900}],
    "normal": [{"level":1,"sb":25,"bb":50,"dur":600}, {"level":2,"sb":50,"bb":100,"dur":600},
               {"level":3,"sb":75,"bb":150,"dur":600}, {"level":4,"sb":150,"bb":300,"dur":600},
               {"level":5,"sb":300,"bb":600,"dur":600}],
    "fast":   [{"level":1,"sb":25,"bb":50,"dur":300}, {"level":2,"sb":50,"bb":100,"dur":300},
               {"level":3,"sb":100,"bb":200,"dur":300}, {"level":4,"sb":200,"bb":400,"dur":300},
               {"level":5,"sb":400,"bb":800,"dur":300}],
}
```

## poker_engine.py — classi (nomi in italiano, NON cambiare)
```python
from poker_engine import (
    GiocoPoker,      # State machine del gioco
    Carta,           # Card
    Mazzo,           # Deck
    ValutatoreRisultato,  # HandEvaluator
    FaseGioco,       # GamePhase enum
    StatoSeat,       # SeatStatus enum
    Seat,            # PlayerSeat
)

# Costruttore
game = GiocoPoker(table_id="uuid", min_players=2, max_seats=6)

# Metodi principali
game.add_player(seat=0, user_id="uuid", username="Marco", stack=1000)
game.can_start()           # bool
game.start_hand()          # List[GameEvent]
game.apply_action(seat=0, action="raise", amount=100)  # List[GameEvent]
game.get_stato_pubblico()  # dict (senza hole cards)
game.get_stato_per("user_id")  # dict (con hole cards del giocatore)
```

## Nota su main.py
Ogni nuovo router va aggiunto in `main.py`:
```python
app.include_router(sitgo_router)  # da aggiungere
```
