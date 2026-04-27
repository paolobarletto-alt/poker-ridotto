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

## Aggiornamento recente
- Avviata implementazione mobile-friendly: aggiunti breakpoint condivisi (`useViewport`) e shell responsive (`AppFrame` con hamburger/drawer). Prime ottimizzazioni applicate a Lobby, Race, Login e modali principali.
- Tavolo mobile rifinito: lock/fallback in orizzontale in `TablePage`; chat e cronologia non sempre visibili, ora apribili on-demand con pannello toggle in `Table`.
- Ulteriore tuning tavolo mobile: scaling/resizing su elementi principali (header, tavolo, seat/cards, action controls, overlay) per migliorare usabilita in landscape.
- Corretto overlap residuo in mobile landscape: posizioni seat dedicate per viewport stretta e action bar resa fixed bottom per non coprire seat/nameplate.
- Fix finale mobile: valore piatto spostato/stilizzato per non essere coperto dalle carte; modale buy-in resa piu compatta su mobile (dimensioni/padding/altezze).
- Ritocco ulteriore tavolo mobile: riduzione dimensionale del widget PIATTO (padding + font) su mobile.
- Feature admin tornei: introdotta visibilità lobby (`is_visible_in_lobby`) per cash/sit&go con toggle in AdminPage, senza eliminare i tavoli/tornei.
- Backend lobby filtrata per non-admin su tavoli/tornei nascosti; admin dispone di endpoint dedicati per vedere anche chiusi/finiti e gestire show/hide.
- Correzione visibilità lobby: ora il filtro `is_visible_in_lobby` è applicato a tutti in lobby (anche admin), quindi un tavolo nascosto non appare più in Cash/Sit&Go lobby.
- Admin tornei: "Elimina" in UI è soft-delete (imposta `is_visible_in_lobby=false`) per cash e sit&go; introdotta sezione "Eliminati" con ripristino.
- Showdown: aumentata la durata di visualizzazione delle carte rivelate (TTL `showdownResults` lato frontend).
- Sit&Go timer fix: aggiunta sincronizzazione immediata del countdown livello al primo hand_start per evitare stato fisso "timer livello in sincronizzazione…".
