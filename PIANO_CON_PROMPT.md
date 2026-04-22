# Ridotto Poker — Piano di sviluppo con prompt Claude Code

> Ogni sezione contiene la descrizione del lavoro da fare + un prompt pronto da incollare in Claude Code.
> Stack: FastAPI + SQLAlchemy async + Supabase PostgreSQL (backend) · Vite + React (frontend)
> App privata per amici: Texas Hold'em, chips finte, Cash Game + Sit & Go, accesso a inviti.

---

## SEZIONE 1 — Migrazione Frontend a Vite + React

### Cosa fa
Sostituisce il vecchio sistema HTML + React CDN + Babel runtime con un progetto Vite moderno. I 4 componenti esistenti (shell, lobby, table, profile) vengono portati come file `.jsx` dentro `src/`. Si aggiunge React Router per la navigazione, un client API (axios) e un `AuthContext` per lo stato utente globale.

### File coinvolti
- `frontend/` (tutta la cartella, nuovo scaffolding)
- `frontend/components/shell.jsx`, `lobby.jsx`, `table.jsx`, `profile.jsx` (da portare)

---

### 📋 Prompt 1-A — Scaffolding Vite + migrazione componenti

```
Sei un esperto di React e Vite. Lavoro su un'app poker privata chiamata "Ridotto".

CONTESTO:
Il frontend attuale è un file HTML singolo con React 18 caricato da CDN e JSX interpretato 
runtime da Babel. Devo migrarlo a un progetto Vite + React moderno.

Ho già 4 componenti esistenti che vanno preservati (li trovi nella cartella frontend/components/):
- shell.jsx: Sidebar, TopBar, GoldButton, TrafficLights (componenti shell dell'app)
- lobby.jsx: Schermata lobby con Tornei, Cash Game, Sit & Go, Fast (dati mock per ora)
- table.jsx: Tavolo poker visivo con carte, posti, action bar, log mano (simulazione statica)
- profile.jsx: Profilo utente con statistiche, grafico P/L SVG, storico partite (dati mock)

DESIGN DA PRESERVARE INTATTO:
- Font: Playfair Display (serif, titoli), Inter (sans, UI), JetBrains Mono (numeri)
- Palette: sfondo #050505/#0a0a0a, oro #D4AF37, crema #F5F1E8, verde feltro #1a4a2e
- Stile: dark luxury, tutto CSS-in-JS inline (niente file CSS separati)
- Componente GoldButton con varianti "solid" e "ghost"

TASK:
1. Crea la struttura del progetto Vite in frontend/:
   - src/components/ (Shell.jsx, Lobby.jsx, Table.jsx, Profile.jsx)
   - src/pages/ (LoginPage.jsx, LobbyPage.jsx, TablePage.jsx, ProfilePage.jsx)
   - src/api/ (client.js con axios, auth.js, tables.js)
   - src/context/AuthContext.jsx
   - src/App.jsx con React Router (routes: /, /lobby, /table/:id, /profile)
   - index.html, vite.config.js, package.json

2. Porta i componenti esistenti nel nuovo formato ES module (rimuovi i `const { useState } = React` 
   e usa import normali, rimuovi `Object.assign(window, {...})`)

3. Crea AuthContext.jsx con:
   - stato: user (null o oggetto utente), token (string), isLoading
   - funzioni: login(email, password), logout(), register(data)
   - salva/leggi il JWT da localStorage
   - al mount chiama GET /auth/me per recuperare l'utente se il token esiste

4. Crea src/api/client.js:
   - axios instance con baseURL da import.meta.env.VITE_API_URL
   - interceptor request: aggiunge Authorization: Bearer {token} se presente
   - interceptor response: se 401 chiama logout() e reindirizza al login

5. Configura vite.config.js con proxy: /api → http://localhost:8000 in sviluppo

6. Crea .env.example con VITE_API_URL=https://your-backend.onrender.com

Non implementare ancora la logica di gioco reale — i componenti Lobby e Table 
continuano a usare i dati mock esistenti per ora.
```

---

### 📋 Prompt 1-B — LoginPage

```
Sto costruendo "Ridotto", un'app poker privata. Il backend FastAPI è già pronto 
con questi endpoint:
  POST /auth/login   body: { email, password }   → { access_token, user: {...} }
  POST /auth/register body: { username, email, password, display_name, invite_code }  → { access_token, user }

DESIGN SYSTEM (da rispettare rigorosamente):
- Sfondo: radial-gradient da #1a1008 a #050505
- Font titoli: Playfair Display serif, font UI: Inter, font numeri: JetBrains Mono
- Colore oro: #D4AF37, testo primario: #F5F1E8, testo secondario: rgba(245,241,232,0.6)
- Input: sfondo rgba(255,255,255,0.04), border rgba(212,175,55,0.2), focus border #D4AF37
- Bottone primario: gradient oro (da #E8C252 a #B8941F), testo #0a0a0a
- Niente border-radius eccessive — stile squadrato/minimalista

TASK: Crea src/pages/LoginPage.jsx con:
1. Due tab: "Accedi" e "Registrati" (switcha con stato locale)
2. Form Login: email + password + bottone "Entra"
3. Form Registrazione: username + email + password + display_name (opzionale) + 
   campo "Codice invito" (obbligatorio) + bottone "Crea account"
4. Usa AuthContext per chiamare login() e register()
5. Mostra errori inline dal server (es. "Email già registrata")
6. Loading state sul bottone durante la chiamata
7. Al centro della pagina: logo "Ridotto." con sottotitolo "POKER CLUB PRIVATO"
8. Dopo login/register reindirizza a /lobby via React Router

Lo stile deve essere coerente con il resto dell'app (dark luxury, oro).
Non usare librerie UI esterne — solo CSS inline come nel resto del progetto.
```

---

## SEZIONE 2 — Sistema Inviti + Pannello Admin

### Cosa fa
Aggiunge al backend la gestione dei codici invito monouso. La registrazione viene bloccata senza un codice valido. Un pannello admin permette all'utente admin di generare link di invito e vedere la lista degli utenti.

### File coinvolti (backend)
- `backend/models.py` (aggiunta modello InviteCode)
- `backend/routers/admin_router.py` (nuovo)
- `backend/routers/auth_router.py` (modifica /register)
- `backend/schemas.py` (nuovi schemi)

---

### 📋 Prompt 2-A — Backend sistema inviti

```
Sto costruendo "Ridotto", un'app poker privata in FastAPI + SQLAlchemy async + Supabase PostgreSQL.

STRUTTURA ESISTENTE:
- models.py ha: User (id UUID, username, email, password_hash, chips_balance, is_active, ...) 
  e ChipsLedger
- auth_router.py ha: POST /auth/register (UserRegister: username, email, password, display_name)
- Il modello User ha già is_active bool ma NON ha un campo is_admin

TASK:

1. In models.py aggiungi:
   - Campo `is_admin: bool = False` al modello User
   - Nuovo modello InviteCode:
     - id UUID, code String(12) unique, 
     - created_by UUID → users.id,
     - used_by UUID → users.id nullable,
     - used_at DateTime nullable,
     - expires_at DateTime nullable (se None = non scade),
     - max_uses Int default 1,
     - use_count Int default 0,
     - is_active bool default True,
     - created_at DateTime

2. In schemas.py aggiungi:
   - InviteCodeCreate: expires_in_days (optional int), max_uses (default 1)
   - InviteCodeResponse: tutti i campi + campo computed "is_valid" (bool)
   - UserRegister: aggiungi campo invite_code: str

3. Crea backend/routers/admin_router.py con prefix /admin, tag "admin":
   - Dependency `require_admin`: verifica che current_user.is_admin sia True, 
     altrimenti 403 Forbidden
   - POST /admin/invites: genera un codice random (12 chars alfanumerici), 
     salva in DB, ritorna InviteCodeResponse con il link completo 
     (usa settings.FRONTEND_URL + "/join?code=" + code)
   - GET /admin/invites: lista tutti i codici con statistiche uso
   - DELETE /admin/invites/{code}: disattiva un codice
   - GET /admin/users: lista tutti gli utenti (username, email, chips_balance, 
     is_active, created_at, last_login_at)
   - PATCH /admin/users/{user_id}/toggle-active: attiva/disattiva un utente
   - POST /admin/users/{user_id}/add-chips: aggiunge chips a un utente 
     (body: { amount: int, reason: str })

4. Modifica auth_router.py POST /auth/register:
   - Il payload ora include invite_code (str, obbligatorio)
   - Valida che il codice esista, sia is_active=True, non sia scaduto, 
     e use_count < max_uses
   - Se non valido: 400 "Codice invito non valido o scaduto"
   - Dopo la registrazione: incrementa use_count, se use_count >= max_uses 
     setta is_active=False, imposta used_by e used_at

5. In config.py aggiungi FRONTEND_URL nelle settings

Includi le migration Alembic (alembic revision --autogenerate) o in alternativa 
fornisci lo script SQL per creare le nuove tabelle.
```

---

### 📋 Prompt 2-B — Frontend pannello admin

```
Sto costruendo "Ridotto", app poker privata. Il backend ha questi endpoint admin:
  POST /admin/invites → { code, link, expires_at, max_uses }
  GET /admin/invites → lista codici
  DELETE /admin/invites/{code}
  GET /admin/users → lista utenti
  PATCH /admin/users/{id}/toggle-active
  POST /admin/users/{id}/add-chips  body: { amount, reason }

DESIGN (da rispettare, stesso stile dell'app):
- Dark luxury, sfondo #0a0a0a, oro #D4AF37, font Playfair Display + Inter
- Tutto CSS inline, niente librerie UI esterne

TASK: Crea src/pages/AdminPage.jsx con:

1. Protezione route: se current_user.is_admin è false → redirect a /lobby

2. Due tab nella pagina: "Inviti" e "Utenti"

3. TAB INVITI:
   - Bottone "Genera nuovo invito" che apre un mini-form (scadenza in giorni: 
     input numerico opzionale, usi massimi: default 1)
   - Chiama POST /admin/invites e mostra il link generato con bottone "Copia"
   - Tabella codici esistenti con colonne: Codice, Link (troncato), 
     Usato (n/max), Scadenza, Stato, Azione (disattiva)

4. TAB UTENTI:
   - Tabella utenti: Username, Email, Chips, Ultimo accesso, Stato (Attivo/Disabilitato)
   - Per ogni utente: bottone toggle attivo/disabilitato
   - Per ogni utente: bottone "Aggiungi chips" → apre inline form con importo + motivo

5. Header della pagina con TopBar (componente esistente) subtitle="PANNELLO ADMIN"

Importa e usa il client axios da src/api/client.js che gestisce già il JWT.
```

---

## SEZIONE 3 — Motore di Gioco Backend

### Cosa fa
Il cuore dell'app. Un modulo Python con tutta la logica Texas Hold'em (mazzo, distribuzione, valutazione mani, macchina a stati del gioco) e un server WebSocket FastAPI che gestisce le stanze in memoria e trasmette gli aggiornamenti in tempo reale.

### File coinvolti (backend)
- `backend/poker_engine.py` (nuovo — logica pura)
- `backend/game_manager.py` (nuovo — gestione stanze in memoria)
- `backend/routers/tables_router.py` (nuovo — REST per lista tavoli)
- `backend/routers/ws_router.py` (nuovo — WebSocket)
- `backend/models.py` (aggiunta modelli gioco)

---

### 📋 Prompt 3-A — Poker engine (logica pura)

```
Crea backend/poker_engine.py, un modulo Python puro (niente FastAPI, niente DB) 
che implementa tutta la logica del Texas Hold'em No-Limit.

REQUISITI:

1. CLASSI BASE:
   - Suit: Enum (SPADES, HEARTS, DIAMONDS, CLUBS) con simbolo unicode (♠♥♦♣)
   - Rank: Enum (TWO=2 ... ACE=14) con label ("2","3"..."T","J","Q","K","A")
   - Card(suit, rank): frozen dataclass con metodo __str__ → "A♠", "K♥"
   - Deck: 52 carte, metodo shuffle(), deal(n) → List[Card]

2. VALUTAZIONE MANI (HandEvaluator):
   - Dato un set di 5–7 carte, trova la migliore combinazione di 5
   - Ritorna HandResult(rank: HandRank, tiebreakers: List[int], cards: List[Card], description: str)
   - HandRank enum: HIGH_CARD(1) ... ROYAL_FLUSH(10)
   - compare(hand_a, hand_b) → -1, 0, 1
   - Gestisce correttamente l'asso come 1 nello straight A-2-3-4-5

3. GAME STATE MACHINE:
   Classe PokerGame con questi attributi:
   - table_id: str
   - min_players: int (configurabile, default 2 — passato nel costruttore)
   - max_seats: int (configurabile, default 9 — passato nel costruttore)
   - seats: Dict[int, Optional[PlayerSeat]] (dimensione = max_seats)
   - phase: GamePhase enum (WAITING, PREFLOP, FLOP, TURN, RIVER, SHOWDOWN)
   - community_cards: List[Card]
   - pot: int (in chips)
   - side_pots: List[SidePot] (per gestire all-in)
   - current_actor: int (indice seat)
   - dealer_seat: int
   - hand_number: int
   - deck: Deck
   - min_bet: int (big blind corrente)
   - current_bet: int (puntata da eguagliare nel round)
   
   Costruttore: __init__(table_id, min_players=2, max_seats=9)
   
   PlayerSeat(seat: int, user_id: str, username: str, stack: int, 
              hole_cards: List[Card], bet_in_round: int, 
              status: SeatStatus, last_action: str)
   
   SeatStatus enum: ACTIVE, FOLDED, ALL_IN, SITTING_OUT, EMPTY

   Metodi pubblici:
   - add_player(seat, user_id, username, stack) → bool
     (verifica che seat < max_seats)
   - remove_player(seat)
   - can_start() → bool (giocatori ACTIVE >= min_players)
   - start_hand() → GameEvent list (eventi generati: deal, blinds)
   - apply_action(seat, action: str, amount: int=0) → GameEvent list
     - Valida che sia il turno del giocatore
     - Actions: "fold", "check", "call", "raise", "allin"
     - Valida amounts (raise minimo = big blind o doppio last raise)
     - Avanza il turno al prossimo giocatore attivo
     - Quando il round di puntate finisce, avanza la fase (flop/turn/river/showdown)
   - get_state_for(user_id: str) → dict (hole_cards visibili solo al proprietario)
   - get_public_state() → dict (senza hole_cards)
   
   GameEvent: typed dict con type (deal_hole_cards, community_card, action, 
               phase_change, showdown, hand_end, error) e payload

4. LOGICA SPECIALE:
   - Side pot: se un giocatore va all-in con meno della puntata corrente, 
     crea side pot per i giocatori che possono vincerlo
   - Showdown: confronta le mani di tutti i non-foldati, assegna pot/side pot,
     aggiorna gli stack
   - Un giocatore solo rimasto (tutti gli altri foldano): vince senza showdown
   - Se round di puntate finisce con un solo giocatore non foldato: stessa cosa

5. TEST: aggiungi if __name__ == "__main__" con un test di una mano completa 
   tra 3 giocatori per verificare il funzionamento.

Usa solo libreria standard Python (random, itertools, enum, dataclasses). 
Commenta le sezioni complesse. Tutto in italiano.
```

---

### 📋 Prompt 3-B — Modelli DB per le partite

```
Sto costruendo "Ridotto", app poker FastAPI + SQLAlchemy async.
Il file models.py esistente ha già: User, ChipsLedger, InviteCode.
Usa lo stesso stile (Mapped, mapped_column, UUID, datetime con timezone).

TASK: Aggiungi a models.py questi nuovi modelli:

1. PokerTable:
   - id UUID pk
   - name String(50): nome del tavolo (es. "Tavolo Verde")
   - table_type String(20): "cash" o "sitgo"
   - min_players Int: numero minimo di giocatori per far partire la mano (2-9)
   - max_seats Int: numero massimo di posti al tavolo (2-9, >= min_players)
   - speed String(20): "slow" | "normal" | "fast"
     (determina il timer d'azione: slow=30s, normal=20s, fast=10s)
   - small_blind BigInteger
   - big_blind BigInteger
   - min_buyin BigInteger
   - max_buyin BigInteger (nullable — per cash game; per sitgo è lo starting_chips)
   - status String(20): "waiting" | "running" | "paused" | "closed"
   - is_private bool default False (per future funzionalità)
   - created_by UUID → users.id (chiunque può creare un tavolo, non solo admin)
   - created_at DateTime
   Relationship: seats → List[TableSeat]

2. TableSeat:
   - id UUID pk
   - table_id UUID → poker_tables.id
   - user_id UUID → users.id
   - seat_number Int (0-8)
   - stack BigInteger (chips portate al tavolo, decrementate/incrementate durante il gioco)
   - status String(20): "active" | "sitting_out" | "away"
   - joined_at DateTime
   UniqueConstraint: (table_id, seat_number), (table_id, user_id)
   Relationships: table, user

3. GameHand:
   - id UUID pk
   - table_id UUID → poker_tables.id
   - hand_number Int
   - dealer_seat Int
   - small_blind_seat Int
   - big_blind_seat Int  
   - community_cards JSON (lista stringhe: ["A♠","K♥","Q♦","J♣","10♠"])
   - pot BigInteger
   - winner_seat Int nullable
   - winning_hand_description String(50) nullable (es. "Scala Reale")
   - started_at DateTime
   - ended_at DateTime nullable
   Relationship: actions → List[HandAction]

4. HandAction:
   - id UUID pk
   - hand_id UUID → game_hands.id
   - user_id UUID → users.id
   - seat_number Int
   - phase String(20): "preflop"|"flop"|"turn"|"river"
   - action String(20): "fold"|"check"|"call"|"raise"|"allin"
   - amount BigInteger default 0
   - stack_before BigInteger
   - stack_after BigInteger
   - created_at DateTime

5. SitGoTournament:
   - id UUID pk
   - name String(100)
   - min_players Int: quanti iscritti servono perché il torneo parta (2-9)
   - max_seats Int: posti massimi (>= min_players)
   - starting_chips BigInteger (stack iniziale per ogni giocatore)
   - speed String(20): "slow"|"normal"|"fast"
     (determina durata livelli blind: slow=900s, normal=600s, fast=300s
      e timer d'azione: slow=30s, normal=20s, fast=10s)
   - status String(20): "registering"|"running"|"finished"
   - blind_schedule JSON: lista di {level, small_blind, big_blind, duration_seconds}
     generata automaticamente dalla speed:
       slow   → [{1,25,50,900},{2,50,100,900},{3,75,150,900},{4,150,300,900},{5,300,600,900}]
       normal → [{1,25,50,600},{2,50,100,600},{3,75,150,600},{4,150,300,600},{5,300,600,600}]
       fast   → [{1,25,50,300},{2,50,100,300},{3,100,200,300},{4,200,400,300},{5,400,800,300}]
   - current_blind_level Int default 1
   - level_started_at DateTime nullable
   - table_id UUID → poker_tables.id nullable
   - created_by UUID → users.id (qualsiasi utente può creare un sit&go)
   - started_at DateTime nullable
   - finished_at DateTime nullable
   Relationship: registrations → List[SitGoRegistration]

6. SitGoRegistration:
   - id UUID pk
   - tournament_id UUID → sitgo_tournaments.id
   - user_id UUID → users.id
   - final_position Int nullable (1=vincitore)
   - chips_at_end BigInteger nullable
   - registered_at DateTime
   UniqueConstraint: (tournament_id, user_id)

Fornisci anche lo script Alembic (env.py già configurato) o lo SQL grezzo 
per creare tutte le tabelle nuove.
```

---

### 📋 Prompt 3-C — WebSocket server + Game Manager

```
Sto costruendo "Ridotto", app poker FastAPI. Ho già:
- backend/poker_engine.py con la classe PokerGame e tutta la logica Texas Hold'em
- models.py con: User, PokerTable (campi: min_players, max_seats, speed, small_blind,
  big_blind, min_buyin, max_buyin, created_by, status), TableSeat, GameHand, HandAction
- auth.py con get_current_user (Depends su JWT)

Il campo "speed" del tavolo determina il timer d'azione:
  "slow" → 30 secondi | "normal" → 20 secondi | "fast" → 10 secondi

TASK: Crea due file:

--- FILE 1: backend/game_manager.py ---

GameManager singleton che gestisce tutte le partite in memoria:

class GameManager:
    _tables: Dict[str, PokerGame]       # table_id → PokerGame
    _connections: Dict[str, Dict[str, WebSocket]]  # table_id → {user_id: ws}
    _action_timers: Dict[str, asyncio.Task]         # table_id → timer task corrente
    _table_speeds: Dict[str, str]                   # table_id → "slow"|"normal"|"fast"

    SPEED_TIMERS = {"slow": 30, "normal": 20, "fast": 10}

    Metodi:
    - get_or_create_table(table_id, config, speed="normal") → PokerGame
      (salva la speed in _table_speeds)
    - add_connection(table_id, user_id, ws: WebSocket)
    - remove_connection(table_id, user_id)
    - async broadcast(table_id, message: dict)
    - async send_to(table_id, user_id, message: dict)
    - async broadcast_state(table_id)
        manda get_public_state() a tutti + hole_cards private a ciascuno
    - async start_action_timer(table_id, seat):
        legge i secondi da SPEED_TIMERS[_table_speeds[table_id]]
        dopo N secondi se il giocatore non ha agito → fold automatico
        (oppure check se check è disponibile in quel momento)
    - cancel_action_timer(table_id)
    - get_connections_count(table_id) → int (quanti spettatori/giocatori connessi)

Variabile globale: game_manager = GameManager()

--- FILE 2: backend/routers/ws_router.py ---

REST routes (prefix /tables):

  GET /tables
    Lista tavoli con status != "closed", ordinati per created_at desc.
    Risposta arricchita: per ogni tavolo include
      - players_seated: count(TableSeat) dove table_id corrisponde
      - spectators: count connessioni WS non sedute (da game_manager)
      - config: { min_players, max_seats, speed, small_blind, big_blind,
                  min_buyin, max_buyin, table_type }
    Autenticazione richiesta (get_current_user).

  POST /tables
    APERTO A QUALSIASI UTENTE AUTENTICATO (non solo admin).
    Body (schema TableCreate):
      - name: str (3-50 chars)
      - table_type: "cash" | "sitgo"
      - min_players: int (2-9)
      - max_seats: int (2-9, deve essere >= min_players)
      - speed: "slow" | "normal" | "fast"
      - small_blind: int (> 0)
      - big_blind: int (= small_blind * 2, validato server-side)
      - min_buyin: int (>= big_blind * 10)
      - max_buyin: int nullable (per cash; se null = no limite)
    Salva in DB con created_by = current_user.id, status = "waiting".
    Ritorna TableResponse con tutti i campi + link /table/{id}.

  GET /tables/{table_id}
    Dettaglio tavolo + lista posti occupati (username, seat_number, stack, status).
    Accessibile a tutti gli utenti autenticati.

  DELETE /tables/{table_id}
    Chiude il tavolo (status = "closed").
    Solo il creatore del tavolo (created_by == current_user.id) o un admin.
    Non permesso se ci sono giocatori seduti con mano in corso.

WebSocket:
  GET /ws/table/{table_id}?token={jwt}
  (JWT come query param perché i browser non supportano header custom sui WS)

  All'apertura connessione:
  1. Valida il JWT token
  2. Carica il PokerTable dal DB; se status == "closed" → chiudi con codice 4004
  3. Registra la connessione in game_manager (anche se non si è ancora seduti)
  4. Carica la speed del tavolo in game_manager._table_speeds
  5. Manda subito al client:
     { type: "welcome", table: {name, table_type, min_players, max_seats, speed,
       small_blind, big_blind, min_buyin, max_buyin}, state: <public_state> }

  Loop ricezione messaggi:

  { "type": "join_seat", "seat": 3, "buyin": 1000 }
    → verifica che il posto (0 <= seat < max_seats) sia libero
    → verifica buyin >= min_buyin e buyin <= user.chips_balance
    → se max_buyin: verifica buyin <= max_buyin
    → scala le chips da User.chips_balance, crea TableSeat in DB
    → chiama game.add_player(seat, user_id, username, buyin)
    → se players_active >= min_players e la mano non è in corso → start_hand() dopo 3s
    → broadcast_state()
    → broadcast { type: "player_joined", seat, username, stack: buyin }

  { "type": "leave_seat" }
    → se mano in corso: fold automatico sul suo seat
    → restituisci lo stack rimanente a User.chips_balance, aggiorna ChipsLedger
    → rimuovi TableSeat dal DB, rimuovi da game
    → broadcast_state()
    → broadcast { type: "player_left", seat, username }
    → se rimasti < min_players e mano non in corso: tavolo torna a "waiting"

  { "type": "action", "action": "fold"|"check"|"call"|"raise"|"allin", "amount": 0 }
    → verifica che il giocatore sia seduto e sia il suo turno
    → cancel_action_timer(table_id)
    → chiama game.apply_action(seat, action, amount)
    → per ogni GameEvent generato:
        "deal_hole_cards" → send_to privato { type: "hole_cards", cards: [...] }
        "hand_end" → salva GameHand + HandAction in DB,
                     aggiorna User.chips_balance per vincitore/perdenti,
                     scrivi ChipsLedger (reason="hand_win" o "hand_loss"),
                     aggiorna TableSeat.stack,
                     dopo 3 secondi: se players_active >= min_players → start_hand()
                                     altrimenti → broadcast { type: "waiting_players",
                                       needed: min_players - players_active }
        altri eventi → broadcast_state()
    → avvia start_action_timer(table_id, next_seat)

  { "type": "chat", "message": "ciao!" }
    → valida lunghezza (max 200 chars)
    → broadcast { type: "chat", from: username, message, ts: ISO8601 }

  { "type": "ping" }
    → send_to { type: "pong" }  (keepalive)

  All'errore / disconnessione:
    - Rimuovi connessione da game_manager
    - Se giocatore era seduto: sit_out (fold se era il suo turno, mantieni il suo posto)
    - Se dopo sit_out players_active < min_players: metti in pausa (fase WAITING)

Gestione errori: eccezioni nei messaggi → { type: "error", message: "..." }
senza chiudere la connessione.

Includi ws_router in main.py.
```

---

## SEZIONE 4 — Cash Game Frontend (live)

### Cosa fa
Collega il componente `Table.jsx` esistente (già visivamente completo) al WebSocket reale. Sostituisce i dati mock con lo stato reale dal server. Aggiunge il flusso di ingresso a un tavolo (scelta posto, buyin) e il timer d'azione.

---

### 📋 Prompt 4-A — Hook WebSocket + stato tavolo

```
Sto costruendo "Ridotto", app poker React + Vite. Ho un backend FastAPI con 
WebSocket all'endpoint: ws://[backend]/ws/table/{tableId}?token={jwt}

Protocollo messaggi (Server → Client):
  { type: "table_state", seats: [...], pot: 120, community: ["A♠","K♥"], 
    phase: "flop", acting_seat: 2, timer_seconds: 18, hand_number: 42 }
  { type: "hole_cards", cards: ["A♠","K♥"] }  ← privato solo al giocatore
  { type: "player_action", seat: 2, action: "raise", amount: 40 }
  { type: "showdown", results: [{seat, hand_description, cards, won}] }
  { type: "hand_end", winner_seat, pot_won, hand_description }
  { type: "chat", from: "Marco", message: "gg", ts: "..." }
  { type: "error", message: "Non è il tuo turno" }

Protocollo messaggi (Client → Server):
  { type: "join_seat", seat: 3, buyin: 1000 }
  { type: "leave_seat" }
  { type: "action", action: "fold"|"check"|"call"|"raise"|"allin", amount: 0 }
  { type: "chat", message: "ciao!" }

TASK: Crea src/hooks/usePokerTable.js:

const { tableState, myCards, mySeats, connected, sendAction, sendChat, joinSeat, leaveSeat } 
  = usePokerTable(tableId)

Dove:
- tableState: { seats, pot, community, phase, acting_seat, timer_seconds, hand_number }
  seats è un array di 9 elementi (null se posto vuoto) con:
  { seat, user_id, username, stack, bet_in_round, status, last_action, is_me }
- myCards: ['A♠','K♥'] o [] se non ho carte
- mySeat: numero del mio posto o null
- connected: boolean
- sendAction(action, amount=0): manda azione al server
- sendChat(message): manda messaggio chat
- joinSeat(seat, buyin): manda join_seat
- leaveSeat(): manda leave_seat

Requisiti:
- Apre WebSocket con il JWT preso da AuthContext (localStorage)
- Reconnect automatico dopo 3 secondi se la connessione cade
- Gestisce tutti i tipi di messaggio aggiornando lo stato React
- Timer countdown locale: ogni secondo decrementa timer_seconds localmente 
  (sincronizzato dal server ad ogni table_state, interpolato localmente)
- Usa useRef per il WebSocket (non re-render al cambio socket)
- Cleanup alla dismount: chiude la connessione

Poi crea src/hooks/useTableChat.js separato per la gestione dei messaggi chat:
  const { messages, sendMessage } = useTableChat(sendChat)
  messages: array di { from, message, ts, is_me }
```

---

### 📋 Prompt 4-B — PokerTable component live + BuyinDialog

```
Sto costruendo "Ridotto", app poker React + Vite.
Ho il componente PokerTable esistente in src/components/Table.jsx che usa dati mock.
Ho l'hook usePokerTable(tableId) che ritorna lo stato live dal WebSocket.

DESIGN DA PRESERVARE: dark luxury, CSS inline, palette oro #D4AF37, 
verde feltro #1a4a2e, font Playfair Display + Inter + JetBrains Mono.

TASK:

1. MODIFICA PokerTable.jsx:
   - Accetta prop tableId invece di cardBack e onLeave
   - Usa usePokerTable(tableId) per lo stato reale
   - Sostituisci i dati mock dei seats con i dati reali
   - Sostituisci community cards mock con quelle reali
   - Sostituisci pot mock con quello reale
   - I bottoni azioni (Fold/Check/Call/Raise/All-In) chiamano sendAction()
   - Mostra solo le azioni disponibili (es. non mostrare Check se c'è una puntata da eguagliare)
   - Il raise slider va da min_raise a stack del giocatore
   - Disabilita i bottoni azioni quando non è il turno del giocatore (acting_seat != mySeat)

2. AGGIUNGI timer di azione:
   - Barra orizzontale sotto il nameplate del giocatore che sta agendo
   - Si svuota in timer_seconds secondi con animazione CSS transition
   - Colore: oro quando >10s, rosso quando ≤5s
   - Appare solo sul giocatore active (acting_seat)

3. AGGIUNGI BuyinDialog.jsx:
   - Modale che appare quando si clicca su un posto vuoto
   - Titolo "Scegli il tuo posto" con numero posto
   - Slider per l'importo buyin (min: table.min_buyin, max: min(table.max_buyin, user.chips_balance))
   - Mostra "Saldo disponibile: X chips" 
   - Bottone "Siediti" che chiama joinSeat(seat, buyin)
   - Bottone "Annulla"
   - Stile coerente con il design system

4. AGGIUNGI chat tab alla sidebar destra del tavolo:
   - Due tab: "Storico mano" (già esistente) e "Chat"
   - Tab chat mostra i messaggi in ordine cronologico
   - Input in fondo con invio su Enter o bottone →
   - I messaggi propri appaiono con colore oro, gli altri in bianco/grigio
   - Usa useTableChat hook

5. SHOWDOWN: quando arriva messaggio type="showdown":
   - Mostra le carte coperte dei giocatori (rivela quelle di chi non ha foldato)
   - Evidenzia il vincitore con un glow oro sul suo seat
   - Mostra descrizione mano vincente ("Full House", "Coppia di Assi", ecc.)
   - Dopo 3 secondi torna allo stato normale
```

---

### 📋 Prompt 4-C — Lobby live (lista tavoli reali + crea tavolo)

```
Sto costruendo "Ridotto", app poker React + Vite.

Il backend ha questi endpoint:
  GET /tables → lista tavoli: [{ id, name, table_type, min_players, max_seats, speed,
    small_blind, big_blind, min_buyin, max_buyin, status, players_seated, created_by }]
  POST /tables → crea tavolo (APERTO A TUTTI), body:
    { name, table_type, min_players, max_seats, speed, small_blind, big_blind,
      min_buyin, max_buyin }
  GET /sitgo → lista sit&go: [{ id, name, min_players, max_seats, speed,
    starting_chips, status, n_registered, created_by }]
  POST /sitgo → crea sit&go (APERTO A TUTTI), body:
    { name, min_players, max_seats, speed, starting_chips }

La schermata Lobby.jsx attuale usa dati mock CASH_TABLES e SITNGO.

DESIGN DA RISPETTARE: dark luxury, CSS inline, oro #D4AF37, sfondo #0a0a0a,
font Playfair Display + Inter + JetBrains Mono. Stile del modale: stesso di BuyinDialog.

TASK:

1. Crea src/api/tables.js con:
   getTables(), createTable(data), getTable(id),
   getSitGos(), createSitGo(data),
   registerSitGo(id), unregisterSitGo(id)

2. Sostituisci la sezione "Cash Game" della Lobby con dati reali:
   - useEffect che chiama getTables() al mount + polling ogni 10 secondi
   - Loading skeleton: 3 righe grigie animate (height 52px, background rgba gold 0.05,
     pulsazione con CSS animation)
   - Se lista vuota: messaggio centrato "Nessun tavolo aperto · Creane uno!" 
     con bottone che apre il modal di creazione
   - Ogni riga tavolo mostra:
     · Nome, tipo (CASH pill), speed badge (⚡FAST / NORMALE / LENTO),
     · Blind: "€X / €Y", giocatori seduti "N/max" con barra progresso sottile,
     · Indicatore status: pallino verde pulsante se "running", grigio se "waiting"
     · Bottone principale: "Siediti →" se c'è posto libero (players_seated < max_seats)
                           "Pieno · Osserva" ghost se pieno
   - Click "Siediti" → naviga a /table/:id (React Router)

3. Aggiungi bottone "+ Nuovo tavolo" in alto a destra nella TopBar della sezione Cash.
   Al click apre CreateTableModal:
   
   CreateTableModal (componente separato src/components/CreateTableModal.jsx):
   - Overlay scuro con modale centrato, stile coerente con il design system
   - Titolo "Crea un tavolo" in Playfair Display
   - Campi del form:
     · Nome tavolo: input text (placeholder "Es. Tavolo dei Campioni")
     · Tipo: due bottoni toggle "Cash Game" / "Sit & Go"
       (se Sit & Go: nascondi min/max buyin, mostra "Chips di partenza")
     · Min giocatori: select 2-9 (default 2)
     · Max posti: select da min_giocatori a 9 (default 6)
     · Velocità: tre bottoni toggle "Lenta" / "Normale" / "Veloce"
       (con tooltip: Lenta=30s/azione, Normale=20s, Veloce=10s)
     · Blind piccolo: input numerico (default 25)
     · Blind grande: calcolato automaticamente = blind_piccolo * 2 (readonly)
     · Buy-in minimo: input numerico (default blind_grande * 20)
     · Buy-in massimo: input numerico opzionale, placeholder "Nessun limite"
       (nascosto per Sit & Go)
     · Per Sit & Go: Chips di partenza: input numerico (default 10000)
   - Bottone "Crea tavolo" → chiama createTable() o createSitGo()
     → dopo successo: naviga direttamente a /table/:newId
   - Bottone "Annulla" ghost
   - Validazione inline: mostra errori sotto ogni campo

4. Sostituisci la sezione "Sit & Go" della Lobby con dati reali:
   - Stessa logica di fetch e polling
   - Ogni card sit&go mostra: nome, posti (n/max con seat indicator bar),
     chips di partenza, speed badge, stato
   - Bottone "Iscriviti" → POST /sitgo/{id}/register
   - Se già iscritto: badge "In attesa" giallo + bottone "Ritira" ghost
   - Se status "running": badge rosso "LIVE" + bottone "Osserva" ghost
   - Bottone "+ Nuovo Sit & Go" che apre lo stesso CreateTableModal 
     con tipo preselezionato su "Sit & Go"

5. Stato globale "il mio tavolo": se l'utente è seduto a un tavolo (controllabile 
   con GET /tables e confrontando created_by o tramite un endpoint GET /users/me/current-seat),
   mostra nella Sidebar la voce "Tavolo attivo" con badge rosso LIVE (già presente nel design).

Aggiorna la Sidebar in Shell.jsx per rendere "Tavolo attivo" cliccabile e navigare 
a /table/:id se l'utente è correntemente seduto a un tavolo.
```

---

## SEZIONE 5 — Sit & Go

### Cosa fa
Implementa i tornei Sit & Go: si registra, quando il tavolo è pieno parte automaticamente, i blind crescono ogni N minuti, chi va a 0 chips è eliminato, il vincitore prende tutto.

---

### 📋 Prompt 5-A — Backend Sit & Go

```
Sto costruendo "Ridotto", app poker FastAPI. Ho già:
- models.py con: SitGoTournament (campi: min_players, max_seats, speed, starting_chips,
  blind_schedule JSON, created_by, status), SitGoRegistration, PokerTable, TableSeat
- poker_engine.py con la logica di gioco completa
- game_manager.py con GameManager singleton (gestisce anche la speed per i timer)
- ws_router.py con WebSocket per cash game

TASK: Crea backend/routers/sitgo_router.py (prefix /sitgo):

GET /sitgo
  Lista tornei con status != "finished", ordinati per created_at desc.
  Include per ogni torneo: n_registered (count SitGoRegistration),
  min_players, max_seats, speed, starting_chips, status, created_by username.

POST /sitgo
  APERTO A QUALSIASI UTENTE AUTENTICATO (non solo admin).
  Body (schema SitGoCreate):
    - name: str (3-100 chars)
    - min_players: int (2-9)
    - max_seats: int (2-9, >= min_players)
    - speed: "slow" | "normal" | "fast"
    - starting_chips: int (>= 1000)
  Il blind_schedule viene generato automaticamente dal server in base alla speed:
    slow   → [{level:1, sb:25, bb:50, duration:900}, {2,50,100,900}, {3,75,150,900}, {4,150,300,900}, {5,300,600,900}]
    normal → [{1,25,50,600}, {2,50,100,600}, {3,75,150,600}, {4,150,300,600}, {5,300,600,600}]
    fast   → [{1,25,50,300}, {2,50,100,300}, {3,100,200,300}, {4,200,400,300}, {5,400,800,300}]
  Salva con created_by = current_user.id, status = "registering".
  L'utente creatore è automaticamente iscritto (crea SitGoRegistration).

GET /sitgo/{id}
  Dettaglio torneo + lista iscritti con username, avatar_initials, registered_at.

POST /sitgo/{id}/register
  Iscrive current_user al torneo.
  - Verifica status == "registering"
  - Verifica che l'utente non sia già iscritto
  - Crea SitGoRegistration
  - Se n_registered == max_seats → chiama _start_tournament(id) (vedi sotto)
  - Se n_registered >= min_players e tutti i posti non sono ancora pieni:
    non far partire ancora — aspetta max_seats iscritti.
    (Il torneo parte SOLO quando si raggiunge max_seats, non min_players)

DELETE /sitgo/{id}/register
  Disiscrizione, solo se status == "registering".
  Se l'utente era il creatore e ci sono altri iscritti: il torneo rimane aperto.
  Se era l'ultimo iscritto: il torneo viene cancellato (status = "closed").

Funzione asincrona _start_tournament(tournament_id):
  1. Crea un PokerTable dedicato con i parametri del torneo
  2. Crea TableSeat per ogni iscritto (stack = tournament.starting_chips)
  3. Aggiorna tournament.status = "running", tournament.started_at = now()
  4. Aggiunge il torneo al GameManager con configurazione speciale sitgo=True
  5. Avvia una task asyncio _blind_level_timer(tournament_id) che:
     - Ogni blind_schedule[current_level].duration_seconds aumenta il livello
     - Aggiorna tournament.current_blind_level in DB
     - Notifica tutti i giocatori del tavolo con WS message:
       { type: "blind_level_up", level: 2, small_blind: 50, big_blind: 100, 
         next_level_in: 600 }
     - Si ferma quando tournament.status == "finished"

Modifica game_manager.py per:
  - In handle_hand_end: se è un sitgo e un giocatore ha stack == 0:
    → setta SitGoRegistration.final_position = (rimasti_in_gioco + 1)
    → rimuovi il giocatore dal tavolo
    → se rimasto 1 solo giocatore → chiama _finish_tournament(tournament_id, winner_seat)
  
  _finish_tournament:
    - Setta il vincitore (position=1) in SitGoRegistration
    - tournament.status = "finished", tournament.finished_at = now()
    - Cancella il timer dei blind
    - Broadcast { type: "tournament_ended", winner: username, position_results: [...] }

Includi in main.py.
```

---

### 📋 Prompt 5-B — Frontend Sit & Go (tavolo + lobby)

```
Sto costruendo "Ridotto", app poker React + Vite.

NOTA: la Lobby (sezione Sit & Go) è già stata aggiornata nel prompt 4-C con 
il CreateTableModal, dati reali e bottone "+ Nuovo Sit & Go".
Questo prompt riguarda solo il tavolo di gioco durante un Sit & Go.

Il WebSocket del tavolo (già implementato con usePokerTable) manda anche questi 
nuovi tipi di messaggio durante un Sit & Go:
  { type: "blind_level_up", level: 2, small_blind: 50, big_blind: 100, next_level_in: 600 }
  { type: "player_eliminated", seat: 3, position: 4, username: "Marco" }
  { type: "tournament_ended", winner_username: "Giulia", position_results: 
    [{position, username, chips_won}] }
  
All'inizio della connessione il messaggio "welcome" include anche (per Sit & Go):
  { ..., tournament: { id, name, current_blind_level, blind_schedule, 
    speed, level_ends_at: ISO8601 } }

TASK:

1. Modifica usePokerTable.js per gestire i nuovi messaggi:
   Aggiungi allo stato restituito dall'hook:
   - isTournament: bool (true se welcome.tournament esiste)
   - tournament: { id, name, current_blind_level, blind_schedule, speed }
   - blindLevelEndsAt: Date object (da level_ends_at)
   - eliminated: array di { seat, position, username } (crescente durante la partita)
   - tournamentEnded: null o { winner_username, position_results }

   Gestione messaggi:
   - "blind_level_up": aggiorna tournament.current_blind_level e blindLevelEndsAt
   - "player_eliminated": appende a eliminated, mostra toast (vedi punto 3)
   - "tournament_ended": setta tournamentEnded

2. Modifica PokerTable.jsx per la modalità torneo:
   Quando isTournament === true, mostra un pannello fisso in alto a destra del tavolo:

   Pannello TORNEO (larghezza 220px, collassabile con click su header):
   - Header "TORNEO" in lettere oro con chevron collapse
   - Sezione blind attuale:
     Livello corrente in grande (es. "Livello 3")
     Blind: "€75 / €150" in Playfair Display oro
     Prossimo livello: "→ Lv4 · €150/€300" in grigio
     Countdown: "cambio in MM:SS" con barra che si svuota (aggiornata ogni secondo 
     calcolando la differenza tra now e blindLevelEndsAt)
   - Separator gold sottile
   - Classifica live: lista giocatori ancora in gioco ordinati per stack decrescente
     Ogni voce: posizione (1°, 2°...), username, stack in chips
     Il giocatore corrente è evidenziato con bordo oro sottile
   - Se ci sono eliminati: lista in fondo con opacity 0.5
     Ogni voce: posizione finale, username barrato, "ELIMINATO"

3. Toast eliminazione:
   Quando arriva player_eliminated → mostra per 3 secondi in centro schermo:
   Overlay semi-trasparente con testo centrato:
   "[username] eliminato" in Playfair Display 28px
   "Posizione: [N]°" in oro
   (non blocca le azioni degli altri giocatori)

4. Overlay fine torneo:
   Quando arriva tournament_ended → mostra overlay fullscreen sopra il tavolo:
   - Se l'utente è il vincitore:
     Testo "Hai vinto!" in Playfair Display grande, oro
     Animazione particelle/glow oro (CSS puro, keyframes)
   - Se l'utente è eliminato:
     Testo "Torneo terminato" più sobrio
   - Classifica finale: lista completa {position, username, chips}
   - Bottone "Torna alla lobby" → navigate('/lobby') e chiudi WS

Mantieni il design system invariato.
```

---

## SEZIONE 6 — Ricarica Automatica Chips + Rifinitura Profilo

### Cosa fa
Aggiunge un job giornaliero che ricarica le chips di chi è sotto soglia, e collega il profilo utente ai dati reali invece dei mock.

---

### 📋 Prompt 6-A — Ricarica automatica chips

```
Sto costruendo "Ridotto", app poker FastAPI + APScheduler.
Ho già models.py con User (chips_balance) e ChipsLedger.
Ho auth.py con get_current_user.

TASK:

1. Aggiungi a requirements.txt: apscheduler==3.10.4

2. Crea backend/scheduler.py con:

   DAILY_REFILL_THRESHOLD = 1000      # sotto questa soglia si ricarica
   DAILY_REFILL_AMOUNT = 10000        # si ricarica a questo importo
   
   async def daily_chips_refill():
     """Ricarica le chips di tutti gli utenti attivi sotto soglia."""
     # Apre una sessione DB
     # Trova tutti User dove is_active=True e chips_balance < DAILY_REFILL_THRESHOLD
     # Per ognuno:
     #   amount_added = DAILY_REFILL_AMOUNT - user.chips_balance
     #   user.chips_balance = DAILY_REFILL_AMOUNT
     #   crea ChipsLedger(reason="daily_refill", amount=amount_added, 
     #                    balance_after=DAILY_REFILL_AMOUNT,
     #                    description="Ricarica giornaliera automatica")
     # Commit e log count utenti ricaricati
   
   def start_scheduler():
     scheduler = AsyncIOScheduler(timezone="Europe/Rome")
     scheduler.add_job(daily_chips_refill, "cron", hour=6, minute=0)
     # Job anche all'avvio se configurato (per testing)
     scheduler.start()
     return scheduler

3. In main.py:
   - All'evento startup: chiama start_scheduler()
   - All'evento shutdown: scheduler.shutdown()

4. Aggiungi endpoint admin:
   POST /admin/chips/refill-all: trigger manuale della ricarica (solo admin)
   GET /admin/chips/stats: ritorna { total_chips_in_circulation, users_below_threshold, 
     avg_balance, richest_player: {username, balance} }

5. Aggiungi settings:
   DAILY_REFILL_ENABLED=true
   DAILY_REFILL_THRESHOLD=1000
   DAILY_REFILL_AMOUNT=10000
   In config.py leggi queste variabili da .env
```

---

### 📋 Prompt 6-B — Profilo utente con dati reali

```
Sto costruendo "Ridotto", app poker React + Vite.
Il profilo attuale (src/components/Profile.jsx) usa dati mock hardcoded USER e RECENT_GAMES.

Il backend ha questi endpoint:
  GET /auth/me → { id, username, email, display_name, chips_balance, avatar_initials,
                   created_at, total_games, total_wins }
  GET /users/me/chips-history → ultimi 50 movimenti chips
  (Aggiungere) GET /users/me/game-history → ultimi 20 game con { date, type, duration, 
    hands_played, result_chips, final_position (per sitgo) }
  (Aggiungere) GET /users/me/stats → { vpip, pfr, af, win_rate, biggest_pot, 
    total_hours_played, net_result }

TASK:

1. Backend: aggiungi a users_router.py:
   GET /users/me/game-history:
     - Legge da GameHand + HandAction le partite dell'utente
     - Ritorna lista di sessioni raggruppate per table_id/data
     - Calcola result_chips come differenza stack finale - stack iniziale per quella sessione
   
   GET /users/me/stats:
     - Calcola VPIP: percentuali mani in cui ha chiamato/ralanciato preflop
     - Calcola PFR: mani in cui ha ralanciato preflop / totale mani
     - AF (Aggression Factor): (raise + bet) / call su tutti i postflop
     - Win rate: mani vinte allo showdown / mani arrivate a showdown
     - Biggest pot: MAX(pot) dalle GameHand dove ha vinto
     - Net result: somma di tutti i ChipsLedger con reason in ["hand_win", "hand_loss", 
       "sitgo_win", "sitgo_loss"]
     Se non ci sono dati sufficienti, ritorna null per quelle statistiche

2. Frontend: modifica Profile.jsx:
   - Rimuovi USER e RECENT_GAMES mock
   - Usa AuthContext per il nome/username/initials/balance
   - useEffect per caricare /users/me/stats e /users/me/game-history
   - Loading state con placeholder skeleton (rettangoli grigi animati)
   - Il grafico P/L usa i dati reali da chips-history (filtra solo i movimenti di gioco)
   - La tabella sessioni recenti usa game-history reale
   - Se le statistiche avanzate (VPIP, PFR ecc.) sono null: mostra "—" 
     con tooltip "Dati insufficienti (min. 100 mani)"
   - Il bottone "Deposita" → apre dialog con messaggio "Le chips vengono ricaricate 
     automaticamente ogni giorno. Torna domani!"

Mantieni tutto il design esistente, cambia solo i dati.
```

---

## Riepilogo prompt e ordine di esecuzione

| # | Prompt | File generati | Dipende da |
|---|--------|---------------|------------|
| 1-A | Scaffolding Vite + migrazione | `frontend/src/` intera struttura | — |
| 1-B | LoginPage | `src/pages/LoginPage.jsx` | 1-A |
| 2-A | Backend inviti | `models.py`, `admin_router.py`, modifica `auth_router.py` | — |
| 2-B | Frontend admin panel | `src/pages/AdminPage.jsx` | 1-A, 2-A |
| 3-A | Poker engine | `backend/poker_engine.py` | — |
| 3-B | Modelli DB gioco | `models.py` (aggiunta) | 2-A |
| 3-C | WebSocket server + REST tavoli | `game_manager.py`, `ws_router.py` | 3-A, 3-B |
| 4-A | Hook WebSocket | `src/hooks/usePokerTable.js` | 1-A |
| 4-B | Table component live + BuyinDialog | `src/components/Table.jsx` (modifica) | 4-A, 3-C |
| 4-C | Lobby live + crea tavolo (utente) | `Lobby.jsx`, `CreateTableModal.jsx`, `src/api/tables.js` | 1-A, 3-C |
| 5-A | Backend Sit & Go (utente crea) | `sitgo_router.py` | 3-A, 3-B, 3-C |
| 5-B | Frontend torneo al tavolo | modifica `Table.jsx`, `usePokerTable.js` | 4-B, 5-A |
| 6-A | Ricarica chips | `scheduler.py` | 3-B |
| 6-B | Profilo reale | `Profile.jsx` (modifica), aggiunta route backend | 1-A, 3-B |

### Cosa fa ogni utente (non admin)
- **Vede** in lobby tutti i tavoli live con giocatori, status e posti liberi
- **Si unisce** a un tavolo esistente se c'è un posto libero
- **Crea** un tavolo Cash Game o Sit & Go con: nome, min/max giocatori, 
  velocità (lenta/normale/veloce), blind iniziali, buy-in
- **Aspetta** che altri si uniscano (il tavolo parte quando si raggiunge il min giocatori)
- **Gioca** Texas Hold'em con timer d'azione variabile in base alla velocità scelta

> **Consiglio**: passa i prompt a Claude Code nell'ordine della tabella. Ogni prompt 
> è autocontenuto — include tutto il contesto necessario senza dover aprire altri file.
