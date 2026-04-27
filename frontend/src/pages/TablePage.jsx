/**
 * TablePage.jsx
 * Orchestrates WebSocket hooks and renders the PokerTable component.
 * Route: /table/:id
 */

import { useCallback, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePokerTable } from '../hooks/usePokerTable';
import { useTableChat } from '../hooks/useTableChat';
import PokerTable from '../components/Table';
import { GoldButton } from '../components/Shell';
import { useAuth } from '../context/AuthContext';
import { useViewport } from '../hooks/useViewport';

// ─────────────────────────────────────────────────────────────────────────────
// Overlay conferma abbandono + riepilogo sessione
// ─────────────────────────────────────────────────────────────────────────────

function LeaveOverlay({ step, pnl, isTournament, tournamentResult, onConfirm, onCancel, onGoLobby }) {
  const isPositive = pnl > 0;
  const isNeutral  = pnl === 0;
  const hasTournamentSummary = tournamentResult?.position != null && tournamentResult?.result != null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1300,
      background: 'rgba(5,10,7,0.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(10px)',
    }}>
      <div style={{
        background: 'rgba(12,18,14,0.97)',
        border: '1px solid rgba(212,175,55,0.35)',
        padding: '28px 20px',
        width: 'min(420px, 92vw)',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
      }}>
        {step === 'confirm' ? (
          <>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: '#F5F1E8', fontStyle: 'italic', marginBottom: 10 }}>
              {isTournament ? 'Sei sicuro di voler abbandonare?' : 'Abbandonare il tavolo?'}
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'rgba(245,241,232,0.5)', letterSpacing: '0.06em', marginBottom: 32, lineHeight: 1.6 }}>
              {isTournament ? (
                <>Verrai eliminato dal torneo.</>
              ) : (
                <>
                  Se hai chips in gioco in una mano in corso,<br />
                  quelle rimarranno nel piatto.
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <GoldButton onClick={onCancel} variant="ghost" size="md">Annulla</GoldButton>
              <GoldButton onClick={onConfirm} size="md">Abbandona</GoldButton>
            </div>
          </>
        ) : isTournament ? (
          <>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: '#F5F1E8', fontStyle: 'italic', marginBottom: 24 }}>
              Uscita dal torneo
            </div>
            {hasTournamentSummary ? (
              <>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'rgba(245,241,232,0.45)', letterSpacing: '0.12em', marginBottom: 10 }}>
                  POSIZIONE FINALE
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 34, fontWeight: 700, color: '#D4AF37', marginBottom: 18 }}>
                  {tournamentResult.position}°
                </div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'rgba(245,241,232,0.6)', letterSpacing: '0.06em', marginBottom: 12 }}>
                  Sei eliminato. Posizione: {tournamentResult.position}.
                  {' '}Risultato: {tournamentResult.result > 0 ? '+' : ''}{tournamentResult.result.toLocaleString('it-IT')}
                </div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'rgba(245,241,232,0.45)', letterSpacing: '0.12em', marginBottom: 8 }}>
                  {(tournamentResult.payout ?? 0) > 0 ? 'PREMIO' : 'PERDITA'}
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 28, fontWeight: 700, color: tournamentResult.result > 0 ? '#4caf50' : '#e57373', marginBottom: 34 }}>
                  {tournamentResult.result > 0 ? '+' : ''}{tournamentResult.result.toLocaleString('it-IT')}
                </div>
                <GoldButton onClick={onGoLobby} size="md">Torna alla Lobby</GoldButton>
              </>
            ) : (
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'rgba(245,241,232,0.55)', letterSpacing: '0.08em' }}>
                Elaborazione uscita dal torneo…
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: '#F5F1E8', fontStyle: 'italic', marginBottom: 24 }}>
              Sessione terminata
            </div>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 38,
              fontWeight: 700,
              color: isNeutral ? '#D4AF37' : isPositive ? '#4caf50' : '#e57373',
              marginBottom: 8,
              letterSpacing: '-0.02em',
            }}>
              {isNeutral ? '±' : isPositive ? '+' : ''}{pnl.toLocaleString('it-IT')}
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'rgba(245,241,232,0.45)', letterSpacing: '0.1em', marginBottom: 36 }}>
              {isNeutral
                ? 'NESSUNA VARIAZIONE'
                : isPositive
                  ? 'GUADAGNATO IN QUESTA SESSIONE'
                  : 'PERSO IN QUESTA SESSIONE'}
            </div>
            <GoldButton onClick={onGoLobby} size="md">Torna alla Lobby</GoldButton>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function TablePage() {
  const { id: tableId } = useParams();
  const navigate        = useNavigate();
  const { user }        = useAuth();
  const { isMobile }    = useViewport();

  // Bridge ref: usePokerTable dispatches chat events → useTableChat receives them
  const chatCallbackRef = useRef(null);
  const onChatMessage   = useCallback((msg) => chatCallbackRef.current?.(msg), []);

  // Leave flow state
  const [leaveStep, setLeaveStep] = useState(null); // null | 'confirm' | 'summary'
  const [sessionPnl, setSessionPnl] = useState(0);

  const {
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
    gameStartingIn,
    handWinner,
    seatDeltas,
    timerTrigger,
    sessionBuyin,
    sendAction,
    sendChat,
    joinSeat,
    leaveSeat,
    sendRebuy,
    isTournament,
    tournament,
    blindLevelEndsAt,
    eliminatedPlayers,
    tournamentEnded,
    latestEliminated,
    tournamentResult,
  } = usePokerTable(tableId, { onChatMessage });

  const { messages, sendMessage } = useTableChat(sendChat, chatCallbackRef);

  // Calcola P&L e mostra conferma
  const handleLeaveRequest = useCallback(() => {
    setLeaveStep('confirm');
  }, []);

  // Utente conferma abbandono
  const handleLeaveConfirm = useCallback(() => {
    if (isTournament) {
      if (mySeat !== null) {
        leaveSeat();
      }
      setLeaveStep('summary');
      return;
    }
    const seats = tableState?.seats ?? [];
    const myStack = mySeat !== null ? (seats[mySeat]?.stack ?? 0) : 0;
    const pnl = myStack - sessionBuyin;
    setSessionPnl(pnl);
    leaveSeat();
    setLeaveStep('summary');
  }, [isTournament, mySeat, leaveSeat, tableState, sessionBuyin]);

  const handleGoLobby = useCallback(() => {
    navigate('/lobby');
  }, [navigate]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: isMobile ? 'auto' : 'hidden' }}>

      {/* ── Overlay connessione (caricamento / riconnessione / persa) ───────── */}
      {!connected && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(5,10,7,0.93)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)',
        }}>
          <style>{`
            @keyframes ridotto-spin { to { transform: rotate(360deg); } }
          `}</style>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            border: '4px solid rgba(212,175,55,0.2)',
            borderTopColor: '#D4AF37',
            animation: 'ridotto-spin 0.9s linear infinite',
            marginBottom: 28,
          }} />
          <div style={{
            fontFamily: 'Playfair Display, serif', fontSize: 24,
            color: '#F5F1E8', fontStyle: 'italic', marginBottom: 8,
          }}>
            Caricamento
          </div>
          <div style={{
            fontFamily: 'Inter, sans-serif', fontSize: 12,
            color: 'rgba(245,241,232,0.4)', letterSpacing: '0.1em', marginBottom: 36,
          }}>
            {reconnecting ? 'Riconnessione in corso…' : 'Connessione al server…'}
          </div>
          {!reconnecting && (
            <button
              onClick={() => navigate('/lobby')}
              style={{
                background: 'transparent', border: '1px solid rgba(212,175,55,0.3)',
                color: 'rgba(212,175,55,0.6)', padding: '8px 24px',
                fontFamily: 'Inter, sans-serif', fontSize: 11,
                letterSpacing: '0.15em', cursor: 'pointer',
              }}
            >
              TORNA ALLA LOBBY
            </button>
          )}
        </div>
      )}

      {/* ── Overlay abbandono ────────────────────────────────────────────── */}
      {leaveStep && (
        <LeaveOverlay
          step={leaveStep}
          pnl={sessionPnl}
          isTournament={isTournament}
          tournamentResult={tournamentResult}
          onConfirm={handleLeaveConfirm}
          onCancel={() => setLeaveStep(null)}
          onGoLobby={handleGoLobby}
        />
      )}

      {/* ── Tavolo ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
        <PokerTable
          tableId={tableId}
          tableState={tableState}
          tableConfig={tableConfig}
          myCards={myCards}
          mySeat={mySeat}
          connected={connected}
          showdownResults={showdownResults}
          handEndResult={handEndResult}
          waitingForPlayers={waitingForPlayers}
          lastError={lastError}
          handLog={handLog}
          gameStartingIn={gameStartingIn}
          handWinner={handWinner}
          seatDeltas={seatDeltas}
          timerTrigger={timerTrigger}
          messages={messages}
          sendAction={sendAction}
          sendMessage={sendMessage}
          joinSeat={joinSeat}
          leaveSeat={leaveSeat}
          sendRebuy={sendRebuy}
          profileBalance={user?.chips_balance ?? 0}
          onLeave={handleLeaveRequest}
          cardBack="ridotto"
          isTournament={isTournament}
          tournament={tournament}
          blindLevelEndsAt={blindLevelEndsAt}
          eliminatedPlayers={eliminatedPlayers}
          tournamentEnded={tournamentEnded}
          latestEliminated={latestEliminated}
        />
      </div>
    </div>
  );
}
