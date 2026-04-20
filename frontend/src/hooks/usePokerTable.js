/**
 * usePokerTable.js — Hook WebSocket per un tavolo poker in tempo reale.
 *
 * Stato esposto:
 *   tableState        { seats[9], pot, community, phase, acting_seat, timer_seconds, hand_number }
 *   tableConfig       { name, table_type, min_players, max_seats, speed,
 *                       small_blind, big_blind, min_buyin, max_buyin }
 *   myCards           string[]
 *   mySeat            number | null
 *   connected         bool
 *   reconnecting      bool
 *   showdownResults   array | null  (auto-clear dopo 3s)
 *   handEndResult     { winner_seat, pot_won, hand_description } | null  (auto-clear dopo 3s)
 *   waitingForPlayers number | null
 *   lastError         string | null  (auto-clear dopo 4s)
 *   handLog           [{ t, txt }]  (max 50)
 *
 * API:
 *   sendAction(action, amount?)  — con coda offline
 *   sendChat(message)
 *   joinSeat(seat, buyin)
 *   leaveSeat()
 *   onChatMessage callback (passato come opzione)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

// ─────────────────────────────────────────────────────────────────────────────
// Costanti
// ─────────────────────────────────────────────────────────────────────────────

const WS_BASE =
  (import.meta.env.VITE_API_URL || '')
    .replace(/^https?:\/\//, (m) => (m === 'https://' ? 'wss://' : 'ws://'))
    .replace(/\/$/, '');

const MAX_SEATS        = 9;
const RECONNECT_DELAY  = 3000;   // ms tra un tentativo e il successivo
const MAX_RECONNECTS   = 5;      // oltre questo numero si smette
const PING_INTERVAL    = 30_000; // ms keepalive
const SHOWDOWN_TTL     = 3000;   // ms prima di azzerare showdownResults
const HAND_END_TTL     = 3000;   // ms prima di azzerare handEndResult
const ERROR_TTL        = 4000;   // ms prima di azzerare lastError
const ELIMINATED_TTL   = 3000;   // ms prima di azzerare latestEliminated

const EMPTY_SEATS = Array.from({ length: MAX_SEATS }, () => null);

const INITIAL_TABLE_STATE = {
  seats:         EMPTY_SEATS,
  pot:           0,
  community:     [],
  phase:         'waiting',
  acting_seat:   null,
  timer_seconds: 0,
  hand_number:   0,
};

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function usePokerTable(tableId, { onChatMessage } = {}) {
  const { user, token } = useAuth();

  // ── Stato principale ──────────────────────────────────────────────────────
  const [tableState,        setTableState]        = useState(INITIAL_TABLE_STATE);
  const [tableConfig,       setTableConfig]       = useState(null);
  const [myCards,           setMyCards]           = useState([]);
  const [mySeat,            setMySeat]            = useState(null);
  const [connected,         setConnected]         = useState(false);
  const [reconnecting,      setReconnecting]      = useState(false);
  const [showdownResults,   setShowdownResults]   = useState(null);
  const [handEndResult,     setHandEndResult]     = useState(null);
  const [waitingForPlayers, setWaitingForPlayers] = useState(null);
  const [lastError,         setLastError]         = useState(null);
  const [handLog,           setHandLog]           = useState([]);

  // ── Stato torneo ──────────────────────────────────────────────────────────
  const [isTournament,      setIsTournament]      = useState(false);
  const [tournament,        setTournament]        = useState(null);
  const [blindLevelEndsAt,  setBlindLevelEndsAt]  = useState(null);
  const [eliminatedPlayers, setEliminatedPlayers] = useState([]);
  const [tournamentEnded,   setTournamentEnded]   = useState(null);
  const [latestEliminated,  setLatestEliminated]  = useState(null);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const wsRef             = useRef(null);
  const reconnectTimer    = useRef(null);
  const reconnectCount    = useRef(0);
  const countdownTimer    = useRef(null);
  const pingTimer         = useRef(null);
  const shouldReconnect   = useRef(true);
  const actionQueue       = useRef([]);   // messaggi in coda durante disconnessione
  const onChatRef         = useRef(onChatMessage);
  // timer refs per auto-clear (evitano stale closure su setTimeout)
  const showdownClearRef   = useRef(null);
  const handEndClearRef    = useRef(null);
  const errorClearRef      = useRef(null);
  const eliminatedClearRef = useRef(null);

  useEffect(() => { onChatRef.current = onChatMessage; }, [onChatMessage]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const pushLog = useCallback((txt) => {
    const t = new Date().toLocaleTimeString('it-IT');
    setHandLog((prev) => [{ t, txt }, ...prev].slice(0, 50));
  }, []);

  const setErrorWithTTL = useCallback((msg) => {
    clearTimeout(errorClearRef.current);
    setLastError(msg);
    errorClearRef.current = setTimeout(() => setLastError(null), ERROR_TTL);
  }, []);

  // ── Timer countdown locale ────────────────────────────────────────────────

  const startCountdown = useCallback((seconds) => {
    clearInterval(countdownTimer.current);
    if (!seconds || seconds <= 0) return;
    countdownTimer.current = setInterval(() => {
      setTableState((prev) => {
        const next = prev.timer_seconds - 1;
        if (next <= 0) {
          clearInterval(countdownTimer.current);
          return { ...prev, timer_seconds: 0 };
        }
        return { ...prev, timer_seconds: next };
      });
    }, 1000);
  }, []);

  const stopCountdown = useCallback(() => {
    clearInterval(countdownTimer.current);
    countdownTimer.current = null;
  }, []);

  // ── Normalizzazione seats ─────────────────────────────────────────────────

  const normalizeSeats = useCallback((rawSeats, userId) => {
    const arr = Array.from({ length: MAX_SEATS }, () => null);
    if (!Array.isArray(rawSeats)) return arr;
    for (const s of rawSeats) {
      const idx = s.seat ?? s.seat_number;
      if (idx != null && idx >= 0 && idx < MAX_SEATS) {
        arr[idx] = {
          seat:         idx,
          user_id:      s.user_id          ?? s.player_id        ?? null,
          username:     s.username         ?? s.nome             ?? '',
          stack:        s.stack            ?? 0,
          bet_in_round: s.puntata_corrente ?? s.bet_in_round     ?? 0,
          status:       s.stato            ?? s.status           ?? 'active',
          last_action:  s.last_action      ?? null,
          is_dealer:    s['è_dealer']      ?? s.is_dealer        ?? false,
          is_sb:        s['è_small_blind'] ?? s.is_sb            ?? false,
          is_bb:        s['è_big_blind']   ?? s.is_bb            ?? false,
          is_me:        (s.user_id ?? s.player_id) === userId,
        };
      }
    }
    return arr;
  }, []);

  // ── Applica table_state / state ──────────────────────────────────────────

  const applyTableState = useCallback((d, userId) => {
    const rawSeats = d.giocatori ?? d.seats ?? [];
    const seats    = normalizeSeats(rawSeats, userId);
    const mine     = seats.find((s) => s?.is_me);
    if (mine) setMySeat(mine.seat);

    const newState = {
      seats,
      pot:           d.piatto        ?? d.pot           ?? 0,
      community:     d.board         ?? d.community     ?? [],
      phase:         d.fase          ?? d.phase         ?? 'waiting',
      acting_seat:   _resolveActingSeat(d, seats),
      timer_seconds: d.timer_seconds ?? 0,
      hand_number:   d.num_mano      ?? d.hand_number   ?? 0,
    };
    setTableState(newState);
    stopCountdown();
    if (newState.timer_seconds > 0 && newState.acting_seat !== null)
      startCountdown(newState.timer_seconds);
    return newState;
  }, [normalizeSeats, stopCountdown, startCountdown]);

  // ── Handler messaggi ──────────────────────────────────────────────────────

  const handleMessage = useCallback((raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    const userId = user?.id ?? '';

    switch (msg.type) {

      // ── Stato tavolo completo ───────────────────────────────────────────
      case 'state':
      case 'table_state': {
        const d = msg.state ?? msg;
        applyTableState(d, userId);
        break;
      }

      // ── Carte private ───────────────────────────────────────────────────
      case 'hole_cards':
        setMyCards(msg.cards ?? []);
        break;

      // ── Inizio mano ─────────────────────────────────────────────────────
      case 'hand_start':
        setMyCards([]);
        setShowdownResults(null);
        setHandEndResult(null);
        clearTimeout(showdownClearRef.current);
        clearTimeout(handEndClearRef.current);
        setHandLog([]);
        setTableState((prev) => ({
          ...prev,
          community:     [],
          pot:           0,
          hand_number:   msg.hand_number ?? prev.hand_number + 1,
          phase:         'preflop',
          acting_seat:   null,
          timer_seconds: 0,
        }));
        stopCountdown();
        pushLog(`Mano #${msg.hand_number ?? ''} iniziata`);
        break;

      // ── Nuova street ────────────────────────────────────────────────────
      case 'new_street':
        setTableState((prev) => ({
          ...prev,
          phase:         msg.phase ?? prev.phase,
          community:     msg.board ?? prev.community,
          acting_seat:   null,
          timer_seconds: 0,
        }));
        stopCountdown();
        pushLog(
          `${(msg.phase ?? '').toUpperCase()}` +
          (msg.board?.length ? ': ' + msg.board.slice(-1)[0] : '')
        );
        break;

      // ── Azione giocatore ────────────────────────────────────────────────
      case 'player_action':
        setTableState((prev) => ({
          ...prev,
          seats: prev.seats.map((s) => {
            if (!s || s.seat !== msg.seat) return s;
            return {
              ...s,
              last_action:  msg.action,
              bet_in_round: msg.amount ?? s.bet_in_round,
              // status folded se l'azione è fold
              status:       msg.action === 'fold' ? 'folded' : s.status,
            };
          }),
        }));
        pushLog(
          `${msg.username ?? `Seat ${msg.seat}`}: ` +
          `${(msg.action ?? '').toUpperCase()}` +
          (msg.amount > 0 ? ` €${msg.amount}` : '')
        );
        break;

      // ── Timer azione ────────────────────────────────────────────────────
      case 'action_timer':
        stopCountdown();
        setTableState((prev) => ({
          ...prev,
          acting_seat:   msg.seat ?? prev.acting_seat,
          timer_seconds: msg.seconds ?? 0,
        }));
        if (msg.seconds > 0) startCountdown(msg.seconds);
        break;

      // ── Showdown ────────────────────────────────────────────────────────
      case 'showdown':
        stopCountdown();
        if (msg.results) {
          clearTimeout(showdownClearRef.current);
          setShowdownResults(msg.results);
          showdownClearRef.current = setTimeout(
            () => setShowdownResults(null), SHOWDOWN_TTL
          );
        }
        break;

      // ── Fine mano ───────────────────────────────────────────────────────
      case 'hand_end': {
        stopCountdown();
        setMyCards([]);
        setTableState((prev) => ({
          ...prev, acting_seat: null, timer_seconds: 0, phase: 'waiting',
        }));

        const result = {
          winner_seat:      msg.winner_seat      ?? null,
          pot_won:          msg.pot_won          ?? msg.pot ?? 0,
          hand_description: msg.hand_description ?? null,
        };
        clearTimeout(handEndClearRef.current);
        setHandEndResult(result);
        handEndClearRef.current = setTimeout(
          () => setHandEndResult(null), HAND_END_TTL
        );

        if (result.hand_description)
          pushLog(`Mano vinta: ${result.hand_description} — €${result.pot_won}`);
        else if (result.pot_won)
          pushLog(`Piatto vinto: €${result.pot_won}`);
        break;
      }

      // ── Attesa giocatori ────────────────────────────────────────────────
      case 'waiting_players':
        setWaitingForPlayers(msg.needed ?? null);
        setTableState((prev) => ({ ...prev, phase: 'waiting', acting_seat: null }));
        stopCountdown();
        pushLog(`In attesa di ${msg.needed ?? '?'} giocatore/i`);
        break;

      // ── Giocatore si siede ──────────────────────────────────────────────
      case 'player_joined':
        if (msg.username === user?.username) setMySeat(msg.seat);
        setTableState((prev) => {
          const seats = [...prev.seats];
          seats[msg.seat] = {
            seat:         msg.seat,
            user_id:      msg.user_id  ?? null,
            username:     msg.username ?? '',
            stack:        msg.stack    ?? 0,
            bet_in_round: 0,
            status:       'active',
            last_action:  null,
            is_dealer:    false,
            is_sb:        false,
            is_bb:        false,
            is_me:        msg.username === user?.username,
          };
          return { ...prev, seats };
        });
        setWaitingForPlayers(null);
        pushLog(`${msg.username} si siede al posto ${msg.seat + 1}`);
        break;

      // ── Giocatore lascia ────────────────────────────────────────────────
      case 'player_left':
        if (msg.username === user?.username) { setMySeat(null); setMyCards([]); }
        setTableState((prev) => {
          const seats = [...prev.seats];
          if (msg.seat != null) seats[msg.seat] = null;
          return { ...prev, seats };
        });
        pushLog(`${msg.username} lascia il tavolo`);
        break;

      // ── Welcome (primo messaggio alla connessione) ───────────────────────
      case 'welcome': {
        if (msg.table) {
          // Normalizza sia il formato snake_case che camelCase
          const t = msg.table;
          setTableConfig({
            name:        t.name        ?? t.nome       ?? '',
            table_type:  t.table_type  ?? t.tipo       ?? 'cash',
            min_players: t.min_players ?? 2,
            max_seats:   t.max_seats   ?? MAX_SEATS,
            speed:       t.speed       ?? 'normal',
            small_blind: t.small_blind ?? t.piccolo_buio ?? 5,
            big_blind:   t.big_blind   ?? t.grande_buio  ?? 10,
            min_buyin:   t.min_buyin   ?? t.buyin_min    ?? 100,
            max_buyin:   t.max_buyin   ?? t.buyin_max    ?? null,
          });
        }
        if (msg.tournament) {
          const tr = msg.tournament;
          setIsTournament(true);
          setTournament({
            id:                   tr.id,
            name:                 tr.name,
            current_blind_level:  tr.current_blind_level ?? 1,
            blind_schedule:       tr.blind_schedule ?? [],
            speed:                tr.speed ?? 'normal',
          });
          if (tr.level_ends_at) {
            setBlindLevelEndsAt(new Date(tr.level_ends_at));
          }
        }
        if (msg.state) applyTableState(msg.state, userId);
        break;
      }

      // ── Livello blind avanzato ───────────────────────────────────────────
      case 'blind_level_up':
        setTournament((prev) => prev ? {
          ...prev,
          current_blind_level: msg.level ?? prev.current_blind_level,
        } : prev);
        if (msg.next_level_in > 0) {
          setBlindLevelEndsAt(new Date(Date.now() + msg.next_level_in * 1000));
        }
        pushLog(`Livello blind ${msg.level}: ${msg.small_blind}/${msg.big_blind}`);
        break;

      // ── Giocatore eliminato ──────────────────────────────────────────────
      case 'player_eliminated': {
        const elim = { seat: msg.seat, position: msg.position, username: msg.username };
        setEliminatedPlayers((prev) => [...prev, elim]);
        clearTimeout(eliminatedClearRef.current);
        setLatestEliminated(elim);
        eliminatedClearRef.current = setTimeout(
          () => setLatestEliminated(null), ELIMINATED_TTL
        );
        pushLog(`${msg.username} eliminato · ${msg.position}° posto`);
        break;
      }

      // ── Torneo concluso ──────────────────────────────────────────────────
      case 'tournament_ended':
        setTournamentEnded({
          winner_username:  msg.winner_username,
          position_results: msg.position_results ?? [],
        });
        pushLog(`Torneo concluso! Vincitore: ${msg.winner_username}`);
        break;

      // ── Chat ─────────────────────────────────────────────────────────────
      case 'chat':
        if (onChatRef.current) onChatRef.current(msg);
        break;

      // ── Errore dal server ─────────────────────────────────────────────────
      case 'error':
        console.warn('[PokerTable] Errore server:', msg.message);
        setErrorWithTTL(msg.message ?? 'Errore sconosciuto');
        break;

      // ── Pong keepalive ───────────────────────────────────────────────────
      case 'pong':
        break;

      default:
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, applyTableState, startCountdown, stopCountdown, pushLog, setErrorWithTTL]);

  // ── Invio con coda offline ────────────────────────────────────────────────

  const _send = useCallback((obj) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(obj));
    } else {
      // Accoda solo messaggi di azione (non ping/chat)
      if (obj.type === 'action' || obj.type === 'join_seat' || obj.type === 'leave_seat') {
        actionQueue.current.push(obj);
      }
    }
  }, []);

  const _flushQueue = useCallback(() => {
    while (actionQueue.current.length > 0) {
      const item = actionQueue.current.shift();
      if (wsRef.current?.readyState === WebSocket.OPEN)
        wsRef.current.send(JSON.stringify(item));
    }
  }, []);

  // ── Ping keepalive ────────────────────────────────────────────────────────

  const _startPing = useCallback((ws) => {
    clearInterval(pingTimer.current);
    pingTimer.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ type: 'ping' }));
    }, PING_INTERVAL);
  }, []);

  const _stopPing = useCallback(() => {
    clearInterval(pingTimer.current);
    pingTimer.current = null;
  }, []);

  // ── Connessione / riconnessione ───────────────────────────────────────────

  const connect = useCallback(() => {
    if (!token || !tableId) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const url = `${WS_BASE}/ws/table/${tableId}?token=${encodeURIComponent(token)}`;
    const ws  = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setReconnecting(false);
      reconnectCount.current = 0;
      _startPing(ws);
      _flushQueue();
    };

    ws.onmessage = (e) => handleMessage(e.data);

    ws.onclose = (e) => {
      _stopPing();
      setConnected(false);
      stopCountdown();

      // Codici permanenti: non provare a riconnettersi
      const permanent = e.code === 4001 || e.code === 4004;
      if (!shouldReconnect.current || permanent) {
        setReconnecting(false);
        return;
      }

      if (reconnectCount.current >= MAX_RECONNECTS) {
        setReconnecting(false);
        console.warn('[PokerTable] Tentativi di riconnessione esauriti.');
        return;
      }

      reconnectCount.current += 1;
      setReconnecting(true);
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
    };

    ws.onerror = () => ws.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tableId, handleMessage, stopCountdown, _startPing, _stopPing, _flushQueue]);

  // ── Effetto mount / cambio tavolo ─────────────────────────────────────────

  useEffect(() => {
    shouldReconnect.current  = true;
    reconnectCount.current   = 0;
    actionQueue.current      = [];
    connect();

    return () => {
      shouldReconnect.current = false;
      clearTimeout(reconnectTimer.current);
      clearTimeout(showdownClearRef.current);
      clearTimeout(handEndClearRef.current);
      clearTimeout(errorClearRef.current);
      clearTimeout(eliminatedClearRef.current);
      stopCountdown();
      _stopPing();
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, token]);

  // ── API pubblica ──────────────────────────────────────────────────────────

  const sendAction = useCallback(
    (action, amount = 0) => _send({ type: 'action', action, amount }),
    [_send]
  );
  const sendChat = useCallback(
    (message) => _send({ type: 'chat', message }),
    [_send]
  );
  const joinSeat = useCallback(
    (seat, buyin) => _send({ type: 'join_seat', seat, buyin }),
    [_send]
  );
  const leaveSeat = useCallback(
    () => _send({ type: 'leave_seat' }),
    [_send]
  );

  return {
    // Stato
    tableState,
    tableConfig,
    myCards,
    mySeat,
    connected,
    reconnecting,
    showdownResults,
    handEndResult,
    waitingForPlayers,
    lastError,
    handLog,
    // Torneo
    isTournament,
    tournament,
    blindLevelEndsAt,
    eliminatedPlayers,
    tournamentEnded,
    latestEliminated,
    // Azioni
    sendAction,
    sendChat,
    joinSeat,
    leaveSeat,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper privato: risolve acting_seat da formati diversi del backend
// ─────────────────────────────────────────────────────────────────────────────

function _resolveActingSeat(raw, seats) {
  if (raw.acting_seat !== undefined) return raw.acting_seat;
  if (raw.turno_attivo) {
    const found = seats.find((s) => s && s.user_id === raw.turno_attivo);
    return found ? found.seat : null;
  }
  return null;
}
