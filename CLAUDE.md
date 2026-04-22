# CLAUDE.md — Ridotto Poker

Leggi questo file prima di qualsiasi operazione sul codice.
Leggi anche `backend/CLAUDE.md` e `frontend/CLAUDE.md` per contesto specifico.
Aggiorna questo file dopo ogni modifica, aggiunta di codice.

## Cos'è questo progetto
App poker privata per un gruppo di amici. Texas Hold'em No-Limit, chips finte.
Accesso solo con codice invito. Backend FastAPI su Render, DB Supabase PostgreSQL,
frontend Vite + React.

## File di pianificazione da leggere prima di scrivere codice
- `PIANO_IMPLEMENTAZIONE_V2.md` — passo corrente, prompt dettagliati per ogni feature
- `.github/copilot-instructions.md` — design system, convenzioni, stato completo

## Regola principale
**Non riscrivere mai ciò che funziona già.** Prima di modificare un file, leggi il
suo contenuto completo per capire cosa fa. Se un file è segnato come completo nelle
istruzioni, apporta solo modifiche chirurgiche.

## Priorità lavoro corrente (in ordine)
1. Completare `frontend/src/hooks/usePokerTable.js` — aggiungere sendAction/joinSeat/leaveSeat
2. Collegare `frontend/src/components/Table.jsx` al hook WebSocket reale
3. Creare `frontend/src/components/BuyinDialog.jsx` e `CreateTableModal.jsx`
4. Aggiornare `frontend/src/components/Lobby.jsx` con dati reali dal backend
5. ✅ Raffinare integrazione frontend Sit&Go (lobby/API/modal/registrazioni)
6. Aggiungere eventuali metriche extra a `/users/me/stats` e `/users/me/game-history`
7. Creare `backend/scheduler.py`

## Comandi utili
```bash
# Backend
cd backend && uvicorn main:app --reload --port 8000

# Frontend
cd frontend && npm run dev

# Test poker engine
cd backend && python poker_engine.py

# Migrazioni SQL (applica su Supabase)
# backend/migrations/001_invite_codes.sql
# backend/migrations/002_tables_hands_sitgo.sql
# backend/migrations/003_player_game_sessions.sql
```

## Regola operativa comunicazione Git
- Ogni volta che proponi comandi Git per commit/push dopo una modifica, devi includere anche i comandi per eseguire i test/local check pertinenti prima del push.
