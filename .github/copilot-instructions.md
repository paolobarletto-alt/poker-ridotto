# Ridotto Poker — Copilot Instructions

## Progetto
App poker privata per un gruppo ristretto di amici. Texas Hold'em No-Limit, chips finte,
nessun soldo reale. Accesso solo tramite codice invito. Nome app: **Ridotto**.

## Stack tecnico

| Layer | Tecnologia |
|---|---|
| Backend | Python 3.12 · FastAPI · SQLAlchemy 2.0 async · Alembic |
| Database | PostgreSQL su Supabase |
| Realtime | WebSocket nativo FastAPI |
| Frontend | Vite + React 18 · React Router v6 · Axios |
| Deploy | Backend su Render · Frontend statico (Render o Netlify) |

---

## Stato implementazione — cosa NON toccare

I seguenti componenti sono **completi e funzionanti**. Non riscriverli, non refactorizzarli
salvo bug espliciti:

### Backend — già fatto
- `backend/poker_engine.py` — motore Texas Hold'em completo (classi in italiano: `Carta`, `Mazzo`, `GiocoPoker`, `ValutatoreRisultato`). **Non rinominare le classi.**
- `backend/game_manager.py` — singleton `GameManager` con tavoli in memoria, WebSocket, timer azioni
- `backend/auth.py` — JWT, bcrypt, `get_current_user` dependency
- `backend/database.py` — async engine Supabase
- `backend/models.py` — tutti i modelli SQLAlchemy (User, ChipsLedger, InviteCode, PokerTable, TableSeat, GameHand, HandAction, SitGoTournament, SitGoRegistration)
- `backend/routers/auth_router.py` — register (con invite_code), login, /auth/me
- `backend/routers/admin_router.py` — inviti, gestione utenti, add chips
- `backend/routers/ws_router.py` — REST tavoli (CRUD) + WebSocket `/ws/table/{id}`

### Frontend — già fatto
- `frontend/src/context/AuthContext.jsx` — AuthProvider, useAuth(), token in localStorage
- `frontend/src/api/client.js` — axios con interceptor JWT
- `frontend/src/pages/LoginPage.jsx` — login + registrazione con invite_code
- `frontend/src/components/Shell.jsx` — Sidebar, TopBar, GoldButton, TrafficLights
- `frontend/src/hooks/usePokerTable.js` — hook WebSocket (ricezione stato, parziale)

---

## Cosa è in corso / da completare

In ordine di priorità:

1. **`usePokerTable.js`** — aggiungere `sendAction`, `sendChat`, `joinSeat`, `leaveSeat`
2. **`Table.jsx`** — collegare al hook reale, aggiungere timer visivo, showdown overlay
3. **`BuyinDialog.jsx`** e **`CreateTableModal.jsx`** — nuovi componenti, ancora da creare
4. **`Lobby.jsx`** — sostituire dati mock con fetch reali + polling 10s
5. **`backend/routers/sitgo_router.py`** — da creare da zero (Sit & Go completo)
6. **Frontend Sit & Go** — pannello torneo in `Table.jsx`, messaggi `blind_level_up`, `player_eliminated`
7. **`backend/scheduler.py`** — ricarica automatica chips giornaliera (APScheduler)
8. **`GET /users/me/stats`** e **`GET /users/me/game-history`** — da aggiungere a `users_router.py`
9. **`Profile.jsx`** — sostituire dati mock con fetch reali

Vedi `PIANO_IMPLEMENTAZIONE_V2.md` per i prompt dettagliati di ogni passo.

---

## Convenzioni backend

### Struttura file
```
backend/
  main.py              # FastAPI app, include tutti i router
  config.py            # Settings da .env (usa pydantic-settings)
  database.py          # get_db() dependency
  auth.py              # JWT + get_current_user
  models.py            # TUTTI i modelli SQLAlchemy in un solo file
  schemas.py           # TUTTI gli schemi Pydantic in un solo file
  poker_engine.py      # Logica poker pura (no FastAPI)
  game_manager.py      # Singleton tavoli in memoria
  scheduler.py         # APScheduler (da creare)
  routers/
    auth_router.py
    admin_router.py
    users_router.py
    ws_router.py        # REST + WebSocket tavoli
    sitgo_router.py     # (da creare)
  migrations/
    001_invite_codes.sql
    002_tables_hands_sitgo.sql
```

### Regole codice
- **Tutto async**: usa `async def` e `await` ovunque ci sia I/O
- **Dependency injection**: sempre `Depends(get_db)` e `Depends(get_current_user)`
- **Schemi separati dai modelli**: modelli in `models.py`, Pydantic in `schemas.py`
- **UUID come PK**: tutti i modelli usano `UUID(as_uuid=True)` come primary key
- **Datetime con timezone**: sempre `DateTime(timezone=True)` e `datetime.now(timezone.utc)`
- **Errori HTTP**: usa `HTTPException` con detail in italiano (es. `"Email già registrata"`)
- **Logging**: usa `logging.getLogger("ridotto")` per log significativi
- **Niente print()** nel codice di produzione

### Modello speed → timers
```python
ACTION_TIMERS = {"slow": 30, "normal": 20, "fast": 10}  # secondi per azione
BLIND_DURATIONS = {"slow": 900, "normal": 600, "fast": 300}  # secondi per livello
```

### WebSocket — protocollo messaggi
Il WebSocket è su `/ws/table/{table_id}?token={jwt}`.
Tutti i messaggi sono JSON. Il server è **autoritativo** — il client non aggiorna mai
lo stato da solo, aspetta sempre il broadcast dal server.

**Client → Server:** `join_seat`, `leave_seat`, `action`, `chat`, `ping`
**Server → Client (broadcast):** `table_state`, `player_action`, `showdown`, `hand_end`,
`waiting_players`, `player_joined`, `player_left`, `blind_level_up`, `player_eliminated`,
`tournament_ended`, `chat`, `error`, `pong`
**Server → Client (privato):** `welcome`, `hole_cards`

---

## Convenzioni frontend

### Regola d'oro del design — NON VIOLARE MAI
Il frontend usa un design **dark luxury** con CSS inline. **Non aggiungere mai:**
- File CSS separati
- Librerie UI (MUI, Chakra, Tailwind, Ant Design, ecc.)
- className con stili esterni
- `styled-components` o `emotion`

Tutto lo stile va come oggetto inline: `style={{ color: '#D4AF37', fontSize: 14 }}`

### Design system
```
Sfondi:    #050505 (body)  #0a0a0a (pannelli)  #0e0e0e (modali)
Oro:       #D4AF37 (primario)  #E8C252 (hover/gradient top)  #B8941F (gradient bottom)
Testo:     #F5F1E8 (primario)  rgba(245,241,232,0.6) (secondario)  rgba(245,241,232,0.35) (disabilitato)
Rosso:     #c0392b (errori, fold, eliminazione)
Verde:     #1a4a2e (feltro tavolo)  #28c840 (traffic light)
Bordi:     rgba(212,175,55,0.12) (sottile)  rgba(212,175,55,0.25) (normale)  #D4AF37 (focus/active)

Font:      'Playfair Display', serif    → titoli, nomi, valori importanti
           'Inter', sans-serif          → UI, label, testo normale
           'JetBrains Mono', monospace  → chip, numeri, codici, timestamp

Bottone primario (GoldButton solid):
  background: linear-gradient(180deg, #E8C252, #B8941F)
  color: #0a0a0a  font-weight: 600  letter-spacing: 0.15em  text-transform: uppercase

Bottone secondario (GoldButton ghost):
  background: transparent  color: #D4AF37
  border: 1px solid rgba(212,175,55,0.4)
```

### Struttura cartelle frontend
```
frontend/src/
  api/
    client.js           # axios instance con interceptor JWT
    auth.js             # login, register, me
    tables.js           # list, get, create, join, leave + sitgo CRUD
  components/
    Shell.jsx           # Sidebar, TopBar, GoldButton, TrafficLights — NON TOCCARE
    Lobby.jsx           # Lista tavoli (in aggiornamento)
    Table.jsx           # Tavolo poker live (in aggiornamento)
    Profile.jsx         # Profilo utente (in aggiornamento)
    BuyinDialog.jsx     # DA CREARE — modale scelta buyin
    CreateTableModal.jsx # DA CREARE — form crea tavolo/sit&go
  context/
    AuthContext.jsx     # useAuth() — NON TOCCARE
  hooks/
    usePokerTable.js    # hook WebSocket tavolo (in completamento)
    useTableChat.js     # hook chat (da completare)
  pages/
    LoginPage.jsx       # NON TOCCARE
    LobbyPage.jsx
    TablePage.jsx       # in aggiornamento
    ProfilePage.jsx
    AdminPage.jsx
  App.jsx               # Router + ProtectedRoute
  main.jsx
```

### Regole codice frontend
- **Componenti funzionali** con hooks, niente class components
- **CSS inline** come oggetti JavaScript, mai classi esterne
- **useAuth()** per accedere a user/token (mai leggere direttamente localStorage)
- **api/client.js** per tutte le chiamate HTTP (mai fetch() diretto)
- **React Router `useNavigate`** per navigazione programmatica
- **useRef** per WebSocket (evita re-render inutili)
- Testo UI in **italiano** (questa è un'app italiana per amici italiani)
- Niente `console.log` in produzione

---

## Variabili d'ambiente

### Backend (.env)
```
DATABASE_URL=postgresql+asyncpg://...supabase...
SECRET_KEY=...
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
FRONTEND_URL=https://...
DAILY_REFILL_THRESHOLD=1000
DAILY_REFILL_AMOUNT=10000
```

### Frontend (.env)
```
VITE_API_URL=https://...onrender.com
```

---

## Note importanti
- **Aggiorna questo file dopo ogni modific o aggiunta di codice**.

- **poker_engine.py usa nomi italiani** per le classi (`Carta` non `Card`, `Mazzo` non `Deck`,
  `GiocoPoker` non `PokerGame`). Non tradurre o rinominare.
- Il **server è autoritativo** per lo stato del gioco. Il client non calcola mai
  il risultato di un'azione — aspetta sempre la risposta del server.
- Le **chips sono in unità intere** (BigInteger nel DB). Niente decimali.
- Il **Sit & Go parte quando si raggiunge `max_seats`** iscritti, non `min_players`.
  `min_players` è il minimo per tenere il tavolo attivo durante il gioco.
- **Nessun utente admin per default**: il primo admin va impostato manualmente nel DB
  (`UPDATE users SET is_admin = true WHERE username = 'paolo'`).
