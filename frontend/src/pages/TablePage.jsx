/**
 * TablePage.jsx
 * Orchestrates WebSocket hooks and renders the PokerTable component.
 * Route: /table/:id
 */

import { useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePokerTable } from '../hooks/usePokerTable';
import { useTableChat } from '../hooks/useTableChat';
import PokerTable from '../components/Table';

// ─────────────────────────────────────────────────────────────────────────────

export default function TablePage() {
  const { id: tableId } = useParams();
  const navigate        = useNavigate();

  // Bridge ref: usePokerTable dispatches chat events → useTableChat receives them
  const chatCallbackRef = useRef(null);
  const onChatMessage   = useCallback((msg) => chatCallbackRef.current?.(msg), []);

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
    sendAction,
    sendChat,
    joinSeat,
    leaveSeat,
    isTournament,
    tournament,
    blindLevelEndsAt,
    eliminatedPlayers,
    tournamentEnded,
    latestEliminated,
  } = usePokerTable(tableId, { onChatMessage });

  const { messages, sendMessage } = useTableChat(sendChat, chatCallbackRef);

  const handleLeave = useCallback(() => {
    leaveSeat();
    navigate('/lobby');
  }, [leaveSeat, navigate]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>

      {/* ── Banner riconnessione ─────────────────────────────────────────── */}
      {reconnecting && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1200,
          background: 'linear-gradient(90deg, #5a3200, #8a5200)',
          borderBottom: '1px solid rgba(212,175,55,0.5)',
          padding: '8px 20px',
          display: 'flex', alignItems: 'center', gap: 10,
          fontFamily: 'Inter, sans-serif', fontSize: 12,
          color: '#F5F1E8', letterSpacing: '0.08em',
        }}>
          <span style={{ display: 'inline-block', animation: 'ridotto-spin 1s linear infinite' }}>⟳</span>
          Riconnessione in corso…
          <style>{`@keyframes ridotto-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ── Overlay connessione persa (tentativi esauriti) ───────────────── */}
      {!connected && !reconnecting && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(5,10,7,0.93)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{
            fontFamily: 'Playfair Display, serif', fontSize: 32,
            color: '#F5F1E8', fontStyle: 'italic', marginBottom: 12,
          }}>
            Connessione persa
          </div>
          <div style={{
            fontFamily: 'Inter, sans-serif', fontSize: 13,
            color: 'rgba(245,241,232,0.45)', marginBottom: 36, letterSpacing: '0.06em',
          }}>
            Impossibile raggiungere il server
          </div>
          <button
            onClick={() => navigate('/lobby')}
            style={{
              background: 'transparent', border: '1px solid rgba(212,175,55,0.4)',
              color: '#D4AF37', padding: '10px 28px',
              fontFamily: 'Inter, sans-serif', fontSize: 12,
              letterSpacing: '0.15em', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            TORNA ALLA LOBBY
          </button>
        </div>
      )}

      {/* ── Tavolo ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minHeight: 0 }}>
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
          messages={messages}
          sendAction={sendAction}
          sendMessage={sendMessage}
          joinSeat={joinSeat}
          leaveSeat={leaveSeat}
          onLeave={handleLeave}
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
