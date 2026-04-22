@echo off
cd /d "C:\Users\paolo\OneDrive\Desktop\poker_micetti\poker-ridotto"
git add backend/poker_engine.py backend/routers/ws_router.py
git commit -m "feat: reveal all-in community cards one street at a time with delay

When all players are all-in and there are still cards to reveal:
- Flop (3 cards): shown immediately, then 2s delay before Turn
- Turn (1 card): shown with 1.5s delay after Flop
- River (1 card): shown with 1.5s delay after Turn
- Showdown: triggered 1.5s after River

Changes:
- poker_engine.py: _avanza_fase() no longer recursively reveals all
  remaining streets when all-in; sets turno_attivo=None and returns
- ws_router.py: _post_action_advance() detects all-in runout (new
  street + no active player) and launches _run_out_cards() task;
  new _run_out_cards() coroutine handles delayed card reveal loop
  and full hand-end logic after the last card

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
git push
