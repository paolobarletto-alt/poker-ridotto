import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoldButton } from './Shell';
import { usePokerTable } from '../hooks/usePokerTable';
import { useTableChat } from '../hooks/useTableChat_v2';
import BuyinDialog from './BuyinDialog';
import { useAuth } from '../context/AuthContext';

// ── Keyframes injected once ──────────────────────────────────────────────────
const _STYLES = `
@keyframes fadeInOut {
  0%   { opacity: 0; transform: translateY(12px); }
  12%  { opacity: 1; transform: translateY(0); }
  80%  { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes goldGlow {
  0%, 100% { text-shadow: 0 0 18px rgba(212,175,55,0.5); }
  50%       { text-shadow: 0 0 40px rgba(212,175,55,0.9), 0 0 80px rgba(212,175,55,0.4); }
}
`;
if (typeof document !== 'undefined' && !document.getElementById('ridotto-table-styles')) {
  const tag = document.createElement('style');
  tag.id = 'ridotto-table-styles';
  tag.textContent = _STYLES;
  document.head.appendChild(tag);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtCountdown(ms) {
  if (ms <= 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ── Tournament Panel ─────────────────────────────────────────────────────────

function TournamentPanel({ tournament, blindLevelEndsAt, seats, eliminatedPlayers, myUserId }) {
  const [collapsed, setCollapsed] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!tournament) return null;

  const schedule = tournament.blind_schedule ?? [];
  const levelIdx = tournament.current_blind_level - 1;
  const currentLevel = schedule[levelIdx] ?? null;
  const nextLevel    = schedule[levelIdx + 1] ?? null;

  const timeLeftMs = blindLevelEndsAt ? Math.max(0, blindLevelEndsAt - now) : 0;
  const levelDur   = currentLevel?.duration_seconds ?? 0;
  const progress   = levelDur > 0 ? timeLeftMs / (levelDur * 1000) : 0;
  const countdownColor = timeLeftMs < 60000 ? '#c0392b' : '#D4AF37';

  // Live standings: seats sorted by stack desc, excludendo null/folded/eliminated
  const activePlayers = seats
    .filter(s => s && s.status !== 'folded')
    .sort((a, b) => b.stack - a.stack);

  return (
    <div style={{
      position: 'absolute', top: 16, right: 16, width: 220, zIndex: 20,
      background: 'rgba(10,10,10,0.92)', border: '1px solid rgba(212,175,55,0.3)',
      backdropFilter: 'blur(8px)',
    }}>
      {/* Header */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          padding: '8px 12px', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: collapsed ? 'none' : '1px solid rgba(212,175,55,0.15)',
        }}
      >
        <span style={{
          fontFamily: 'Inter, sans-serif', fontSize: 9.5, fontWeight: 700,
          letterSpacing: '0.22em', color: '#D4AF37',
        }}>TORNEO</span>
        <span style={{ color: 'rgba(245,241,232,0.5)', fontSize: 11 }}>
          {collapsed ? '▼' : '▲'}
        </span>
      </div>

      {!collapsed && (
        <div style={{ padding: '10px 12px' }}>
          {/* A) Blind attuale */}
          {currentLevel && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, letterSpacing: '0.2em', color: 'rgba(245,241,232,0.4)', marginBottom: 3 }}>
                LIVELLO {tournament.current_blind_level}
              </div>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: '#D4AF37', fontWeight: 500, lineHeight: 1 }}>
                {currentLevel.small_blind} / {currentLevel.big_blind}
              </div>
              {nextLevel && (
                <div style={{ fontSize: 11, color: 'rgba(245,241,232,0.45)', marginTop: 3 }}>
                  → Lv{tournament.current_blind_level + 1} · {nextLevel.small_blind}/{nextLevel.big_blind}
                </div>
              )}
              {blindLevelEndsAt && (
                <div style={{ marginTop: 8 }}>
                  <div style={{
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                    color: countdownColor, marginBottom: 4,
                  }}>
                    cambio in {fmtCountdown(timeLeftMs)}
                  </div>
                  <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                    <div style={{
                      height: '100%', width: `${progress * 100}%`,
                      background: countdownColor, borderRadius: 2,
                      transition: 'width 1s linear',
                    }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Separator */}
          <div style={{ height: 1, background: 'rgba(212,175,55,0.15)', margin: '8px 0' }} />

          {/* C) Classifica live */}
          <div style={{ fontSize: 9, letterSpacing: '0.18em', color: 'rgba(245,241,232,0.4)', marginBottom: 6 }}>CLASSIFICA</div>
          {activePlayers.map((s, i) => (
            <div key={s.seat} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              marginBottom: 4,
              color: s.user_id === myUserId ? '#D4AF37' : 'rgba(245,241,232,0.85)',
            }}>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: s.user_id === myUserId ? 600 : 400 }}>
                {i + 1}° {s.username}{s.user_id === myUserId ? ' (Tu)' : ''}
              </span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10.5 }}>
                {(s.stack ?? 0).toLocaleString('it-IT')}
              </span>
            </div>
          ))}

          {/* D) Eliminati */}
          {eliminatedPlayers.length > 0 && (
            <>
              <div style={{ height: 1, background: 'rgba(212,175,55,0.1)', margin: '8px 0' }} />
              <div style={{ fontSize: 9, letterSpacing: '0.18em', color: 'rgba(245,241,232,0.3)', marginBottom: 5 }}>ELIMINATI</div>
              {[...eliminatedPlayers].reverse().map((e, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between',
                  opacity: 0.45, marginBottom: 3,
                }}>
                  <span style={{
                    fontFamily: 'Inter, sans-serif', fontSize: 11,
                    textDecoration: 'line-through', color: 'rgba(245,241,232,0.6)',
                  }}>
                    {e.position}° {e.username}
                  </span>
                  <span style={{ fontSize: 9.5, color: 'rgba(245,241,232,0.4)' }}>elim.</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Elimination Toast ────────────────────────────────────────────────────────

function EliminationToast({ eliminated }) {
  if (!eliminated) return null;
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
    }}>
      <div style={{
        background: 'rgba(0,0,0,0.7)',
        border: '1px solid rgba(212,175,55,0.25)',
        padding: '28px 40px', textAlign: 'center',
        animation: 'fadeInOut 3s ease forwards',
      }}>
        <div style={{
          fontFamily: 'Playfair Display, serif', fontSize: 28,
          color: '#F5F1E8', fontWeight: 500, marginBottom: 8,
        }}>{eliminated.username}</div>
        <div style={{
          fontFamily: 'Inter, sans-serif', fontSize: 16,
          color: '#D4AF37', fontWeight: 600, letterSpacing: '0.08em',
        }}>Eliminato · {eliminated.position}° posto</div>
      </div>
    </div>
  );
}

// ── Tournament End Overlay ───────────────────────────────────────────────────

function TournamentEndOverlay({ result, currentUsername }) {
  const navigate = useNavigate();
  const [canClick, setCanClick] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setCanClick(true), 2000);
    return () => clearTimeout(t);
  }, []);

  if (!result) return null;

  const isWinner  = result.winner_username === currentUsername;
  const myResult  = result.position_results?.find(r => r.username === currentUsername);
  const medals    = ['🥇', '🥈', '🥉'];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, sans-serif',
    }}>
      {isWinner ? (
        <>
          <div style={{
            fontFamily: 'Playfair Display, serif', fontSize: 48,
            color: '#D4AF37', fontWeight: 700, marginBottom: 8,
            animation: 'goldGlow 2s ease-in-out infinite',
          }}>Hai vinto! 🏆</div>
          <div style={{ fontSize: 16, color: 'rgba(245,241,232,0.65)', marginBottom: 32 }}>
            Congratulazioni!
          </div>
        </>
      ) : (
        <>
          <div style={{
            fontFamily: 'Playfair Display, serif', fontSize: 36,
            color: '#F5F1E8', fontWeight: 500, marginBottom: 8,
          }}>Torneo concluso</div>
          {myResult && (
            <div style={{ fontSize: 18, color: '#D4AF37', marginBottom: 32 }}>
              Hai chiuso al {myResult.position}° posto
            </div>
          )}
        </>
      )}

      {/* Classifica finale */}
      <div style={{
        width: 360, maxHeight: 260, overflowY: 'auto',
        border: '1px solid rgba(212,175,55,0.2)',
        background: 'rgba(10,10,10,0.8)',
        marginBottom: 32,
      }}>
        {result.position_results?.map((r) => (
          <div key={r.position} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 16px',
            borderBottom: '1px solid rgba(212,175,55,0.07)',
            color: r.username === currentUsername ? '#D4AF37' : 'rgba(245,241,232,0.85)',
          }}>
            <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>
              {medals[r.position - 1] ?? r.position}
            </span>
            <span style={{
              flex: 1, fontFamily: 'Playfair Display, serif', fontSize: 15,
              fontWeight: r.username === currentUsername ? 600 : 400,
            }}>
              {r.username}
            </span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'rgba(245,241,232,0.55)' }}>
              {(r.chips_at_end ?? 0).toLocaleString('it-IT')} chip
            </span>
          </div>
        ))}
      </div>

      <GoldButton
        size="lg"
        onClick={() => canClick && navigate('/lobby')}
        style={{ opacity: canClick ? 1 : 0.4, cursor: canClick ? 'pointer' : 'not-allowed' }}
      >
        Torna alla lobby
      </GoldButton>
    </div>
  );
}

// ── Main Table component ─────────────────────────────────────────────────────

export default function PokerTable({ tableId, cardBack = 'ridotto', onLeave }) {
  const { user } = useAuth();
  const {
    tableState, mySeat, myCards, sendAction, sendChat, joinSeat, leaveSeat,
    tableConfig,
    isTournament, tournament, blindLevelEndsAt, eliminatedPlayers, tournamentEnded, latestEliminated,
  } = usePokerTable(tableId);
  const { messages, sendMessage } = useTableChat(sendChat);

  const [pot, setPot] = useState(0);
  const [community, setCommunity] = useState([]);
  const [phase, setPhase] = useState('preflop');
  const [raiseAmt, setRaiseAmt] = useState(40);
  const [log, setLog] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [showBuyin, setShowBuyin] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const chatEndRef = useRef();

  useEffect(() => {
    if (tableState) {
      setPot(tableState.pot || 0);
      setCommunity(tableState.community || []);
      setPhase(tableState.phase || 'preflop');
      if (tableState.log && tableState.log.length) setLog(tableState.log.slice(0, 200).reverse());
    }
  }, [tableState]);

  useEffect(() => {
    if (messages && messages.length) {
      setLog(l => [...messages.map(m => ({ t: new Date(m.ts).toLocaleTimeString('it-IT'), txt: `${m.user}: ${m.text}` })), ...l]);
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleAction = (action, amount = 0) => {
    const time = new Date().toLocaleTimeString('it-IT');
    const txt = action.toUpperCase();
    setLog(l => [{ t: time, txt }, ...l]);
    if (sendAction) sendAction(action, amount);
  };

  const handleSendChat = () => { if (!chatInput) return; if (sendMessage) sendMessage(chatInput); setChatInput(''); };

  const seats = (tableState && tableState.seats) ? tableState.seats : Array.from({ length: 8 }).map(() => null);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 14, borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 10, color: '#888' }}>TAVOLO {tableState?.id ?? tableId}</div>
          <div style={{ fontSize: 16 }}>No-Limit Hold'em <span style={{ color: '#D4AF37' }}>{tableState?.stakes ?? '€0.50/€1'}</span></div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 12 }}>Mano <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{tableState?.handId ?? '-'}</span></div>
          <div style={{ fontSize: 12 }}>{(tableState?.seats || seats).filter(Boolean).length}/{tableState?.seats?.length ?? seats.length}</div>
          <GoldButton variant="ghost" size="sm" onClick={onLeave}>Abbandona ↩</GoldButton>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, position: 'relative', padding: 20 }}>
          <div style={{ position: 'relative', width: '100%', height: '100%', maxWidth: 980, margin: '0 auto' }}>
            <div style={{ position: 'absolute', inset: '10% 4%', borderRadius: '50%', background: 'green', border: '8px solid #3a2818' }}>
              <div style={{ position: 'absolute', top: '58%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#ddd' }}>PIATTO</div>
                <div style={{ fontSize: 24, color: '#D4AF37' }}>€{pot}</div>
              </div>

              <div style={{ position: 'absolute', top: '42%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', gap: 6 }}>
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i}>{community[i] ? <div style={{ width: 52, height: 74, background: '#fff' }}>{community[i]}</div> : <div style={{ width: 52, height: 74, border: '1px dashed rgba(212,175,55,0.1)' }} />}</div>
                ))}
              </div>
            </div>

            {seats.map((s, idx) => (
              <div key={idx} style={{ position: 'absolute', left: `${10 + idx * 11}%`, top: idx < 4 ? '15%' : '85%', transform: 'translate(-50%,-50%)', width: 150, textAlign: 'center' }}>
                {s ? (
                  <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.6)', borderRadius: 8 }}>
                    <div style={{ color: '#fff', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.username}</div>
                    <div style={{ color: '#ddd', fontFamily: 'JetBrains Mono, monospace' }}>€{s.stack}</div>
                  </div>
                ) : (
                  <div role="button" tabIndex={0} onClick={() => { setSelectedSeat(idx); setShowBuyin(true); }} onKeyDown={(e) => { if (e.key === 'Enter') { setSelectedSeat(idx); setShowBuyin(true); } }} style={{ width: 62, height: 62, borderRadius: '50%', border: '1px dashed rgba(212,175,55,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', margin: '0 auto' }}>VUOTO</div>
                )}
              </div>
            ))}

            <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <GoldButton variant="ghost" size="sm" onClick={() => handleAction('fold')}>Fold</GoldButton>
              <GoldButton variant="ghost" size="sm" onClick={() => handleAction('call', tableState?.to_call ?? 0)}>Call €{tableState?.to_call ?? 0}</GoldButton>
              <GoldButton size="sm" onClick={() => handleAction('raise', raiseAmt)}>Raise €{raiseAmt}</GoldButton>
              <input type="range" min={tableState?.min_raise ?? 40} max={mySeat?.stack ?? 1000} value={raiseAmt} onChange={e => setRaiseAmt(+e.target.value)} style={{ width: 140 }} />
              <button onClick={() => setRaiseAmt(Math.min(mySeat?.stack ?? 1000, 1250))}>ALL</button>
            </div>

            {/* Tournament panel */}
            {isTournament && (
              <TournamentPanel
                tournament={tournament}
                blindLevelEndsAt={blindLevelEndsAt}
                seats={seats}
                eliminatedPlayers={eliminatedPlayers}
                myUserId={user?.id}
              />
            )}

            {/* Elimination toast */}
            <EliminationToast eliminated={latestEliminated} />
          </div>
        </div>

        <div style={{ width: 300, borderLeft: '1px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 12, borderBottom: '1px solid rgba(0,0,0,0.04)' }}>STORICO</div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 12, background: 'rgba(0,0,0,0.04)', color: '#eee' }}>
            {log.map((l, i) => (
              <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#aaa' }}>{l.t}</div>
                <div>{l.txt || l}</div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div style={{ padding: 10, borderTop: '1px solid rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSendChat(); }} placeholder="Scrivi..." style={{ flex: 1, padding: 8 }} />
              <GoldButton size="sm" onClick={handleSendChat}>Invia</GoldButton>
            </div>
          </div>
        </div>
      </div>

      {showBuyin && (
        <BuyinDialog
          isOpen={showBuyin}
          seat={selectedSeat}
          tableConfig={tableConfig}
          userBalance={user?.chips_balance ?? 0}
          onConfirm={(seat, amount) => { if (joinSeat) joinSeat(seat, amount); setShowBuyin(false); setSelectedSeat(null); }}
          onClose={() => { setShowBuyin(false); setSelectedSeat(null); }}
        />
      )}

      {/* Tournament end overlay */}
      {tournamentEnded && (
        <TournamentEndOverlay
          result={tournamentEnded}
          currentUsername={user?.username}
        />
      )}
    </div>
  );
}
