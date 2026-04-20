import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoldButton } from './Shell';
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

  const activePlayers = seats
    .filter(s => s && s.status !== 'folded')
    .sort((a, b) => b.stack - a.stack);

  return (
    <div style={{
      position: 'absolute', top: 16, right: 16, width: 220, zIndex: 20,
      background: 'rgba(10,10,10,0.92)', border: '1px solid rgba(212,175,55,0.3)',
      backdropFilter: 'blur(8px)',
    }}>
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

          <div style={{ height: 1, background: 'rgba(212,175,55,0.15)', margin: '8px 0' }} />

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

// ─────────────────────────────────────────────────────────────────────────────
// Costanti di layout
// ─────────────────────────────────────────────────────────────────────────────

const SEAT_POSITIONS = [
  { left: '50%', top: '93%' },   // 0 – bottom center  (hero default)
  { left: '20%', top: '82%' },   // 1 – bottom left
  { left: '4%',  top: '57%' },   // 2 – left
  { left: '16%', top: '18%' },   // 3 – top left
  { left: '38%', top: '5%'  },   // 4 – top center-left
  { left: '62%', top: '5%'  },   // 5 – top center-right
  { left: '84%', top: '18%' },   // 6 – top right
  { left: '96%', top: '57%' },   // 7 – right
  { left: '80%', top: '82%' },   // 8 – bottom right
];

// Offset delle chips rispetto al nameplate (verso il centro del tavolo)
const BET_OFFSETS = [
  { bottom: '110%', left: '50%', transform: 'translateX(-50%)' },  // 0
  { top: '-30px',   right: '-10px' },                               // 1
  { top: '50%',     right: '-68px', transform: 'translateY(-50%)' },// 2
  { bottom: '-30px', right: '-10px' },                              // 3
  { bottom: '-30px', left: '50%', transform: 'translateX(-50%)' }, // 4
  { bottom: '-30px', left: '50%', transform: 'translateX(-50%)' }, // 5
  { bottom: '-30px', left: '-10px' },                               // 6
  { top: '50%',     left: '-68px', transform: 'translateY(-50%)' },// 7
  { top: '-30px',   left: '-10px' },                                // 8
];

const MAX_SEATS = 9;

// ─────────────────────────────────────────────────────────────────────────────
// Card backs
// ─────────────────────────────────────────────────────────────────────────────

export const CARD_BACKS = {
  classico: {
    render: () => (
      <div style={{ width: '100%', height: '100%', background: 'repeating-linear-gradient(45deg,#7a1a1a 0 4px,#5a0f0f 4px 8px)', border: '3px solid #fff', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '60%', height: '60%', border: '1.5px solid #D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Playfair Display, serif', color: '#D4AF37', fontSize: 20, fontStyle: 'italic' }}>R</div>
      </div>
    ),
  },
  ridotto: {
    render: () => (
      <div style={{ width: '100%', height: '100%', background: 'radial-gradient(ellipse at center,#1a3a25,#0a1810)', border: '2px solid #D4AF37', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 4, border: '0.5px solid rgba(212,175,55,0.4)' }} />
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, color: '#D4AF37', fontStyle: 'italic' }}>♠</div>
      </div>
    ),
  },
  damier: {
    render: () => (
      <div style={{ width: '100%', height: '100%', backgroundImage: 'linear-gradient(45deg,#0a1810 25%,transparent 25%),linear-gradient(-45deg,#0a1810 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#0a1810 75%),linear-gradient(-45deg,transparent 75%,#0a1810 75%)', backgroundSize: '10px 10px', backgroundColor: '#D4AF37', backgroundPosition: '0 0,0 5px,5px -5px,-5px 0', border: '2px solid #fff', boxSizing: 'border-box' }} />
    ),
  },
  minimale: {
    render: () => (
      <div style={{ width: '100%', height: '100%', background: '#0a0a0a', border: '1.5px solid #D4AF37', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 3, height: 3, background: '#D4AF37', borderRadius: '50%' }} />
      </div>
    ),
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────────────────────────────────────

const SUIT_COLORS = { '♠': '#0a0a0a', '♥': '#c0392b', '♦': '#c0392b', '♣': '#0a0a0a' };

export function Card({ card, size = 'md', cardBack = 'ridotto' }) {
  const sizes = {
    sm: { w: 36, h: 52, rank: 13, suit: 14 },
    md: { w: 50, h: 72, rank: 19, suit: 21 },
    lg: { w: 62, h: 90, rank: 25, suit: 28 },
  };
  const s = sizes[size] ?? sizes.md;

  if (!card || card === 'back') {
    const back = CARD_BACKS[cardBack] ?? CARD_BACKS.ridotto;
    return (
      <div style={{ width: s.w, height: s.h, borderRadius: 5, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
        {back.render()}
      </div>
    );
  }

  const rank  = card.slice(0, -1);
  const suit  = card.slice(-1);
  const color = SUIT_COLORS[suit] ?? '#0a0a0a';

  return (
    <div style={{ width: s.w, height: s.h, background: '#fafafa', borderRadius: 5, padding: '4px 5px', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', position: 'relative', fontFamily: 'Playfair Display, serif' }}>
      <div style={{ fontSize: s.rank, fontWeight: 600, color, lineHeight: 0.9 }}>{rank}</div>
      <div style={{ fontSize: s.rank * 0.78, color, lineHeight: 0.9, marginTop: 1 }}>{suit}</div>
      <div style={{ position: 'absolute', bottom: 4, right: 5, fontSize: s.suit, color, lineHeight: 1 }}>{suit}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ChipStack
// ─────────────────────────────────────────────────────────────────────────────

function ChipStack({ amount }) {
  if (!amount) return null;
  const count = Math.min(5, Math.ceil(amount / 20));
  return (
    <div style={{ position: 'relative', width: 20, height: 14 + count * 2 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ position: 'absolute', bottom: i * 2, left: 0, width: 20, height: 6, borderRadius: 3, background: 'radial-gradient(ellipse at 30% 30%,#E8C252,#8a6d1e)', border: '0.5px solid rgba(0,0,0,0.4)' }} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ActionTimerBar
// ─────────────────────────────────────────────────────────────────────────────

function ActionTimerBar({ timerSeconds, actingKey }) {
  const barRef = useRef(null);

  // Re-esegue ogni volta che il turno passa a un nuovo giocatore
  useEffect(() => {
    const el = barRef.current;
    if (!el || !timerSeconds || timerSeconds <= 0) return;

    el.style.transition = 'none';
    el.style.width = '100%';

    let raf1, raf2;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        el.style.transition = `width ${timerSeconds}s linear`;
        el.style.width = '0%';
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actingKey]);

  const color = timerSeconds <= 8 ? '#c0392b' : '#D4AF37';

  return (
    <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
      <div
        ref={barRef}
        style={{ height: '100%', width: '100%', background: color, transition: 'background 0.4s' }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Seat
// ─────────────────────────────────────────────────────────────────────────────

function Seat({
  seatIndex, seat, pos, betOffset,
  isHero, myCards,
  isActing, timerSeconds, actingKey,
  phase, cardBack,
  showdownResult,
  onEmptyClick,
}) {
  const isWinner  = showdownResult?.won === true;
  const isFolded  = seat?.status === 'folded';
  const hasCards  = !isFolded && phase !== 'waiting';
  const revealCards = showdownResult?.cards;

  // ── Posto vuoto ──────────────────────────────────────────────────────────
  if (!seat) {
    return (
      <div
        role="button" tabIndex={0}
        onClick={onEmptyClick}
        onKeyDown={(e) => e.key === 'Enter' && onEmptyClick()}
        style={{ position: 'absolute', ...pos, width: 130, transform: 'translate(-50%,-50%)', textAlign: 'center', cursor: 'pointer' }}
        title={`Siediti al posto ${seatIndex + 1}`}
      >
        <div
          style={{ width: 62, height: 62, borderRadius: '50%', border: '1px dashed rgba(212,175,55,0.25)', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(212,175,55,0.35)', fontSize: 9.5, letterSpacing: '0.2em', fontFamily: 'Inter, sans-serif', transition: 'border-color 0.2s, color 0.2s' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.6)'; e.currentTarget.style.color = 'rgba(212,175,55,0.7)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.25)'; e.currentTarget.style.color = 'rgba(212,175,55,0.35)'; }}
        >
          VUOTO
        </div>
      </div>
    );
  }

  // Carte da visualizzare
  const displayCards = (() => {
    if (isHero)       return myCards?.length ? myCards : (hasCards ? ['back', 'back'] : []);
    if (revealCards)  return revealCards;
    if (hasCards)     return ['back', 'back'];
    return [];
  })();

  return (
    <div style={{
      position: 'absolute', ...pos, width: 150, transform: 'translate(-50%,-50%)',
      textAlign: 'center', opacity: isFolded ? 0.38 : 1, transition: 'opacity 0.3s',
      zIndex: isActing ? 2 : 1,
    }}>

      {/* ── Carte ──────────────────────────────────────────────────────── */}
      {displayCards.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginBottom: 6, transform: isHero ? 'scale(1.1)' : 'none', transformOrigin: 'bottom center' }}>
          {displayCards.map((c, i) => (
            <div key={i} style={{ transform: `rotate(${i === 0 ? -4 : 4}deg)`, transformOrigin: 'bottom center' }}>
              <Card card={c} size={isHero ? 'md' : 'sm'} cardBack={cardBack} />
            </div>
          ))}
        </div>
      )}

      {/* ── Nameplate ──────────────────────────────────────────────────── */}
      <div style={{
        background: isActing ? 'linear-gradient(180deg,rgba(212,175,55,0.22),rgba(212,175,55,0.07))' : 'rgba(0,0,0,0.68)',
        border: isActing ? '1px solid #D4AF37' : '1px solid rgba(212,175,55,0.14)',
        backdropFilter: 'blur(6px)',
        transition: 'border-color 0.2s, background 0.2s',
        overflow: 'hidden',
        boxShadow: isWinner
          ? undefined
          : isActing ? '0 0 18px rgba(212,175,55,0.35)' : 'none',
        ...(isWinner ? { animation: 'ridotto-win-pulse 1.2s ease-in-out infinite' } : {}),
      }}>
        {/* Timer bar */}
        {isActing && (
          <ActionTimerBar timerSeconds={timerSeconds} actingKey={actingKey} />
        )}

        <div style={{ padding: '7px 10px 9px' }}>
          {/* Nome + badge "TU" */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 2 }}>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 500, color: '#F5F1E8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 88 }}>
              {seat.username}
            </div>
            {isHero && (
              <div style={{ fontSize: 7.5, letterSpacing: '0.15em', color: '#D4AF37', background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.35)', padding: '1px 4px', flexShrink: 0 }}>
                TU
              </div>
            )}
          </div>

          {/* Stack */}
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: isActing ? '#D4AF37' : 'rgba(245,241,232,0.7)' }}>
            {seat.stack.toLocaleString('it-IT')}
          </div>

          {/* Descrizione mano (showdown) */}
          {showdownResult?.hand_description && (
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 9.5, fontStyle: 'italic', color: '#D4AF37', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {showdownResult.hand_description}
            </div>
          )}
        </div>
      </div>

      {/* ── Badge dealer / SB / BB ─────────────────────────────────────── */}
      {seat.is_dealer && (
        <div style={{ position: 'absolute', top: displayCards.length ? 38 : -6, right: -8, width: 22, height: 22, borderRadius: '50%', background: '#fafafa', color: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Playfair Display, serif', fontSize: 11, fontWeight: 700, border: '1px solid #D4AF37', boxShadow: '0 2px 6px rgba(0,0,0,0.4)', zIndex: 3 }}>D</div>
      )}
      {!seat.is_dealer && seat.is_sb && (
        <div style={{ position: 'absolute', top: displayCards.length ? 38 : -6, right: -8, width: 22, height: 22, borderRadius: '50%', background: 'rgba(28,75,200,0.88)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8.5, fontFamily: 'Inter, sans-serif', fontWeight: 700, border: '1px solid rgba(90,130,255,0.5)', zIndex: 3 }}>SB</div>
      )}
      {!seat.is_dealer && seat.is_bb && (
        <div style={{ position: 'absolute', top: displayCards.length ? 38 : -6, right: -8, width: 22, height: 22, borderRadius: '50%', background: 'rgba(160,28,28,0.88)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8.5, fontFamily: 'Inter, sans-serif', fontWeight: 700, border: '1px solid rgba(255,90,90,0.5)', zIndex: 3 }}>BB</div>
      )}

      {/* ── Ultima azione ──────────────────────────────────────────────── */}
      {seat.last_action && !isFolded && (
        <div style={{ marginTop: 3, fontSize: 9, letterSpacing: '0.18em', fontWeight: 600, color: '#D4AF37', fontFamily: 'Inter, sans-serif' }}>
          {seat.last_action.toUpperCase()}
        </div>
      )}
      {isFolded && (
        <div style={{ marginTop: 3, fontSize: 9, letterSpacing: '0.18em', fontWeight: 600, color: 'rgba(245,241,232,0.4)', fontFamily: 'Inter, sans-serif' }}>FOLD</div>
      )}

      {/* ── Chips puntata ──────────────────────────────────────────────── */}
      {seat.bet_in_round > 0 && !isFolded && (
        <div style={{ position: 'absolute', ...betOffset, display: 'flex', alignItems: 'center', gap: 5, zIndex: 4 }}>
          <ChipStack amount={seat.bet_in_round} />
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#D4AF37', whiteSpace: 'nowrap' }}>
            {seat.bet_in_round.toLocaleString('it-IT')}
          </span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PokerTable — componente principale
// ─────────────────────────────────────────────────────────────────────────────

export default function PokerTable({
  tableId,
  tableState,
  tableConfig,
  myCards           = [],
  mySeat            = null,
  connected         = false,
  showdownResults   = null,
  handEndResult     = null,
  waitingForPlayers = null,
  gameStartingIn    = null,
  lastError         = null,
  handLog           = [],
  messages          = [],
  sendAction,
  sendMessage,
  joinSeat,
  leaveSeat,
  onLeave,
  cardBack          = 'ridotto',
  // ── Tournament ─────────────────────────────────────────────────────────────
  isTournament      = false,
  tournament        = null,
  blindLevelEndsAt  = null,
  eliminatedPlayers = [],
  tournamentEnded   = null,
  latestEliminated  = null,
}) {
  // ── Stato locale UI ───────────────────────────────────────────────────────
  const [sidebarTab,   setSidebarTab]   = useState('mano');
  const [chatInput,    setChatInput]    = useState('');
  const { user } = useAuth();
  const [showBuyin,    setShowBuyin]    = useState(false);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [raiseAmt,     setRaiseAmt]     = useState(20);
  const chatEndRef = useRef(null);

  // ── Derivazioni ───────────────────────────────────────────────────────────
  const seats      = tableState?.seats      ?? Array.from({ length: MAX_SEATS }, () => null);
  const pot        = tableState?.pot        ?? 0;
  const community  = tableState?.community  ?? [];
  const phase      = tableState?.phase      ?? 'waiting';
  const actingSeat = tableState?.acting_seat ?? null;
  const timerSecs  = tableState?.timer_seconds ?? 0;
  const handNumber = tableState?.hand_number   ?? 0;

  const mySeatData = mySeat !== null ? seats[mySeat] : null;
  const isMyTurn   = actingSeat === mySeat && mySeat !== null && phase !== 'waiting';

  const allBets    = seats.filter(Boolean).map((s) => s.bet_in_round ?? 0);
  const maxBet     = allBets.length ? Math.max(...allBets) : 0;
  const myBet      = mySeatData?.bet_in_round ?? 0;
  const callAmount = Math.max(0, maxBet - myBet);
  const canCheck   = callAmount === 0;
  const myStack    = mySeatData?.stack ?? 0;
  const bigBlind   = tableConfig?.big_blind ?? 10;
  const minRaise   = Math.max(callAmount + bigBlind, bigBlind);

  // Acting key: cambia quando tocca a un nuovo giocatore → resetta la timer bar
  const actingKey = `${actingSeat}-${handNumber}`;

  // ── Reset raise amount al proprio turno ───────────────────────────────────
  useEffect(() => {
    if (isMyTurn && myStack > 0) {
      setRaiseAmt(Math.max(minRaise, Math.min(minRaise * 3, myStack)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyTurn, actingSeat]);

  const clampedRaise = Math.max(minRaise, Math.min(raiseAmt, myStack));

  // ── Auto-scroll chat ──────────────────────────────────────────────────────
  useEffect(() => {
    if (sidebarTab === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, sidebarTab]);

  // ── Raise presets ─────────────────────────────────────────────────────────
  const potSize = pot + callAmount * 2;
  const presets = [
    { label: '2BB',  value: bigBlind * 2  + callAmount },
    { label: '3BB',  value: bigBlind * 3  + callAmount },
    { label: 'Pot',  value: potSize },
    { label: 'ALL',  value: myStack },
  ].map((p) => ({ ...p, value: Math.max(minRaise, Math.min(p.value, myStack)) }));

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAction = useCallback((action, amount = 0) => {
    sendAction?.(action, amount);
  }, [sendAction]);

  const handleSendChat = useCallback(() => {
    const txt = chatInput.trim();
    if (!txt) return;
    sendMessage?.(txt);
    setChatInput('');
  }, [chatInput, sendMessage]);

  const handleSeatClick = useCallback((idx) => {
    if (mySeat !== null) return; // già seduto
    setSelectedSeat(idx);
    setShowBuyin(true);
  }, [mySeat]);

  // ── Info header ───────────────────────────────────────────────────────────
  const blindsLabel  = tableConfig ? `€${tableConfig.small_blind}/${tableConfig.big_blind}` : '–/–';
  const tableName    = tableConfig?.name ?? `Tavolo #${tableId ?? ''}`;
  const seatedCount  = seats.filter(Boolean).length;
  const totalSeats   = tableConfig?.max_seats ?? MAX_SEATS;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'radial-gradient(ellipse at center,#0a1810 0%,#050a07 100%)' }}>

      {/* ── Keyframes globali ───────────────────────────────────────────── */}
      <style>{`
        @keyframes ridotto-win-pulse {
          0%,100% { box-shadow: 0 0 22px rgba(212,175,55,0.55), 0 0 44px rgba(212,175,55,0.22); }
          50%      { box-shadow: 0 0 42px rgba(212,175,55,0.92), 0 0 80px rgba(212,175,55,0.44); }
        }
      `}</style>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid rgba(212,175,55,0.1)', background: 'rgba(0,0,0,0.45)', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '0.22em', color: 'rgba(245,241,232,0.4)', fontFamily: 'Inter, sans-serif' }}>
            {tableName.toUpperCase()}
          </div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 17, color: '#F5F1E8', marginTop: 2 }}>
            No-Limit Hold'em <span style={{ color: '#D4AF37', fontStyle: 'italic' }}>— {blindsLabel}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'rgba(245,241,232,0.6)', fontFamily: 'Inter, sans-serif' }}>
            <span style={{ color: 'rgba(245,241,232,0.35)' }}>Mano </span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>#{handNumber.toLocaleString('it-IT')}</span>
          </span>
          <span style={{ fontSize: 11, color: 'rgba(245,241,232,0.6)', fontFamily: 'Inter, sans-serif' }}>
            <span style={{ color: 'rgba(245,241,232,0.35)' }}>Seduti </span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{seatedCount}/{totalSeats}</span>
          </span>
          <div
            title={connected ? 'Connesso' : 'Disconnesso'}
            style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#28c840' : '#ff5f57', boxShadow: connected ? '0 0 6px rgba(40,200,64,0.55)' : 'none', transition: 'background 0.4s' }}
          />
          <GoldButton variant="ghost" size="sm" onClick={onLeave}>Abbandona ↩</GoldButton>
        </div>
      </div>

      {/* ── Corpo ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* ── Area tavolo ───────────────────────────────────────────────── */}
        <div style={{ flex: 1, position: 'relative', padding: '14px 18px 82px' }}>
          <div style={{ position: 'relative', width: '100%', height: '100%', maxWidth: 900, margin: '0 auto' }}>

            {/* Feltro */}
            <div style={{ position: 'absolute', inset: '8% 3%', background: 'radial-gradient(ellipse at center,#1a4a2e 0%,#0a2418 65%,#05140c 100%)', borderRadius: '50%', border: '8px solid #2a1e10', boxShadow: 'inset 0 0 50px rgba(0,0,0,0.55),0 20px 60px rgba(0,0,0,0.55)' }}>
              <div style={{ position: 'absolute', inset: 14, borderRadius: '50%', border: '1px solid rgba(212,175,55,0.09)' }} />
              <div style={{ position: 'absolute', top: '27%', left: '50%', transform: 'translateX(-50%)', fontFamily: 'Playfair Display, serif', fontSize: 24, color: 'rgba(212,175,55,0.1)', fontStyle: 'italic', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Ridotto
              </div>

              {/* Centro: Piatto o attesa giocatori */}
              <div style={{ position: 'absolute', top: '63%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', minWidth: 130 }}>
                {waitingForPlayers != null ? (
                  <>
                    <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 15, color: 'rgba(245,241,232,0.65)', fontStyle: 'italic', marginBottom: 5 }}>
                      In attesa di giocatori
                    </div>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'rgba(245,241,232,0.38)', letterSpacing: '0.05em' }}>
                      Ancora {waitingForPlayers} {waitingForPlayers === 1 ? 'giocatore' : 'giocatori'} per iniziare
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 8, letterSpacing: '0.25em', color: 'rgba(245,241,232,0.42)', fontFamily: 'Inter, sans-serif', marginBottom: 3 }}>PIATTO</div>
                    <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: '#D4AF37', fontWeight: 500 }}>
                      €{pot.toLocaleString('it-IT')}
                    </div>
                  </>
                )}
              </div>

              {/* Carte comuni */}
              <div style={{ position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%,-50%)', display: 'flex', gap: 5 }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} style={{ transition: 'opacity 0.35s,transform 0.35s', opacity: community[i] ? 1 : 0, transform: community[i] ? 'translateY(0)' : 'translateY(-8px)' }}>
                    {community[i]
                      ? <Card card={community[i]} size="md" cardBack={cardBack} />
                      : <div style={{ width: 50, height: 72, border: '1px dashed rgba(212,175,55,0.07)', borderRadius: 5 }} />
                    }
                  </div>
                ))}
              </div>
            </div>

            {/* Seats */}
            {Array.from({ length: MAX_SEATS }).map((_, idx) => (
              <Seat
                key={idx}
                seatIndex={idx}
                seat={seats[idx]}
                pos={SEAT_POSITIONS[idx]}
                betOffset={BET_OFFSETS[idx]}
                isHero={mySeat === idx}
                myCards={mySeat === idx ? myCards : []}
                isActing={actingSeat === idx}
                timerSeconds={timerSecs}
                actingKey={actingKey}
                phase={phase}
                cardBack={cardBack}
                showdownResult={showdownResults?.find((r) => r.seat === idx) ?? null}
                onEmptyClick={() => handleSeatClick(idx)}
              />
            ))}

            {/* Tournament panel */}
            {isTournament && (
              <TournamentPanel
                tournament={tournament}
                blindLevelEndsAt={blindLevelEndsAt}
                seats={seats}
                eliminatedPlayers={eliminatedPlayers}
                myUserId={null}
              />
            )}

            {/* Elimination toast */}
            <EliminationToast eliminated={latestEliminated} />
          </div>

          {/* ── Action bar ──────────────────────────────────────────────── */}
          <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, minWidth: 460 }}>

            {/* Toast errore */}
            {lastError && (
              <div style={{ width: '100%', marginBottom: 5, background: 'rgba(140,18,18,0.88)', border: '1px solid rgba(200,40,40,0.5)', padding: '6px 14px', fontFamily: 'Inter, sans-serif', fontSize: 11.5, color: '#ffaaaa', letterSpacing: '0.04em' }}>
                ⚠ {lastError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(0,0,0,0.75)', padding: '10px 14px', border: '1px solid rgba(212,175,55,0.18)', backdropFilter: 'blur(12px)' }}>
              {mySeat !== null ? (
                <>
                  {/* Fold */}
                  <ActionBtn disabled={!isMyTurn} variant="ghost" onClick={() => handleAction('fold')}>Fold</ActionBtn>

                  {/* Check / Call */}
                  {canCheck
                    ? <ActionBtn disabled={!isMyTurn} variant="ghost" onClick={() => handleAction('check')}>Check</ActionBtn>
                    : <ActionBtn disabled={!isMyTurn} variant="ghost" onClick={() => handleAction('call', callAmount)}>
                        Call €{callAmount.toLocaleString('it-IT')}
                      </ActionBtn>
                  }

                  {/* Raise */}
                  <ActionBtn disabled={!isMyTurn || clampedRaise >= myStack} onClick={() => handleAction('raise', clampedRaise)}>
                    Raise €{clampedRaise.toLocaleString('it-IT')}
                  </ActionBtn>

                  {/* All-in */}
                  <ActionBtn disabled={!isMyTurn} onClick={() => handleAction('allin', myStack)} style={{ background: isMyTurn ? 'rgba(160,24,24,0.75)' : undefined }}>
                    All-in
                  </ActionBtn>

                  {/* Slider + presets */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="range" min={minRaise} max={myStack > minRaise ? myStack : minRaise + 1}
                        value={clampedRaise}
                        onChange={(e) => setRaiseAmt(+e.target.value)}
                        disabled={!isMyTurn}
                        style={{ width: 95, accentColor: '#D4AF37', opacity: isMyTurn ? 1 : 0.4 }}
                      />
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#D4AF37', minWidth: 40 }}>
                        {clampedRaise.toLocaleString('it-IT')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {presets.map(({ label, value }) => (
                        <button
                          key={label}
                          onClick={() => setRaiseAmt(value)}
                          disabled={!isMyTurn}
                          style={{
                            background: clampedRaise === value ? 'rgba(212,175,55,0.18)' : 'transparent',
                            border: `1px solid ${clampedRaise === value ? 'rgba(212,175,55,0.55)' : 'rgba(212,175,55,0.2)'}`,
                            color: clampedRaise === value ? '#D4AF37' : 'rgba(245,241,232,0.6)',
                            padding: '2px 7px', fontSize: 9, fontFamily: 'Inter, sans-serif',
                            cursor: isMyTurn ? 'pointer' : 'default',
                            opacity: isMyTurn ? 1 : 0.38, letterSpacing: '0.06em',
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Lascia */}
                  <button
                    onClick={() => leaveSeat?.()}
                    title="Lascia il posto"
                    style={{ background: 'transparent', border: 'none', color: 'rgba(245,241,232,0.28)', fontSize: 10, fontFamily: 'Inter, sans-serif', cursor: 'pointer', marginLeft: 6, padding: '3px 5px', letterSpacing: '0.06em' }}
                  >
                    ↑ alzati
                  </button>
                </>
              ) : (
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'rgba(245,241,232,0.4)', padding: '4px 8px', letterSpacing: '0.08em' }}>
                  Clicca su un posto vuoto per sederti
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Sidebar destra ────────────────────────────────────────────── */}
        <div style={{ width: 262, flexShrink: 0, borderLeft: '1px solid rgba(212,175,55,0.1)', background: 'rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column' }}>

          {/* Tab toggle */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(212,175,55,0.1)', flexShrink: 0 }}>
            {['mano', 'chat'].map((tab) => {
              const isActive = sidebarTab === tab;
              const unread   = tab === 'chat' && !isActive && messages.length > 0;
              return (
                <button
                  key={tab}
                  onClick={() => setSidebarTab(tab)}
                  style={{
                    flex: 1, padding: '11px 0', background: 'transparent', border: 'none',
                    borderBottom: isActive ? '2px solid #D4AF37' : '2px solid transparent',
                    color: isActive ? '#D4AF37' : 'rgba(245,241,232,0.38)',
                    fontSize: 9, letterSpacing: '0.22em', fontFamily: 'Inter, sans-serif',
                    fontWeight: isActive ? 600 : 400, cursor: 'pointer',
                    textTransform: 'uppercase', transition: 'color 0.15s',
                  }}
                >
                  {tab === 'mano' ? 'STORICO MANO' : 'CHAT'}
                  {unread && (
                    <span style={{ marginLeft: 5, background: '#D4AF37', color: '#0a0a0a', borderRadius: 8, padding: '1px 5px', fontSize: 7.5, fontWeight: 700 }}>
                      {messages.length > 9 ? '9+' : messages.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Contenuto lista */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px', minHeight: 0 }}>
            {sidebarTab === 'mano' ? (
              handLog.length === 0
                ? <div style={{ fontSize: 11, color: 'rgba(245,241,232,0.28)', textAlign: 'center', marginTop: 22, fontStyle: 'italic', fontFamily: 'Playfair Display, serif' }}>In attesa della prossima mano…</div>
                : handLog.map((entry, i) => (
                    <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(245,241,232,0.04)', fontSize: 11, color: 'rgba(245,241,232,0.8)', lineHeight: 1.4 }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5, color: 'rgba(245,241,232,0.32)', marginRight: 6 }}>{entry.t}</span>
                      {entry.txt}
                    </div>
                  ))
            ) : (
              <>
                {messages.length === 0 && (
                  <div style={{ fontSize: 11, color: 'rgba(245,241,232,0.28)', textAlign: 'center', marginTop: 22, fontStyle: 'italic', fontFamily: 'Playfair Display, serif' }}>Nessun messaggio ancora…</div>
                )}
                {messages.map((msg) => (
                  <div key={msg.id} style={{ padding: '5px 0', borderBottom: '1px solid rgba(245,241,232,0.04)', fontSize: 11.5, lineHeight: 1.45 }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'rgba(245,241,232,0.28)', marginRight: 4 }}>
                      {msg.ts instanceof Date ? msg.ts.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                    <span style={{ color: msg.isMe ? '#D4AF37' : 'rgba(245,241,232,0.52)', fontWeight: msg.isMe ? 600 : 400, fontFamily: 'Inter, sans-serif', marginRight: 4 }}>
                      {msg.from}:
                    </span>
                    <span style={{ color: msg.isMe ? '#F5F1E8' : 'rgba(245,241,232,0.82)' }}>
                      {msg.message}
                    </span>
                    {msg._optimistic && (
                      <span style={{ fontSize: 9, color: 'rgba(245,241,232,0.22)', marginLeft: 4 }}>⋯</span>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </>
            )}
          </div>

          {/* Input chat */}
          {sidebarTab === 'chat' && (
            <div style={{ padding: '9px 14px', borderTop: '1px solid rgba(212,175,55,0.1)', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 5 }}>
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value.slice(0, 200))}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendChat(); }}
                  placeholder="Scrivi un messaggio…"
                  maxLength={200}
                  style={{ flex: 1, padding: '7px 9px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(212,175,55,0.17)', color: '#F5F1E8', fontFamily: 'Inter, sans-serif', fontSize: 12, outline: 'none' }}
                />
                <button
                  onClick={handleSendChat}
                  disabled={!chatInput.trim()}
                  style={{ background: chatInput.trim() ? 'rgba(212,175,55,0.14)' : 'transparent', border: '1px solid rgba(212,175,55,0.28)', color: chatInput.trim() ? '#D4AF37' : 'rgba(212,175,55,0.28)', padding: '7px 10px', fontSize: 14, cursor: chatInput.trim() ? 'pointer' : 'default', transition: 'all 0.15s' }}
                >
                  →
                </button>
              </div>
              <div style={{ fontSize: 8.5, color: 'rgba(245,241,232,0.18)', marginTop: 3, textAlign: 'right', fontFamily: 'Inter, sans-serif' }}>
                {chatInput.length}/200
              </div>
            </div>
          )}

          {/* Footer stato */}
          <div style={{ padding: '9px 14px', borderTop: '1px solid rgba(212,175,55,0.07)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9.5, color: 'rgba(245,241,232,0.4)', fontFamily: 'Inter, sans-serif' }}>
              Fase: <span style={{ color: '#D4AF37', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{phase}</span>
            </span>
            {actingSeat !== null && timerSecs > 0 && (
              <span style={{ fontSize: 10, color: timerSecs <= 8 ? '#c0392b' : 'rgba(245,241,232,0.4)', fontFamily: 'JetBrains Mono, monospace', transition: 'color 0.3s' }}>
                {timerSecs}s
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── BuyinDialog ─────────────────────────────────────────────────── */}
      {showBuyin && selectedSeat !== null && (
        <BuyinDialog
          isOpen={true}
          seat={selectedSeat}
          tableConfig={tableConfig}
          userBalance={user?.chips_balance ?? 0}
          onConfirm={(seat, amount) => { joinSeat?.(seat, amount); setShowBuyin(false); setSelectedSeat(null); }}
          onClose={() => { setShowBuyin(false); setSelectedSeat(null); }}
        />
      )}

      {/* ── Countdown inizio partita ─────────────────────────────────────── */}
      {gameStartingIn !== null && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(0,0,0,0.72)',
            border: '1px solid rgba(212,175,55,0.3)',
            borderRadius: 16,
            padding: '32px 56px',
            textAlign: 'center',
            backdropFilter: 'blur(6px)',
          }}>
            <div style={{ fontSize: 10, letterSpacing: '0.25em', color: 'rgba(212,175,55,0.6)', fontFamily: 'Inter, sans-serif', marginBottom: 10 }}>
              LA PARTITA INIZIA TRA
            </div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 72, color: '#D4AF37', lineHeight: 1, fontWeight: 700 }}>
              {gameStartingIn}
            </div>
          </div>
        </div>
      )}

      {/* ── Tournament end overlay ───────────────────────────────────────── */}
      {tournamentEnded && (
        <TournamentEndOverlay
          result={tournamentEnded}
          currentUsername={null}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ActionBtn — bottone azione con stile coerente + disabled opacità
// ─────────────────────────────────────────────────────────────────────────────

function ActionBtn({ children, disabled, onClick, variant, style: extraStyle }) {
  const isGhost = variant === 'ghost';
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        background:   isGhost ? 'transparent' : 'linear-gradient(180deg,#D4AF37 0%,#B8941F 100%)',
        border:       isGhost ? '1px solid rgba(212,175,55,0.4)' : 'none',
        color:        isGhost ? '#D4AF37' : '#0a0a0a',
        padding:      '7px 14px',
        fontSize:     11.5,
        fontFamily:   'Inter, sans-serif',
        fontWeight:   isGhost ? 400 : 600,
        letterSpacing:'0.08em',
        cursor:       disabled ? 'not-allowed' : 'pointer',
        opacity:      disabled ? 0.36 : 1,
        transition:   'opacity 0.15s',
        whiteSpace:   'nowrap',
        ...extraStyle,
      }}
    >
      {children}
    </button>
  );
}
