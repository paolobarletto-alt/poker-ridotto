# AGENTS.md — Ridotto Poker

> Per agenti AI (Codex, ecc.) che lavorano su questo repository.
> Leggi questo file integralmente prima di qualsiasi modifica al codice.
> Leggi anche `backend/CLAUDE.md` e `frontend/CLAUDE.md` per dettagli specifici.

---

## Identità del progetto
**Ridotto** è un'app poker privata per un gruppo di amici.
- Modalità: Texas Hold'em No-Limit
- Chips: finte (nessun valore reale)
- Accesso: solo con codice invito generato dall'admin
- Modalità di gioco: Cash Game e Sit & Go

---

## Prima di scrivere qualsiasi codice

1. **Leggi il file target** nella sua interezza prima di modificarlo
2. **Controlla lo stato** nella tabella qui sotto — non riscrivere ciò che è già completo
3. **Rispetta le convenzioni** di stile e architettura documentate in questo file
4. **Non aggiungere dipendenze** non presenti in `requirements.txt` o `package.json`
   senza ragione esplicita

---

## Mappa dello stato — backend

| File | Stato | Note |
|---|---|---|
| `backend/poker_engine.py` | ✅ COMPLETO | Non toccare. Classi in italiano. |
| `backend/game_manager.py` | ✅ COMPLETO | Singleton in memoria. |
| `backend/auth.py` | ✅ COMPLETO | JWT + bcrypt. |
| `backend/database.py` | ✅ COMPLETO | Async SQLAlchemy. |
| `backend/config.py` | ✅ COMPLETO | Pydantic settings. |
| `backend/models.py` | ✅ COMPLETO | Tutti i modelli DB. |
| `backend/schemas.py` | ✅ COMPLETO | Estendere con SitGo schemas. |
| `backend/main.py` | ✅ COMPLETO | Aggiungere `sitgo_router` quando creato. |
| `backend/routers/auth_router.py` | ✅ COMPLETO | |
| `backend/routers/admin_router.py` | ✅ COMPLETO | |
| `backend/routers/ws_router.py` | ⚠️ PARZIALE | join/leave DB sync da verificare. |
| `backend/routers/users_router.py` | ⚠️ PARZIALE | Mancano `/me/stats`, `/me/game-history`, `/me/current-seat`. |
| `backend/routers/sitgo_router.py` | ❌ DA CREARE | Vedi prompt P5 in `PIANO_IMPLEMENTAZIONE_V2.md`. |
| `backend/scheduler.py` | ❌ DA CREARE | APScheduler daily refill. Vedi prompt P7-A. |

## Mappa dello stato — frontend

| File | Stato | Note |
|---|---|---|
| `frontend/src/api/client.js` | ✅ COMPLETO | Non toccare. |
| `frontend/src/api/auth.js` | ✅ COMPLETO | Non toccare. |
| `frontend/src/api/tables.js` | ⚠️ PARZIALE | Aggiungere listSitGos, registerSitGo, ecc. |
| `frontend/src/context/AuthContext.jsx` | ✅ COMPLETO | Non toccare. |
| `frontend/src/App.jsx` | ✅ COMPLETO | Non toccare. |
| `frontend/src/pages/LoginPage.jsx` | ✅ COMPLETO | Non toccare. |
| `frontend/src/components/Shell.jsx` | ✅ COMPLETO | Non toccare. |
| `frontend/src/hooks/usePokerTable.js` | ⚠️ PARZIALE | Aggiungere sendAction, joinSeat, leaveSeat. Vedi P1. |
| `frontend/src/hooks/useTableChat.js` | ⚠️ PARZIALE | Completare. |
| `frontend/src/components/Lobby.jsx` | ⚠️ PARZIALE | Dati mock → fetch reali. Vedi P4. |
| `frontend/src/components/Table_clean.jsx` | ⚠️ PARZIALE | Collegare al WS. Vedi P2. |
| `frontend/src/components/Profile.jsx` | ⚠️ PARZIALE | Dati mock → fetch reali. Vedi P7-B. |
| `frontend/src/components/BuyinDialog.jsx` | ❌ DA CREARE | Vedi P3. |
| `frontend/src/components/CreateTableModal.jsx` | ❌ DA CREARE | Vedi P3. |
| `frontend/src/pages/TablePage.jsx` | ⚠️ PARZIALE | Non passa tableId. Vedi P2. |

---

## Regole di sicurezza del codice

### Backend
- Il server è sempre **autoritativo** per lo stato del gioco. Il client non calcola mai risultati.
- Valida sempre l'autenticazione prima di qualsiasi azione di gioco.
- `poker_engine.py` è puro Python senza dipendenze esterne — non aggiungere import.
- I nomi delle classi in `poker_engine.py` sono in **italiano** e non vanno cambiati:
  `GiocoPoker`, `Carta`, `Mazzo`, `ValutatoreRisultato`, `FaseGioco`, `StatoSeat`
- Usa sempre `uuid.uuid4()` come default per le PK, non autoincrement.
- Salva sempre datetime con timezone: `datetime.now(timezone.utc)`

### Frontend
- **Zero file CSS.** Tutto stile inline come oggetto JS.
- **Zero librerie UI.** Solo componenti custom con CSS inline.
- Usa sempre `useAuth()` per accedere all'utente, mai `localStorage` diretto.
- Usa sempre `api/client.js` per le chiamate HTTP, mai `fetch()` diretto.
- Il WebSocket token va come query param: `?token=${token}` (non header).

---

## API endpoints disponibili

### Auth
```
POST /auth/register   { username, email, password, display_name, invite_code }
POST /auth/login      { email, password }
GET  /auth/me
```

### Admin
```
POST   /admin/invites
GET    /admin/invites
DELETE /admin/invites/{code}
GET    /admin/users
PATCH  /admin/users/{id}/toggle-active
POST   /admin/users/{id}/add-chips
```

### Tavoli
```
GET    /tables                  lista tavoli aperti
POST   /tables                  crea tavolo (qualsiasi utente)
GET    /tables/{id}             dettaglio + posti
DELETE /tables/{id}             chiudi (solo creatore/admin)
WS     /ws/table/{id}?token=   connessione WebSocket
```

### Users
```
GET /users/me/chips-history     ✅ implementato
GET /users/{username}           ✅ implementato
PUT /users/me                   ✅ implementato
GET /users/me/current-seat      ❌ da aggiungere
GET /users/me/stats             ❌ da aggiungere
GET /users/me/game-history      ❌ da aggiungere
```

### Sit & Go (da implementare)
```
GET    /sitgo
POST   /sitgo
GET    /sitgo/{id}
POST   /sitgo/{id}/register
DELETE /sitgo/{id}/register
```

---

## Variabili d'ambiente richieste

```bash
# backend/.env
DATABASE_URL=postgresql+asyncpg://...
SECRET_KEY=...minimo-32-caratteri...
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
FRONTEND_URL=https://...
DAILY_REFILL_THRESHOLD=1000
DAILY_REFILL_AMOUNT=10000

# frontend/.env
VITE_API_URL=https://...onrender.com
```

---

## Test
```bash
# Verifica poker engine
cd backend && python poker_engine.py

# Avvia backend dev
cd backend && uvicorn main:app --reload

# Avvia frontend dev
cd frontend && npm run dev
```

---

## Riferimento piano completo
Per i prompt dettagliati di implementazione di ogni feature mancante:
→ `PIANO_IMPLEMENTAZIONE_V2.md`

Per convenzioni estese di backend e frontend:
→ `backend/CLAUDE.md` e `frontend/CLAUDE.md`
→ `.github/copilot-instructions.md`

## Note Importanti
- aggiorna qesto file dopo ogni modificaa o aggiunta di codice
