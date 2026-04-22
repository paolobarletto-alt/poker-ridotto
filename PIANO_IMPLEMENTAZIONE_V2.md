# Ridotto Poker — Piano implementazione passi mancanti
> Aggiornato dopo analisi codebase attuale · Aprile 2026

---

## Stato di partenza (cosa c'è già e funziona)

| Cosa | Stato |
|---|---|
| Backend auth (login/register/JWT) | ✅ Completo |
| Modelli DB (tutte le tabelle) | ✅ Completo |
| Motore poker Python (`poker_engine.py`) | ✅ Completo e testato |
| Game Manager in memoria | ✅ Completo |
| REST tavoli (CRUD) | ✅ Completo |
| WebSocket base (welcome, broadcast state) | ✅ Funzionante |
| Admin sistema inviti + gestione utenti | ✅ Completo |
| Frontend setup (Vite, Router, AuthContext) | ✅ Completo |
| LoginPage | ✅ Completo |
| Shell / Sidebar / GoldButton | ✅ Completo |

---

## Cosa manca — 7 passi in ordine di esecuzione

**Il blocco critico è il passo 1:** senza il hook WebSocket completo, niente funziona.

---

## PASSO 1 — Completare `usePokerTable.js` + `useTableChat.js`

**Perché è bloccante:** tutto il gioco dipende da questo hook. Attualmente il hook gestisce solo la ricezione dello stato, ma non manda niente al server.

**Cosa manca nel hook attuale:**
- `sendAction(action, amount)` — manda `{type:"action", action, amount}` via WS
- `sendChat(message)` — manda `{type:"chat", message}` via WS
- `joinSeat(seat, buyin)` — manda `{type:"join_seat", seat, buyin}` via WS
- `leaveSeat()` — manda `{type:"leave_seat"}` via WS
- Gestione messaggi in entrata: `player_action`, `showdown`, `hand_end`, `waiting_players`
- Visual feedback di reconnect (stato `reconnecting: bool`)

---

### 📋 Prompt P1 — Completare hook WebSocket

```
Sto costruendo "Ridotto", app poker React + Vite.

Ho già src/hooks/usePokerTable.js parzialmente implementato.
Il file attuale gestisce la ricezione dello stato WS ma NON invia messaggi.
Ho anche src/hooks/useTableChat_v2.js che potrebbe essere incompleto.

Il WebSocket è su: ws://[backend]/ws/table/{tableId}?token={jwt}

MESSAGGI ESISTENTI GIÀ GESTITI IN RICEZIONE:
  { type: "welcome", table: {...}, state: {...} }
  { type: "table_state", seats, pot, community, phase, acting_seat, timer_seconds, hand_number }
  { type: "hole_cards", cards: ["A♠","K♥"] }

MESSAGGI IN RICEZIONE DA AGGIUNGERE:
  { type: "player_action", seat, action, amount }
    → aggiorna last_action sul seat corrispondente
  { type: "showdown", results: [{seat, hand_description, cards, won, amount}] }
    → setta showdownResults nello stato (array di risultati)
  { type: "hand_end", winner_seat, pot_won, hand_description }
    → setta handEndResult, dopo 3s resetta a null
  { type: "waiting_players", needed: 2 }
    → setta waitingForPlayers (int: quanti giocatori mancano)
  { type: "player_joined", seat, username, stack }
    → update locale immediato (ottimistico prima del table_state)
  { type: "player_left", seat, username }
    → update locale immediato
  { type: "error", message }
    → setta lastError (string), dopo 4s resetta a null
  { type: "chat", from, message, ts }
    → gestito da useTableChat (vedi sotto)
  { type: "pong" }
    → nessun aggiornamento stato, conferma keepalive

MESSAGGI DA INVIARE (DA IMPLEMENTARE):
  sendAction(action, amount=0)
    → invia { type: "action", action, amount }
    → prima del send: verifica che ws.readyState === WebSocket.OPEN
    → se WS non connesso: salva in coda e manda alla riconnessione
  sendChat(message)
    → invia { type: "chat", message }
  joinSeat(seat, buyin)
    → invia { type: "join_seat", seat, buyin }
  leaveSeat()
    → invia { type: "leave_seat" }
  sendPing()
    → invia { type: "ping" } ogni 30s per keepalive (usa useInterval o setInterval in useRef)

STATO DA RESTITUIRE DALL'HOOK (aggiorna l'esistente):
  tableState: { seats, pot, community, phase, acting_seat, timer_seconds, hand_number }
  tableConfig: { name, table_type, min_players, max_seats, speed, small_blind, big_blind,
                 min_buyin, max_buyin }  ← dal messaggio welcome
  myCards: ['A♠','K♥'] o []
  mySeat: numero del posto o null
  connected: bool
  reconnecting: bool  ← true durante il tentativo di riconnessione
  showdownResults: array o null  ← si azzera dopo 3s automaticamente
  handEndResult: { winner_seat, pot_won, hand_description } o null
  waitingForPlayers: int o null
  lastError: string o null
  handLog: array di stringhe descrittive azioni
  sendAction, sendChat, joinSeat, leaveSeat

LOGICA RICONNESSIONE:
  - Se la connessione cade: setta reconnecting=true, tenta dopo 3s
  - Massimo 5 tentativi, poi setta connected=false e smette
  - Al riconnect: rimanda il welcome e aggiorna lo stato

Poi crea/completa src/hooks/useTableChat.js (SEPARATO da usePokerTable):
  Input: sendChat (funzione dal hook sopra)
  Ritorna: { messages, sendMessage }
  - messages: array di { from, message, ts, isMe } (max 100, rimuovi i più vecchi)
  - sendMessage(text): chiama sendChat(text) e aggiunge ottimisticamente alla lista
  - Al ricezione messaggio type="chat": aggiunge a messages
  Come integrare: usePokerTable espone una callback onChatMessage(msg) 
  che useTableChat registra tramite una ref condivisa
```

---

## PASSO 2 — Collegare `Table.jsx` al WebSocket reale

**Cosa fare:** il componente Table_clean (attualmente usato) deve usare `usePokerTable` per lo stato reale invece dei dati mock. Aggiungere timer visivo, showdown overlay e chat.

---

### 📋 Prompt P2 — Table.jsx live + componenti visivi

```
Sto costruendo "Ridotto", app poker React + Vite.

STATO ATTUALE:
- src/components/Table_clean.jsx: componente visivo poker completo ma con dati mock hardcoded
- src/hooks/usePokerTable.js: hook WebSocket completo che ritorna:
  tableState, tableConfig, myCards, mySeat, connected, reconnecting,
  showdownResults, handEndResult, waitingForPlayers, lastError,
  sendAction, sendChat, joinSeat, leaveSeat, handLog
- src/hooks/useTableChat.js: ritorna { messages, sendMessage }
- src/pages/TablePage.jsx: esiste ma non passa tableId correttamente

DESIGN DA PRESERVARE: dark luxury, CSS inline, oro #D4AF37, verde feltro #1a4a2e,
font Playfair Display + Inter + JetBrains Mono.

TASK:

1. RISCRIVI src/pages/TablePage.jsx:
   - Legge tableId da useParams() (React Router)
   - Usa usePokerTable(tableId) per lo stato live
   - Usa useTableChat(sendChat) per la chat
   - Passa tutto a PokerTable come props
   - Se !connected && !reconnecting: mostra overlay "Connessione persa"
   - Se reconnecting: mostra banner in alto "Riconnessione in corso..."

2. AGGIORNA src/components/Table_clean.jsx (rinominalo Table.jsx definitivo):
   Sostituisci i dati mock con le props reali:
   - seats → tableState.seats (array 9 elem, null se vuoto)
   - community → tableState.community
   - pot → tableState.pot
   - phase → tableState.phase
   - I bottoni azione chiamano sendAction():
     · Fold → sendAction("fold")
     · Check → sendAction("check") (visibile solo se current_bet == 0 o già pari)
     · Call → sendAction("call") (mostra importo: current_bet - mySeat.bet_in_round)
     · Raise → sendAction("raise", raiseAmt)
     · All-In → sendAction("allin")
   - Disabilita tutti i bottoni quando tableState.acting_seat !== mySeat
   - Le carte del giocatore hero mostrano myCards invece di mock
   - Un posto vuoto (seats[i] === null) è cliccabile → apre BuyinDialog
   - Un posto con is_me=true mostra badge "Tu"

3. AGGIUNGI timer di azione visivo:
   Sul nameplate del giocatore con acting_seat:
   - Barra sottile (4px) che si svuota in tableState.timer_seconds secondi
   - CSS transition width da 100% a 0% in timer_seconds secondi
   - Si azzera (100%) ogni volta che cambia acting_seat
   - Colore: oro (#D4AF37) se secondi > 8, rosso (#c0392b) se ≤ 8
   - Implementa con useEffect + CSS custom property

4. AGGIUNGI overlay showdown:
   Quando showdownResults è non-null:
   - Rivela le hole cards dei giocatori non-foldati (le ricevi nei risultati)
   - Evidenzia il vincitore con glow oro (box-shadow pulsante)
   - Sotto il nameplate vincitore: descrizione mano in Playfair italic (es. "Scala Reale")
   - Durata: 3 secondi poi torna normale

5. AGGIUNGI overlay "In attesa":
   Quando waitingForPlayers è non-null:
   - Centro del tavolo (sopra il feltro): 
     "In attesa di giocatori" in Playfair Display
     "Ancora {n} giocatori per iniziare" in Inter grigio
   - Sostituisce il testo del piatto durante l'attesa

6. AGGIUNGI tab Chat nella sidebar destra:
   La sidebar ha già il "STORICO MANO". Aggiungi toggle:
   - Tab "MANO" (default) — mostra handLog
   - Tab "CHAT" — mostra messaggi da useTableChat
   - Sotto la lista messaggi: input text + bottone →
   - Enter invia, testo del giocatore in oro, altri in bianco
   - Max 200 caratteri

7. AGGIUNGI errore toast:
   Quando lastError è non-null:
   - Banner rosso sottile in cima all'action bar: "⚠ {lastError}"
   - Sparisce dopo 4s
```

---

## PASSO 3 — `BuyinDialog` + `CreateTableModal`

**Due componenti modali che mancano completamente.**

---

### 📋 Prompt P3 — BuyinDialog + CreateTableModal

```
Sto costruendo "Ridotto", app poker React + Vite.

DESIGN: dark luxury, CSS inline, oro #D4AF37, sfondo #0a0a0a,
font Playfair Display + Inter + JetBrains Mono.
Stile modale: overlay rgba(0,0,0,0.75) + pannello centrato 480px con
border: 1px solid rgba(212,175,55,0.25), background: #0e0e0e.

API disponibile (src/api/tables.js già esiste):
  list() → GET /tables
  get(id) → GET /tables/{id}
  createTable(data) → POST /tables
  (aggiungere) createSitGo(data) → POST /sitgo

TASK 1: Crea src/components/BuyinDialog.jsx

Props: { isOpen, onClose, seat, tableConfig, userBalance, onConfirm }
  - tableConfig: { min_buyin, max_buyin, name, small_blind, big_blind }
  - userBalance: chips disponibili dell'utente
  - onConfirm(seat, buyin): chiamata quando l'utente conferma

UI:
  - Titolo: "Posto {seat + 1}" in Playfair Display
  - Sottotitolo: nome tavolo + blinds (es. "Tavolo Verde · €25/€50")
  - Sezione saldo: "Saldo disponibile: X chips" in JetBrains Mono oro
  - Slider buyin: min=tableConfig.min_buyin, max=min(tableConfig.max_buyin ?? Infinity, userBalance)
    Se max_buyin è null: max = userBalance
  - Sotto lo slider: valore corrente in grande (Playfair, 32px, oro)
  - Preset rapidi: 3 bottoni ghost [Min] [Metà] [Max] che settano il valore
  - Bottone "Siediti" solid oro → chiama onConfirm(seat, buyin)
  - Bottone "Annulla" ghost → chiama onClose
  - Validazione: disabilita "Siediti" se buyin < min_buyin o buyin > userBalance

TASK 2: Crea src/components/CreateTableModal.jsx

Props: { isOpen, onClose, defaultType }  (defaultType: "cash" o "sitgo")

UI: modale con form in sezioni. Al submit chiama createTable() o createSitGo() 
e poi naviga a /table/:newId.

SEZIONE 1 — Tipo (toggle cash/sitgo):
  Due bottoni toggle "Cash Game" / "Sit & Go"
  Al cambio tipo: mostra/nascondi campi condizionali

SEZIONE 2 — Struttura:
  - Nome tavolo: input text (3-50 chars, placeholder "Es. Tavolo dei Campioni")
  - Giocatori minimi: select 2-9 (default 2)
  - Posti massimi: select da min_giocatori a 9 (default 6)
    (aggiorna dinamicamente il range quando cambia min_giocatori)

SEZIONE 3 — Velocità (3 card cliccabili):
  [🐢 Lenta]   [⚡ Normale]   [⚡⚡ Veloce]
  Sotto ogni card: "30s per mossa" / "20s per mossa" / "10s per mossa"
  La card selezionata ha border oro pieno

SEZIONE 4 — Blinds (solo per Cash Game):
  - Blind piccolo: input numerico (default 25, step 5)
  - Blind grande: readonly = blind_piccolo * 2 (aggiorna al volo)
  - Buy-in minimo: input numerico (default big_blind * 20, min = big_blind * 10)
  - Buy-in massimo: input numerico opzionale + checkbox "Nessun limite" 
    (se checked: disabilita il campo e manda null)

SEZIONE 4 — Chips (solo per Sit & Go):
  - Chips di partenza per giocatore: input numerico (default 10000, min 1000)
  - Nota esplicativa: "Il torneo parte quando tutti i posti sono occupati"
  - Mostra la blind schedule automatica in base alla velocità:
    es. per Normal: "Lv1: 25/50 · Lv2: 50/100 · Lv3: 75/150 ..."

FOOTER:
  - "Crea tavolo" (o "Crea Sit & Go") solid oro — in loading durante la chiamata
  - "Annulla" ghost
  - Errori inline dal server sotto i campi interessati

Validazione in tempo reale (senza submit):
  - Nome: min 3 chars
  - max_seats >= min_players
  - big_blind = small_blind * 2 (auto-calcolato)
  - min_buyin >= big_blind * 10
```

---

## PASSO 4 — Lobby live (tavoli reali + polling)

**Sostituisce i dati mock nella Lobby con fetch reale e aggiunge il bottone "Crea tavolo".**

---

### 📋 Prompt P4 — Lobby con dati live

```
Sto costruendo "Ridotto", app poker React + Vite.

STATO ATTUALE:
- src/components/Lobby.jsx: layout completo ma usa CASH_TABLES e SITNGO mock hardcoded
- src/api/tables.js: ha list() e get(), manca createSitGo(), listSitGos()
- src/components/CreateTableModal.jsx: appena creato (passo precedente)
- L'utente autenticato è accessibile via useAuth() dall'AuthContext

API BACKEND:
  GET /tables → [{ id, name, table_type, min_players, max_seats, speed,
    small_blind, big_blind, min_buyin, max_buyin, status, players_seated, created_by }]
  GET /sitgo → [{ id, name, min_players, max_seats, speed, starting_chips,
    status, n_registered, created_by }]
  POST /sitgo/{id}/register → iscrive l'utente
  DELETE /sitgo/{id}/register → disiscrizione
  GET /users/me/current-seat → { table_id, seat_number } o null
    (aggiungilo al backend in users_router.py: query su TableSeat dove user_id = current_user.id
     e status != "away", ritorna il primo risultato o null)

DESIGN: preserva il design esistente della Lobby — cambia solo i dati e aggiungi elementi nuovi.

TASK:

1. Aggiorna src/api/tables.js:
   - Aggiungi listSitGos() → GET /sitgo
   - Aggiungi registerSitGo(id) → POST /sitgo/{id}/register
   - Aggiungi unregisterSitGo(id) → DELETE /sitgo/{id}/register
   - Aggiungi createSitGo(data) → POST /sitgo
   - Aggiungi getCurrentSeat() → GET /users/me/current-seat

2. Aggiungi backend in users_router.py:
   GET /users/me/current-seat:
     - Query: SELECT table_id, seat_number FROM table_seats 
       WHERE user_id = current_user.id AND status != 'away'
       LIMIT 1
     - Ritorna { table_id, seat_number } o null

3. In Lobby.jsx, sostituisci sezione "Cash Game":
   - Aggiungi hook useTables():
     · Stato: tables (array), loading (bool), error (string|null)
     · useEffect: chiama list() al mount
     · Polling: setInterval ogni 10s che richiama list()
     · Cleanup al dismount: clearInterval
   - Mentre loading: mostra 3 skeleton row 
     (div height:52px, background: rgba(212,175,55,0.04), 
      animazione "shimmer" con CSS keyframes)
   - Se lista vuota: 
     Messaggio centrato con icona ♠ in oro grande
     "Nessun tavolo aperto" in Playfair Display
     "Sii il primo" link in oro → apre CreateTableModal con type="cash"
   - Ogni riga tavolo reale:
     · Colonne esistenti (limiti, giocatori, piatto medio, attesa, modalità) 
       + colonna VELOCITÀ con badge (⚡FAST / NORMALE / 🐢 LENTA)
     · Indicatore status: pallino verde animato (box-shadow pulsante) se "running",
       grigio se "waiting"
     · Giocatori: "N/max" con progress bar sottile
     · Bottone "Siediti →": naviga a /table/:id se players_seated < max_seats
     · Bottone "Pieno · Osserva" ghost se pieno (naviga uguale, in sola lettura)
   - Aggiungi in TopBar della sezione Cash: bottone "＋ Tavolo" ghost che apre CreateTableModal

4. In Lobby.jsx, sostituisci sezione "Sit & Go":
   - Stesso hook useSitGos() con polling
   - Ogni card mostra: nome, posti (n/max con seat indicator bar colorata),
     chips di partenza, speed badge, stato
   - Bottone "Iscriviti": POST /sitgo/{id}/register
     · Loading state sul bottone durante la chiamata
     · Dopo successo: badge "In attesa" giallo + bottone "Ritira" ghost
   - Se già iscritto (confronta created_by o tieni lista myRegistrations in stato):
     badge "In attesa" + "Ritira"
   - Se status="running": badge rosso "LIVE" + "Osserva" ghost (naviga a /table/:tournament.table_id)
   - Aggiungi in TopBar: bottone "＋ Sit & Go" ghost → CreateTableModal con type="sitgo"

5. Sidebar "Tavolo attivo":
   - Al mount: chiama getCurrentSeat() 
   - Se ritorna un table_id: in Shell.jsx la voce "Tavolo attivo" nella sidebar
     diventa cliccabile (navigate a /table/:table_id) con badge rosso LIVE
   - Se null: voce disabilitata/grigia con testo "Nessun tavolo"
```

---

## PASSO 5 — Backend Sit & Go completo

**Il router manca del tutto. Tutta la logica dei Sit & Go va implementata qui.**

---

### 📋 Prompt P5 — Backend sitgo_router.py

```
Sto costruendo "Ridotto", app poker FastAPI. Ho già:
- models.py con SitGoTournament (id, name, min_players, max_seats, starting_chips, speed,
  status, blind_schedule JSON, current_blind_level, level_started_at, created_by,
  table_id, started_at, finished_at) e SitGoRegistration (id, tournament_id, user_id,
  final_position, chips_at_end, registered_at)
- poker_engine.py: GiocoPoker(table_id, min_players, max_seats) completo
- game_manager.py: GameManager singleton con get_or_create_table(), broadcast_state(),
  start_action_timer(), _table_speeds
- ws_router.py: WebSocket /ws/table/{table_id} funzionante per cash game
- auth.py: get_current_user, require_admin

BLIND SCHEDULES da usare (generate in base a speed):
  slow:   [{level:1,sb:25,bb:50,dur:900}, {2,50,100,900}, {3,75,150,900}, {4,150,300,900}, {5,300,600,900}]
  normal: [{1,25,50,600}, {2,50,100,600}, {3,75,150,600}, {4,150,300,600}, {5,300,600,600}]
  fast:   [{1,25,50,300}, {2,50,100,300}, {3,100,200,300}, {4,200,400,300}, {5,400,800,300}]

TASK: Crea backend/routers/sitgo_router.py (prefix /sitgo):

--- SCHEMAS (in schemas.py, aggiungi): ---
SitGoCreate: name (3-100), min_players (2-9), max_seats (2-9, >=min), 
             speed ("slow"|"normal"|"fast"), starting_chips (>=1000)
SitGoResponse: tutti i campi + n_registered (int) + creator_username (str)
SitGoDetail: SitGoResponse + registrations: List[{user_id, username, avatar_initials, registered_at}]

--- ENDPOINTS: ---

GET /sitgo
  Lista tornei status != "finished", ordinati per created_at desc.
  Includi n_registered e creator_username con join.

POST /sitgo  [autenticato, non solo admin]
  - Valida SitGoCreate
  - Genera blind_schedule dal server in base a speed
  - Salva SitGoTournament con created_by=current_user.id, status="registering"
  - Crea automaticamente SitGoRegistration per il creatore
  - Ritorna SitGoResponse

GET /sitgo/{id}
  Dettaglio + lista iscritti.

POST /sitgo/{id}/register  [autenticato]
  - Verifica status == "registering"
  - Verifica non già iscritto
  - Crea SitGoRegistration
  - Se n_registered raggiunge max_seats: chiama asyncio.create_task(_start_tournament(id, db))
  - Ritorna { message: "Iscritto", n_registered: X, max_seats: Y }

DELETE /sitgo/{id}/register  [autenticato]
  - Verifica status == "registering"
  - Elimina SitGoRegistration del current_user
  - Se era l'ultimo iscritto (n_registered diventa 0): chiudi torneo (status="closed")
  - Ritorna { message: "Disiscritto" }

--- FUNZIONE _start_tournament(tournament_id, db): ---
  1. Carica SitGoTournament e le SitGoRegistration (lista iscritti)
  2. Crea PokerTable in DB:
     name=tournament.name, table_type="sitgo", min_players=tournament.min_players,
     max_seats=tournament.max_seats, speed=tournament.speed,
     small_blind=blind_schedule[0]["sb"], big_blind=blind_schedule[0]["bb"],
     status="waiting", created_by=tournament.created_by
  3. Crea TableSeat per ogni iscritto con stack=tournament.starting_chips,
     seat_number assegnato in ordine di registrazione (0, 1, 2...)
  4. Crea GiocoPoker in game_manager con min_players e max_seats del torneo
     Carica lo speed: game_manager._table_speeds[table_id] = tournament.speed
  5. Aggiorna tournament: status="running", table_id=poker_table.id, started_at=now(),
     level_started_at=now()
  6. Avvia task asyncio: _blind_level_timer(tournament_id, table_id)
  7. Chiama game.start_hand() sul GiocoPoker (la mano parte subito)
  8. Broadcast via game_manager lo stato iniziale a tutti i connessi al table_id

--- FUNZIONE _blind_level_timer(tournament_id, table_id): ---
  Loop:
  1. Carica tournament da DB
  2. Se status != "running": break
  3. Calcola secondi da aspettare: blind_schedule[current_level-1]["dur"]
  4. await asyncio.sleep(secondi)
  5. Se status != "running": break (ricontrolla dopo il sleep)
  6. Se current_blind_level < len(blind_schedule):
     - Incrementa current_blind_level
     - Aggiorna level_started_at = now()
     - Salva in DB
     - Aggiorna game.min_bet = blind_schedule[new_level-1]["bb"]
     - Broadcast a table_id:
       { type: "blind_level_up", level: N, small_blind: X, big_blind: Y,
         next_level_in: dur_prossimo_livello_in_secondi }
  7. Else: siamo all'ultimo livello, i blind rimangono fissi (non fare break,
     il timer continua ma non cambia più livello)

--- MODIFICHE A game_manager.py: ---
  Aggiungi dict _tournament_map: Dict[table_id, tournament_id]
  
  Nel metodo che gestisce hand_end (o crea nuovo metodo handle_sitgo_hand_end):
  - Se table_id è in _tournament_map:
    · Per ogni giocatore con stack == 0 alla fine della mano:
      - Carica SitGoRegistration per (tournament_id, user_id)
      - Calcola posizione: n_giocatori_ancora_in_gioco + 1 al momento dell'eliminazione
      - Setta final_position e chips_at_end=0
      - Rimuovi il giocatore dal gioco (game.remove_player(seat))
      - Rimuovi TableSeat dal DB
      - Broadcast: { type: "player_eliminated", seat, position, username }
    · Se rimasto solo 1 giocatore nel gioco:
      - Chiama _finish_tournament(tournament_id, winner_user_id, winner_stack)

--- FUNZIONE _finish_tournament(tournament_id, winner_user_id, winner_stack): ---
  1. Setta SitGoRegistration del vincitore: final_position=1, chips_at_end=winner_stack
  2. Aggiorna SitGoTournament: status="finished", finished_at=now()
  3. Cancella il _blind_level_timer (tramite asyncio Task reference)
  4. Carica tutti i SitGoRegistration ordinati per final_position
  5. Broadcast a table_id:
     { type: "tournament_ended", 
       winner_username: "...",
       position_results: [{position, username, chips_at_end}] }
  6. Dopo 30s: aggiorna PokerTable.status = "closed"

Includi sitgo_router in main.py.
```

---

## PASSO 6 — Frontend Sit & Go (tavolo in modalità torneo)

**Aggiorna usePokerTable e Table.jsx per gestire i messaggi specifici del torneo.**

---

### 📋 Prompt P6 — Frontend Sit & Go sul tavolo

```
Sto costruendo "Ridotto", app poker React + Vite.

STATO ATTUALE:
- src/hooks/usePokerTable.js: hook completo per cash game
- src/components/Table.jsx: tavolo live funzionante per cash game
- Il messaggio "welcome" ora include opzionalmente:
  { tournament: { id, name, current_blind_level, blind_schedule, speed, level_ends_at: ISO8601 } }

NUOVI MESSAGGI WS DA GESTIRE:
  { type: "blind_level_up", level, small_blind, big_blind, next_level_in }
  { type: "player_eliminated", seat, position, username }
  { type: "tournament_ended", winner_username, position_results: [{position, username, chips_at_end}] }

TASK:

1. In usePokerTable.js aggiungi:
   isTournament: bool (true se welcome.tournament esiste)
   tournament: { id, name, current_blind_level, blind_schedule, speed } | null
   blindLevelEndsAt: Date | null  ← calcolato: now + next_level_in secondi
   eliminatedPlayers: [{ seat, position, username }]  ← array crescente
   tournamentEnded: { winner_username, position_results } | null
   latestEliminated: { seat, position, username } | null ← si azzera dopo 3s

   Gestione messaggi:
   - "blind_level_up": aggiorna tournament.current_blind_level,
     ricalcola blindLevelEndsAt = new Date(Date.now() + next_level_in * 1000)
   - "player_eliminated": appende a eliminatedPlayers, setta latestEliminated
     (setTimeout 3s per azzerare latestEliminated)
   - "tournament_ended": setta tournamentEnded

2. In Table.jsx aggiungi pannello torneo (isTournament === true):
   Pannello fisso top-right (width: 220px, position absolute, z-index 20):
   
   HEADER cliccabile (toggle collapse):
   "TORNEO" in oro + chevron ▲/▼
   
   CORPO (visibile quando espanso, default espanso):
   
   A) Blind attuale:
   - "LIVELLO {N}" in label piccola oro
   - "{SB} / {BB}" in Playfair Display 22px oro
   - Se c'è un prossimo livello: "→ Lv{N+1} · {SB_next}/{BB_next}" in grigio 11px
   - Countdown: calcola ogni secondo la diff tra blindLevelEndsAt e now
     Mostra "cambio in {MM:SS}" in JetBrains Mono
     Barra progresso che si svuota (va da dur_livello a 0)
     Diventa rossa quando < 60s
   
   B) Separator gold (1px)
   
   C) Classifica live (giocatori ancora in gioco):
   - Prendi i seats non-null con status != FOLD/ELIMINATO, ordina per stack desc
   - "1° Marco — 12.400 chips"
   - "2° Tu — 8.200 chips" (in oro se è il giocatore corrente)
   - "3° Giulia — 3.800 chips"
   
   D) Se ci sono eliminatedPlayers: sezione "ELIMINATI" con opacity 0.5
   - "4° Pietro — eliminato" con testo barrato

3. Toast eliminazione (latestEliminated non-null):
   Overlay centrato semi-trasparente (pointer-events: none):
   "{username}" in Playfair 28px bianco
   "Eliminato · {N}° posto" in oro 16px
   Animazione: fadeIn 0.3s → visibile 2.4s → fadeOut 0.3s

4. Overlay fine torneo (tournamentEnded non-null):
   Overlay fullscreen z-index 100, background rgba(0,0,0,0.9):
   
   Se currentUser è il vincitore (username == tournamentEnded.winner_username):
     "Hai vinto! 🏆" in Playfair Display 48px oro
     Animazione glow oro pulsante sul testo (CSS keyframes)
   
   Altrimenti:
     "Torneo concluso" in Playfair 36px bianco
     "Hai chiuso al {mia_posizione}° posto" in oro
   
   Classifica finale: lista scrollabile con tutti i position_results
   Ogni voce: medagliona (🥇🥈🥉 per i primi 3, poi numero) + username + chips
   
   Bottone "Torna alla lobby" solid oro → navigate('/lobby')
   (Aspetta 2s prima che diventi cliccabile — evita click accidentali)
```

---

## PASSO 7 — Profilo reale + Ricarica chips

**Due task indipendenti che si possono fare in parallelo o separatamente.**

---

### 📋 Prompt P7-A — Backend stats profilo + scheduler

```
Sto costruendo "Ridotto", app poker FastAPI + SQLAlchemy async.

Ho già in users_router.py:
  GET /users/me/chips-history → ultimi 50 movimenti
  GET /users/{username} → profilo pubblico
  PUT /users/me → aggiorna profilo

TASK A: Aggiungi a users_router.py:

GET /users/me/game-history
  Logica:
  - Carica GameHand dove esiste almeno un HandAction con user_id == current_user.id
  - Per ogni mano, calcola il risultato chips: 
    stack_after dell'ultima HandAction dell'utente - stack_before della prima
  - Raggruppa per table_id + data (stessa sessione = stesso tavolo stesso giorno)
  - Per ogni sessione ritorna:
    { date, time, table_name, table_type, hands_played, 
      duration_minutes (ended_at-started_at prima mano), result_chips }
  - Ordina per data desc, limite 30

GET /users/me/stats
  Calcola (usa HandAction del current_user):
  - total_hands: count HandAction distinte per hand_id dove phase="preflop"
  - vpip: (mani preflop dove action in ["call","raise","allin"]) / total_hands * 100
  - pfr: (mani preflop dove action in ["raise","allin"]) / total_hands * 100
  - af: count(raise+allin su postflop) / count(call su postflop), default 0 se nessun call
  - win_rate: (GameHand vinte da utente) / total_hands * 100
  - biggest_pot: MAX(pot) da GameHand dove winner_seat corrisponde all'utente
  - net_result: SUM(amount) da ChipsLedger dove reason in 
    ["hand_win","hand_loss","sitgo_win","sitgo_loss"]
  Se total_hands < 20: ritorna null per vpip, pfr, af (troppo pochi dati)
  Se total_hands == 0: ritorna tutto null

TASK B: Crea backend/scheduler.py con APScheduler:

  from apscheduler.schedulers.asyncio import AsyncIOScheduler
  
  REFILL_THRESHOLD = int(settings.DAILY_REFILL_THRESHOLD)  # default 1000
  REFILL_AMOUNT = int(settings.DAILY_REFILL_AMOUNT)        # default 10000
  
  async def daily_chips_refill():
    async with AsyncSessionLocal() as db:
      result = await db.execute(
        select(User).where(User.is_active == True, User.chips_balance < REFILL_THRESHOLD)
      )
      users = result.scalars().all()
      count = 0
      for user in users:
        added = REFILL_AMOUNT - user.chips_balance
        user.chips_balance = REFILL_AMOUNT
        db.add(ChipsLedger(
          user_id=user.id, amount=added, balance_after=REFILL_AMOUNT,
          reason="daily_refill", description="Ricarica giornaliera automatica"
        ))
        count += 1
      await db.commit()
      logger.info(f"Daily refill: ricaricati {count} utenti")
  
  def start_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone="Europe/Rome")
    scheduler.add_job(daily_chips_refill, "cron", hour=6, minute=0)
    scheduler.start()
    return scheduler

In main.py (lifespan o startup event):
  scheduler = start_scheduler()
  # In shutdown: scheduler.shutdown()

Aggiungi a config.py/settings:
  DAILY_REFILL_THRESHOLD: int = 1000
  DAILY_REFILL_AMOUNT: int = 10000

Aggiungi a admin_router.py:
  POST /admin/chips/refill-all → trigger manuale di daily_chips_refill()
  GET /admin/chips/stats → { total_chips, users_below_threshold, avg_balance,
                              richest: {username, balance} }

Aggiungi a requirements.txt: apscheduler==3.10.4
```

---

### 📋 Prompt P7-B — Profilo con dati reali

```
Sto costruendo "Ridotto", app poker React + Vite.

Il backend ora ha:
  GET /auth/me → { username, display_name, chips_balance, avatar_initials,
                   created_at, total_games, total_wins }
  GET /users/me/chips-history → ultimi 50 movimenti chips
  GET /users/me/game-history → [{date, time, table_name, table_type, 
                                  hands_played, duration_minutes, result_chips}]
  GET /users/me/stats → { total_hands, vpip, pfr, af, win_rate, 
                           biggest_pot, net_result } (può avere null per dati insufficienti)

src/components/Profile.jsx attuale usa USER mock e RECENT_GAMES mock hardcoded.

TASK: Riscrivi Profile.jsx per usare dati reali:

1. Rimuovi USER e RECENT_GAMES hardcoded.

2. Leggi username/display_name/chips_balance/avatar_initials/created_at da useAuth().

3. useEffect al mount: chiama in parallelo (Promise.all):
   - GET /users/me/stats → salva in statsData
   - GET /users/me/game-history → salva in gameHistory
   - GET /users/me/chips-history → salva in chipsHistory

4. Loading state:
   Mentre carica: sostituisci i valori con skeleton rect animati
   (stessi colori del design, pulsano con CSS keyframes)
   Non bloccare tutta la pagina, solo le sezioni che aspettano dati

5. Grafico P/L (già implementato con SVG):
   - Usa chipsHistory filtrato su reason in ["hand_win","hand_loss","sitgo_win","sitgo_loss"]
   - Calcola P/L cumulativo nel tempo (somma progressiva di amount)
   - Se non ci sono dati: mostra "Gioca le tue prime partite per vedere il grafico"

6. Statistiche avanzate (VPIP, PFR, AF, win_rate, biggest_pot):
   - Se null: mostra "—" con tooltip "Servono almeno 20 mani"
   - Se dati presenti: mostra come già nel design mock

7. Tabella sessioni recenti:
   - Usa gameHistory reale
   - table_type="sitgo": mostra "Sit & Go" invece del tipo raw
   - result_chips positivo: in oro con "+"
   - result_chips negativo: in rosso (#c77)
   - Se gameHistory è vuoto: messaggio "Nessuna partita giocata ancora"

8. Il bottone "Deposita" apre un mini-modal inline:
   Sfondo semi-trasparente, testo:
   "Le chips vengono ricaricate automaticamente ogni giorno."
   "Se sei sotto 1.000 chips, domani mattina tornerai a 10.000."
   Bottone "Ho capito" che chiude

Mantieni tutto il design system invariato — cambia solo i dati.
```

---

## Riepilogo ordine di esecuzione

| Passo | Prompt | Cosa sblocca |
|-------|--------|--------------|
| **P1** | Completare hook WS | Tutto il gioco live |
| **P2** | Table.jsx live | Il giocatore può giocare davvero |
| **P3** | BuyinDialog + CreateTableModal | Join e creazione tavoli |
| **P4** | Lobby live | Trova e crea tavoli dalla lobby |
| **P5** | Backend Sit & Go | Logica torneo |
| **P6** | Frontend Sit & Go | UI torneo sul tavolo |
| **P7-A** | Stats backend + scheduler | Profilo reale + ricarica chips |
| **P7-B** | Profilo frontend | Profilo con dati reali |

> P7-A e P7-B sono indipendenti dagli altri e si possono fare in qualsiasi momento.
> P5 e P6 dipendono dal funzionamento base del tavolo (P1 + P2).
