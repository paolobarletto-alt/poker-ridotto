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

// ── Animation foundation tokens (Dramatic-inspired) ──────────────────────────
const DRAMATIC_SPEED_MUL = 1.35;

const ANIM_EASINGS = Object.freeze({
  standard: 'cubic-bezier(.4,0,.2,1)',
  cardTravel: 'cubic-bezier(.4,1.3,.5,1)',
  cardFlipBounce: 'cubic-bezier(.34,1.56,.64,1)',
  chipFlightArc: 'cubic-bezier(.4,0,.3,1)',
  linear: 'linear',
  ease: 'ease',
});

const ANIM_TIMINGS = Object.freeze({
  baseMs: Math.round(500 * DRAMATIC_SPEED_MUL),
  quickMs: Math.round(300 * DRAMATIC_SPEED_MUL),
  settleMs: Math.round(200 * DRAMATIC_SPEED_MUL),
  seatSlideMs: 600,
  chipFadeMs: 250,
  timerTickMs: 120,
  revealMinMs: 420,
  chipStaggerMinMs: 25,
  chipStaggerMaxMs: 40,
});

const TABLE_ANIMATION_TOKENS = Object.freeze({
  variant: 'dramatic',
  speedMultiplier: DRAMATIC_SPEED_MUL,
  easings: ANIM_EASINGS,
  timings: ANIM_TIMINGS,
  zLayers: Object.freeze({
    felt: 1,
    seats: 2,
    overlays: 18,
    hud: 20,
    modals: 40,
  }),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtCountdown(ms) {
  if (ms <= 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function getElementCenterInContainer(element, container) {
  if (!element || !container) return null;
  const targetRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  return {
    x: targetRect.left - containerRect.left + (targetRect.width / 2),
    y: targetRect.top - containerRect.top + (targetRect.height / 2),
  };
}

function createAnimationQueue() {
  const queue = [];
  return {
    enqueue(task) {
      const item = {
        id: task?.id ?? `anim-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        createdAt: Date.now(),
        ...task,
      };
      queue.push(item);
      return item;
    },
    dequeue() {
      return queue.shift() ?? null;
    },
    peek() {
      return queue[0] ?? null;
    },
    clear() {
      queue.length = 0;
    },
    size() {
      return queue.length;
    },
    snapshot() {
      return [...queue];
    },
  };
}

function createFlightScaffold({ kind, from, to, payload = null, delayMs = 0, durationMs = ANIM_TIMINGS.baseMs }) {
  return {
    id: `flight-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    kind,
    from,
    to,
    payload,
    delayMs,
    durationMs,
    createdAt: Date.now(),
  };
}

function FlightCard({ flight, cardBack = 'ridotto' }) {
  const [started, setStarted] = useState(false);
  const [landed, setLanded] = useState(false);
  const durationMs = Math.max(160, flight.durationMs ?? ANIM_TIMINGS.baseMs);
  const travelMs = Math.max(160, Math.round(durationMs * 0.76));

  useEffect(() => {
    let raf = null;
    let settleRaf = null;
    let settleTimeoutId = null;
    setStarted(false);
    setLanded(false);
    const timeoutId = setTimeout(() => {
      raf = requestAnimationFrame(() => {
        setStarted(true);
        settleTimeoutId = window.setTimeout(() => {
          settleRaf = requestAnimationFrame(() => setLanded(true));
        }, travelMs);
      });
    }, Math.max(0, flight.delayMs ?? 0));
    return () => {
      clearTimeout(timeoutId);
      if (settleTimeoutId) window.clearTimeout(settleTimeoutId);
      if (raf) cancelAnimationFrame(raf);
      if (settleRaf) cancelAnimationFrame(settleRaf);
    };
  }, [flight.delayMs, flight.id, travelMs]);

  const from = flight.from ?? { x: 0, y: 0 };
  const to = flight.to ?? from;
  const dx = (to.x ?? 0) - (from.x ?? 0);
  const dy = (to.y ?? 0) - (from.y ?? 0);
  const rotateFrom = flight.rotateFrom ?? -8;
  const rotateTo = flight.rotateTo ?? 0;
  const rotateMid = flight.rotateMid ?? (rotateFrom * 0.4);

  return (
    <div
      style={{
        position: 'absolute',
        left: from.x ?? 0,
        top: from.y ?? 0,
        transform: `translate(-50%,-50%) translate(${started ? dx : 0}px,${started ? dy : 0}px) scale(${started ? 1 : 0.84})`,
        transition: `transform ${durationMs}ms ${flight.easing ?? ANIM_EASINGS.cardTravel}, opacity ${Math.min(240, durationMs)}ms ${ANIM_EASINGS.ease}`,
        opacity: started ? 1 : 0,
        willChange: 'transform,opacity',
      }}
    >
      <div
        style={{
          transform: `rotate(${started ? (landed ? rotateTo : rotateMid) : rotateFrom}deg)`,
          transition: landed
            ? `transform ${Math.max(ANIM_TIMINGS.settleMs, 170)}ms ${ANIM_EASINGS.cardFlipBounce}`
            : `transform ${travelMs}ms ${flight.easing ?? ANIM_EASINGS.cardTravel}`,
          willChange: 'transform',
        }}
      >
        <Card card="back" size={flight.size ?? 'sm'} cardBack={cardBack} />
      </div>
    </div>
  );
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
        {result.position_results?.map((r) => {
          const payout = Number(r.payout ?? 0);
          const buyIn = Number(result.buy_in ?? 0);
          const amount = payout - buyIn;
          const amountColor = amount > 0 ? '#4caf50' : amount < 0 ? '#e57373' : 'rgba(245,241,232,0.55)';
          return (
          <div key={`${r.position}-${r.username}`} style={{
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
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: amountColor, fontWeight: 600 }}>
              {amount > 0 ? '+' : ''}{amount.toLocaleString('it-IT')} chip
            </span>
          </div>
        )})}
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

function FlipRevealCard({
  card,
  size = 'md',
  cardBack = 'ridotto',
  triggerKey,
  delayMs = 0,
  durationMs = Math.max(ANIM_TIMINGS.revealMinMs, 560),
}) {
  const [started, setStarted] = useState(false);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    setStarted(false);
    setSettled(false);
    let raf = null;
    const startTimeout = setTimeout(() => {
      raf = requestAnimationFrame(() => setStarted(true));
    }, Math.max(0, delayMs));
    const settleTimeout = setTimeout(() => setSettled(true), Math.max(0, delayMs) + durationMs + 40);
    return () => {
      clearTimeout(startTimeout);
      clearTimeout(settleTimeout);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [delayMs, durationMs, triggerKey]);

  if (settled) return <Card card={card} size={size} cardBack={cardBack} />;

  return (
    <div style={{ position: 'relative', width: 'fit-content', height: 'fit-content', perspective: 900 }}>
      <div
        style={{
          position: 'relative',
          transformStyle: 'preserve-3d',
          transition: `transform ${durationMs}ms ${ANIM_EASINGS.cardFlipBounce}`,
          transform: `rotateY(${started ? 180 : 0}deg)`,
          willChange: 'transform',
        }}
      >
        <div style={{ backfaceVisibility: 'hidden' }}>
          <Card card="back" size={size} cardBack={cardBack} />
        </div>
        <div style={{ position: 'absolute', inset: 0, transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}>
          <Card card={card} size={size} cardBack={cardBack} />
        </div>
      </div>
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

  useEffect(() => {
    const el = barRef.current;
    if (!el || !timerSeconds || timerSeconds <= 0) return;

    // Reset
    el.style.transition = 'none';
    el.style.width = '100%';
    el.style.background = '#D4AF37';

    let raf1, raf2, redTimeout;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        el.style.transition = `width ${timerSeconds}s linear`;
        el.style.width = '0%';
        // Cambia in rosso quando rimangono 8s
        const msUntilRed = Math.max(0, (timerSeconds - 8) * 1000);
        redTimeout = setTimeout(() => {
          if (el) {
            el.style.background = '#c0392b';
          }
        }, msUntilRed);
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(redTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actingKey]);

  return (
    <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
      <div ref={barRef} style={{ height: '100%', width: '100%', background: '#D4AF37' }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Seat
// ─────────────────────────────────────────────────────────────────────────────

function Seat({
  seatIndex, seat, pos, betOffset,
  isHero, myCards,
  isActing, timerSeconds, timerTrigger,
  phase, cardBack,
  showdownResult,
  showdownReveal,
  seatDelta,
  anchorRef,
  cardAnchorRef,
  stackAnchorRef,
  betAnchorRef,
  onEmptyClick,
}) {
  const isWinner  = showdownResult?.won === true;
  const isFolded  = seat?.status === 'folded';
  const isSitOut  = seat?.status === 'sit_out' || seat?.status === 'seduto_out';
  const hasCards  = !isFolded && !isSitOut && phase !== 'waiting' && phase !== 'in_attesa';
  const revealCards = showdownResult?.cards;
  const seatVisualFilter = isFolded
    ? 'grayscale(0.82) saturate(0.55) brightness(0.78)'
    : isSitOut
      ? 'grayscale(0.35) saturate(0.82)'
      : 'none';

  // ── Posto vuoto ──────────────────────────────────────────────────────────
  if (!seat) {
    return (
      <div
        ref={anchorRef}
        role="button" tabIndex={0}
        onClick={onEmptyClick}
        onKeyDown={(e) => e.key === 'Enter' && onEmptyClick()}
        style={{ position: 'absolute', ...pos, width: 130, transform: 'translate(-50%,-50%)', textAlign: 'center', cursor: 'pointer' }}
        title={`Siediti al posto ${seatIndex + 1}`}
      >
        <div
          style={{ width: 72, height: 72, borderRadius: '50%', border: '2px dashed rgba(212,175,55,0.6)', background: 'rgba(212,175,55,0.07)', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(212,175,55,0.75)', fontSize: 10, letterSpacing: '0.2em', fontFamily: 'Inter, sans-serif', transition: 'all 0.2s', boxShadow: '0 0 12px rgba(212,175,55,0.12)' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#D4AF37'; e.currentTarget.style.color = '#D4AF37'; e.currentTarget.style.background = 'rgba(212,175,55,0.15)'; e.currentTarget.style.boxShadow = '0 0 18px rgba(212,175,55,0.3)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.6)'; e.currentTarget.style.color = 'rgba(212,175,55,0.75)'; e.currentTarget.style.background = 'rgba(212,175,55,0.07)'; e.currentTarget.style.boxShadow = '0 0 12px rgba(212,175,55,0.12)'; }}
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
    <div
      ref={anchorRef}
      style={{
      position: 'absolute', ...pos, width: 150, transform: 'translate(-50%,-50%)',
      textAlign: 'center', opacity: isFolded ? 0.34 : isSitOut ? 0.55 : 1,
      filter: seatVisualFilter,
      transition: 'opacity 240ms ease, filter 240ms ease, transform 240ms ease',
      zIndex: isActing ? 2 : 1,
      }}
    >

      {/* ── Carte ──────────────────────────────────────────────────────── */}
      {displayCards.length > 0 && (
        <div
          ref={cardAnchorRef}
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 2,
            marginBottom: 6,
            transform: isHero ? 'scale(1.1)' : 'none',
            transformOrigin: 'bottom center',
            opacity: isFolded ? 0.3 : 1,
            transition: 'opacity 240ms ease',
          }}
        >
          {displayCards.map((c, i) => (
            <div key={i} style={{ transform: `rotate(${i === 0 ? -4 : 4}deg)`, transformOrigin: 'bottom center' }}>
              {revealCards && showdownReveal?.token ? (
                <FlipRevealCard
                  card={c}
                  size={isHero ? 'md' : 'sm'}
                  cardBack={cardBack}
                  triggerKey={`${showdownReveal.token}-${i}-${c}`}
                  delayMs={(showdownReveal.delayMs ?? 0) + (i * 120)}
                  durationMs={Math.max(ANIM_TIMINGS.revealMinMs, 600)}
                />
              ) : (
                <Card card={c} size={isHero ? 'md' : 'sm'} cardBack={cardBack} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Nameplate ──────────────────────────────────────────────────── */}
      <div style={{
        background: isHero
          ? 'linear-gradient(180deg,rgba(212,175,55,0.28),rgba(212,175,55,0.10))'
          : isActing ? 'linear-gradient(180deg,rgba(212,175,55,0.22),rgba(212,175,55,0.07))' : 'rgba(0,0,0,0.82)',
        border: isHero
          ? '1.5px solid rgba(212,175,55,0.85)'
          : isActing ? '1px solid #D4AF37' : '1px solid rgba(212,175,55,0.22)',
        backdropFilter: 'blur(8px)',
        transition: 'border-color 0.2s, background 0.2s',
        overflow: 'hidden',
        boxShadow: isWinner
          ? undefined
          : isHero
            ? '0 0 22px rgba(212,175,55,0.45), inset 0 0 12px rgba(212,175,55,0.08)'
            : isActing ? '0 0 18px rgba(212,175,55,0.35)' : '0 2px 8px rgba(0,0,0,0.6)',
        ...(isWinner ? { animation: 'ridotto-win-pulse 1.2s ease-in-out infinite' } : {}),
      }}>
        {/* Timer bar */}
        {isActing && (
          <ActionTimerBar timerSeconds={timerSeconds} actingKey={timerTrigger} />
        )}

        <div style={{ padding: '8px 12px 10px' }}>
          {/* Nome + badge "TU" */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 3 }}>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: isHero ? 13 : 12, fontWeight: isHero ? 600 : 500, color: '#F5F1E8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 96, letterSpacing: isHero ? '-0.01em' : 'normal' }}>
              {seat.username}
            </div>
            {isHero && (
              <div style={{ fontSize: 8, letterSpacing: '0.15em', color: '#0a0a0a', background: '#D4AF37', padding: '2px 5px', flexShrink: 0, fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>
                TU
              </div>
            )}
          </div>

          {/* Stack */}
          <div ref={stackAnchorRef} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: isHero ? 13 : 12, fontWeight: isHero ? 600 : 400, color: isHero ? '#D4AF37' : isActing ? '#D4AF37' : 'rgba(245,241,232,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            {seat.stack.toLocaleString('it-IT')}
            {seatDelta != null && seatDelta !== 0 && (
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: seatDelta > 0 ? '#4caf50' : '#e57373',
                animation: 'fadeInOut 3s forwards',
              }}>
                {seatDelta > 0 ? `+${seatDelta.toLocaleString('it-IT')}` : seatDelta.toLocaleString('it-IT')}
              </span>
            )}
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
      {seat.last_action && !isFolded && !isSitOut && (
        <div style={{ marginTop: 3, fontSize: 9, letterSpacing: '0.18em', fontWeight: 600, color: '#D4AF37', fontFamily: 'Inter, sans-serif' }}>
          {seat.last_action.toUpperCase()}
        </div>
      )}
      {isFolded && (
        <div style={{ marginTop: 3, fontSize: 9, letterSpacing: '0.18em', fontWeight: 600, color: 'rgba(245,241,232,0.45)', fontFamily: 'Inter, sans-serif' }}>FOLD</div>
      )}
      {isSitOut && (
        <div style={{ marginTop: 3, fontSize: 9, letterSpacing: '0.18em', fontWeight: 600, color: 'rgba(245,241,232,0.5)', fontFamily: 'Inter, sans-serif', background: 'rgba(0,0,0,0.5)', padding: '1px 5px' }}>SIT OUT</div>
      )}

      <div ref={betAnchorRef} style={{ position: 'absolute', ...betOffset, width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />

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
// RebuyWidget — saldo profilo + ricarica
// ─────────────────────────────────────────────────────────────────────────────

function RebuyWidget({ profileBalance, myStack, showRebuy, setShowRebuy, sendRebuy }) {
  const [customAmt, setCustomAmt] = useState('');
  const canRebuy = myStack === 0;

  const doRebuy = (amt) => {
    const n = parseInt(amt, 10);
    if (!n || n <= 0) return;
    sendRebuy?.(n);
    setShowRebuy(false);
    setCustomAmt('');
  };

  const presets = [100, 200, 500, 1000].filter(a => a <= profileBalance);

  return (
    <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(212,175,55,0.1)', background: 'rgba(212,175,55,0.03)', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showRebuy ? 10 : 0 }}>
        <div>
          <div style={{ fontSize: 8.5, letterSpacing: '0.2em', color: 'rgba(245,241,232,0.4)', fontFamily: 'Inter, sans-serif', marginBottom: 2 }}>SALDO PROFILO</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 600, color: '#D4AF37' }}>
            {profileBalance.toLocaleString('it-IT')} chips
          </div>
        </div>
        {canRebuy && (
          <button
            onClick={() => { setShowRebuy(v => !v); setCustomAmt(''); }}
            style={{ background: showRebuy ? 'rgba(212,175,55,0.18)' : 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.35)', color: '#D4AF37', fontSize: 10, letterSpacing: '0.14em', fontFamily: 'Inter, sans-serif', fontWeight: 600, padding: '5px 10px', cursor: 'pointer', transition: 'all 0.15s' }}
          >
            {showRebuy ? 'CHIUDI' : '+ RICARICA'}
          </button>
        )}
      </div>

      {canRebuy && showRebuy && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {profileBalance === 0 ? (
            <div style={{ textAlign: 'center', fontSize: 10.5, color: 'rgba(245,241,232,0.4)', fontFamily: 'Inter, sans-serif', padding: '4px 0' }}>
              Saldo profilo esaurito
            </div>
          ) : (
            <>
              {/* Preset rapidi */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {presets.map(amt => (
                  <button
                    key={amt}
                    onClick={() => doRebuy(amt)}
                    style={{ flex: '1 1 calc(50% - 3px)', background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.28)', color: 'rgba(245,241,232,0.85)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', padding: '7px 0', cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.16)'; e.currentTarget.style.color = '#D4AF37'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.06)'; e.currentTarget.style.color = 'rgba(245,241,232,0.85)'; }}
                  >
                    +{amt.toLocaleString('it-IT')}
                  </button>
                ))}
              </div>

              {/* Input importo personalizzato */}
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="number"
                  min={1}
                  max={profileBalance}
                  placeholder="Importo personalizzato…"
                  value={customAmt}
                  onChange={e => setCustomAmt(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doRebuy(customAmt)}
                  style={{
                    flex: 1, background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(212,175,55,0.3)',
                    color: '#F5F1E8', fontSize: 12, fontFamily: 'JetBrains Mono, monospace',
                    padding: '6px 10px', outline: 'none',
                  }}
                />
                <button
                  onClick={() => doRebuy(customAmt)}
                  disabled={!customAmt || parseInt(customAmt) <= 0 || parseInt(customAmt) > profileBalance}
                  style={{ background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.4)', color: '#D4AF37', fontSize: 11, fontFamily: 'Inter, sans-serif', fontWeight: 600, padding: '6px 12px', cursor: 'pointer', letterSpacing: '0.08em', opacity: (!customAmt || parseInt(customAmt) <= 0 || parseInt(customAmt) > profileBalance) ? 0.4 : 1 }}
                >
                  OK
                </button>
              </div>
            </>
          )}
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
  handWinner        = null,
  seatDeltas        = {},
  timerTrigger      = 0,
  lastError         = null,
  handLog           = [],
  messages          = [],
  sendAction,
  sendMessage,
  joinSeat,
  leaveSeat,
  sendRebuy,
  profileBalance    = 0,
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
  const [showRebuy,    setShowRebuy]    = useState(false);
  const { user } = useAuth();
  const [showBuyin,    setShowBuyin]    = useState(false);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [raiseAmt,     setRaiseAmt]     = useState(20);
  const chatEndRef = useRef(null);
  const tableStageRef = useRef(null);
  const feltRef = useRef(null);
  const potAnchorRef = useRef(null);
  const deckAnchorRef = useRef(null);
  const communityAnchorRef = useRef(null);
  const communityCardRefs = useRef(Array.from({ length: 5 }, () => null));
  const seatAnchorRefs = useRef(Array.from({ length: MAX_SEATS }, () => null));
  const seatCardAnchorRefs = useRef(Array.from({ length: MAX_SEATS }, () => null));
  const seatStackAnchorRefs = useRef(Array.from({ length: MAX_SEATS }, () => null));
  const seatBetAnchorRefs = useRef(Array.from({ length: MAX_SEATS }, () => null));
  const overlayLayerRefs = useRef({ cards: null, chips: null, pot: null });
  const animationQueueRef = useRef(createAnimationQueue());
  const chipFlightTimersRef = useRef(new Map());
  const potPayoutTimersRef = useRef(new Map());
  const previousTableSnapshotRef = useRef(null);
  const animationFoundationRef = useRef({
    tokens: TABLE_ANIMATION_TOKENS,
    queue: animationQueueRef.current,
  });
  const dealtHandRef = useRef(null);
  const previousCommunityRef = useRef([]);
  const [chipFlights, setChipFlights] = useState([]);
  const [potPayoutFlights, setPotPayoutFlights] = useState([]);
  const [chipFlightNow, setChipFlightNow] = useState(Date.now());
  const [cardFlights, setCardFlights] = useState([]);
  const [communityRevealTokens, setCommunityRevealTokens] = useState({});
  const [showdownRevealTokens, setShowdownRevealTokens] = useState({});
  const animationGenerationRef = useRef(0);
  const animationTimeoutsRef = useRef(new Set());
  const previousHandNumberRef = useRef(null);
  const previousTableIdRef = useRef(tableId ?? null);
  const previousConnectedRef = useRef(connected);
  const previousPhaseRef = useRef('waiting');
  const preflopCycleRef = useRef(0);
  const seatOccupancySignatureRef = useRef('');
  const showdownSignatureRef = useRef('');
  const lastWinnerAnimKeyRef = useRef('');

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

  // ── Reset raise amount al proprio turno ───────────────────────────────────
  useEffect(() => {
    if (isMyTurn && myStack > 0) {
      setRaiseAmt(Math.max(minRaise, Math.min(minRaise * 3, myStack)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyTurn, actingSeat]);

  const clampedRaise = Math.max(minRaise, Math.min(raiseAmt, myStack));

  const clearPendingAnimationTimeouts = useCallback(() => {
    animationTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    animationTimeoutsRef.current.clear();
  }, []);

  const scheduleAnimationTimeout = useCallback((cb, delayMs = 0, generation = animationGenerationRef.current) => {
    const timeoutId = window.setTimeout(() => {
      animationTimeoutsRef.current.delete(timeoutId);
      if (generation !== animationGenerationRef.current) return;
      cb?.();
    }, Math.max(0, delayMs));
    animationTimeoutsRef.current.add(timeoutId);
    return timeoutId;
  }, []);

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
    if (isTournament) {
      joinSeat?.(idx);
      return;
    }
    setSelectedSeat(idx);
    setShowBuyin(true);
  }, [isTournament, joinSeat, mySeat]);

  const setSeatAnchorRef = useCallback((idx, node) => {
    seatAnchorRefs.current[idx] = node;
  }, []);

  const setSeatCardAnchorRef = useCallback((idx, node) => {
    seatCardAnchorRefs.current[idx] = node;
  }, []);

  const setSeatStackAnchorRef = useCallback((idx, node) => {
    seatStackAnchorRefs.current[idx] = node;
  }, []);

  const setSeatBetAnchorRef = useCallback((idx, node) => {
    seatBetAnchorRefs.current[idx] = node;
  }, []);

  const setOverlayLayerRef = useCallback((layerKey, node) => {
    overlayLayerRefs.current[layerKey] = node;
  }, []);

  const setCommunityCardRef = useCallback((idx, node) => {
    communityCardRefs.current[idx] = node;
  }, []);

  const getSeatAnchorPoint = useCallback((idx) => (
    getElementCenterInContainer(seatAnchorRefs.current[idx], tableStageRef.current)
  ), []);

  const getSeatCardPoint = useCallback((idx) => (
    getElementCenterInContainer(seatCardAnchorRefs.current[idx], tableStageRef.current)
    ?? getSeatAnchorPoint(idx)
  ), [getSeatAnchorPoint]);

  const getSeatStackPoint = useCallback((idx) => (
    getElementCenterInContainer(seatStackAnchorRefs.current[idx], tableStageRef.current)
    ?? getSeatAnchorPoint(idx)
  ), [getSeatAnchorPoint]);

  const getSeatBetPoint = useCallback((idx) => {
    const point = getElementCenterInContainer(seatBetAnchorRefs.current[idx], tableStageRef.current);
    if (point) return point;
    const fallback = getSeatAnchorPoint(idx);
    if (!fallback) return null;
    return { x: fallback.x, y: fallback.y - 34 };
  }, [getSeatAnchorPoint]);

  const getPotAnchorPoint = useCallback(() => (
    getElementCenterInContainer(potAnchorRef.current, tableStageRef.current)
  ), []);

  const getDeckAnchorPoint = useCallback(() => (
    getElementCenterInContainer(deckAnchorRef.current, tableStageRef.current)
    ?? getElementCenterInContainer(communityAnchorRef.current, tableStageRef.current)
  ), []);

  const getCommunityCardPoint = useCallback((idx) => (
    getElementCenterInContainer(communityCardRefs.current[idx], tableStageRef.current)
  ), []);

  const queueScaffoldFlight = useCallback((flight) => (
    animationQueueRef.current.enqueue(createFlightScaffold(flight))
  ), []);

  const spawnCardFlights = useCallback((flights, generation = animationGenerationRef.current) => {
    if (generation !== animationGenerationRef.current) return;
    if (!Array.isArray(flights) || flights.length === 0) return;
    const validFlights = flights
      .filter((flight) => flight?.from && flight?.to)
      .map((flight) => ({ ...flight, generation }));
    if (validFlights.length === 0) return;
    setCardFlights((prev) => {
      const activePrev = prev.filter((flight) => flight.generation === animationGenerationRef.current);
      const mergedByKey = new Map(activePrev.map((flight) => [flight.animKey ?? flight.id, flight]));
      validFlights.forEach((flight) => {
        mergedByKey.set(flight.animKey ?? flight.id, flight);
      });
      return [...mergedByKey.values()];
    });
    const maxFlightDuration = validFlights.reduce(
      (max, flight) => Math.max(max, (flight.delayMs ?? 0) + (flight.durationMs ?? ANIM_TIMINGS.baseMs)),
      0,
    );
    const idsToDrop = new Set(validFlights.map((flight) => flight.id));
    const cleanupId = scheduleAnimationTimeout(() => {
      setCardFlights((prev) => prev.filter((flight) => !idsToDrop.has(flight.id)));
    }, maxFlightDuration + 280, generation);
    return () => {
      animationTimeoutsRef.current.delete(cleanupId);
      window.clearTimeout(cleanupId);
    };
  }, [scheduleAnimationTimeout]);

  useEffect(() => {
    animationFoundationRef.current = {
      tokens: TABLE_ANIMATION_TOKENS,
      queue: animationQueueRef.current,
      refs: {
        stage: tableStageRef.current,
        felt: feltRef.current,
        overlays: overlayLayerRefs.current,
        deck: deckAnchorRef.current,
        community: communityAnchorRef.current,
        pot: potAnchorRef.current,
      },
      helpers: {
        getSeatAnchorPoint,
        getSeatCardPoint,
        getSeatStackPoint,
        getSeatBetPoint,
        getDeckAnchorPoint,
        getCommunityCardPoint,
        getPotAnchorPoint,
        queueScaffoldFlight,
      },
    };
  }, [getSeatAnchorPoint, getSeatCardPoint, getSeatStackPoint, getSeatBetPoint, getDeckAnchorPoint, getCommunityCardPoint, getPotAnchorPoint, queueScaffoldFlight]);

  const removeChipFlight = useCallback((flightId) => {
    const timerId = chipFlightTimersRef.current.get(flightId);
    if (timerId) {
      clearTimeout(timerId);
      chipFlightTimersRef.current.delete(flightId);
    }
    setChipFlights((prev) => prev.filter((flight) => flight.id !== flightId));
  }, []);

  const clearChipFlights = useCallback(() => {
    chipFlightTimersRef.current.forEach((timerId) => clearTimeout(timerId));
    chipFlightTimersRef.current.clear();
    setChipFlights([]);
  }, []);

  const removePotPayoutFlight = useCallback((flightId) => {
    const timerId = potPayoutTimersRef.current.get(flightId);
    if (timerId) {
      clearTimeout(timerId);
      potPayoutTimersRef.current.delete(flightId);
    }
    setPotPayoutFlights((prev) => prev.filter((flight) => flight.id !== flightId));
  }, []);

  const clearPotPayoutFlights = useCallback(() => {
    potPayoutTimersRef.current.forEach((timerId) => clearTimeout(timerId));
    potPayoutTimersRef.current.clear();
    setPotPayoutFlights([]);
  }, []);

  const hardResetVisualState = useCallback(() => {
    animationGenerationRef.current += 1;
    clearPendingAnimationTimeouts();
    clearChipFlights();
    clearPotPayoutFlights();
    setCardFlights([]);
    setCommunityRevealTokens({});
    setShowdownRevealTokens({});
    setChipFlightNow(Date.now());
    animationQueueRef.current.clear();
    previousTableSnapshotRef.current = null;
    dealtHandRef.current = null;
    previousCommunityRef.current = [];
    showdownSignatureRef.current = '';
    lastWinnerAnimKeyRef.current = '';
  }, [clearChipFlights, clearPendingAnimationTimeouts, clearPotPayoutFlights]);

  const enqueueChipFlight = useCallback(({
    kind,
    from,
    to,
    amount,
    delayMs = 0,
    durationMs = ANIM_TIMINGS.baseMs,
    arcHeight = 38,
  }) => {
    if (!from || !to) return null;
    const now = Date.now();
    const id = `chip-flight-${now}-${Math.random().toString(16).slice(2)}`;
    const flight = {
      id,
      kind,
      from,
      to,
      amount,
      startAt: now + delayMs,
      durationMs,
      arcHeight,
      createdAt: now,
    };
    queueScaffoldFlight({
      kind: `chip:${kind}`,
      from,
      to,
      payload: { amount },
      delayMs,
      durationMs,
    });
    setChipFlights((prev) => [...prev, flight]);
    const ttlMs = Math.max(0, delayMs + durationMs + ANIM_TIMINGS.chipFadeMs + 120);
    const timerId = scheduleAnimationTimeout(() => removeChipFlight(id), ttlMs);
    chipFlightTimersRef.current.set(id, timerId);
    return flight;
  }, [queueScaffoldFlight, removeChipFlight, scheduleAnimationTimeout]);

  const enqueuePotPayoutFlight = useCallback(({
    from,
    to,
    amount,
    delayMs = 0,
    durationMs = ANIM_TIMINGS.baseMs + 240,
    arcHeight = 48,
  }) => {
    if (!from || !to) return null;
    const now = Date.now();
    const id = `pot-payout-${now}-${Math.random().toString(16).slice(2)}`;
    const flight = {
      id,
      kind: 'payout',
      from,
      to,
      amount,
      startAt: now + delayMs,
      durationMs,
      arcHeight,
      createdAt: now,
    };
    queueScaffoldFlight({
      kind: 'chip:payout',
      from,
      to,
      payload: { amount },
      delayMs,
      durationMs,
    });
    setPotPayoutFlights((prev) => [...prev, flight]);
    const ttlMs = Math.max(0, delayMs + durationMs + ANIM_TIMINGS.chipFadeMs + 180);
    const timerId = scheduleAnimationTimeout(() => removePotPayoutFlight(id), ttlMs);
    potPayoutTimersRef.current.set(id, timerId);
    return flight;
  }, [queueScaffoldFlight, removePotPayoutFlight, scheduleAnimationTimeout]);

  useEffect(() => {
    if (chipFlights.length === 0 && potPayoutFlights.length === 0) return undefined;
    let frameId = 0;
    const tick = () => {
      setChipFlightNow(Date.now());
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [chipFlights.length, potPayoutFlights.length]);

  useEffect(() => (
    () => {
      animationGenerationRef.current += 1;
      clearPendingAnimationTimeouts();
      clearChipFlights();
      clearPotPayoutFlights();
    }
  ), [clearChipFlights, clearPendingAnimationTimeouts, clearPotPayoutFlights]);

  useEffect(() => {
    if (previousConnectedRef.current !== connected) {
      hardResetVisualState();
      previousConnectedRef.current = connected;
    }
  }, [connected, hardResetVisualState]);

  useEffect(() => {
    if (previousTableIdRef.current !== (tableId ?? null)) {
      previousTableIdRef.current = tableId ?? null;
      hardResetVisualState();
    }
  }, [tableId, hardResetVisualState]);

  useEffect(() => {
    if (phase === 'preflop' && previousPhaseRef.current !== 'preflop') {
      preflopCycleRef.current += 1;
      dealtHandRef.current = null;
    }
    previousPhaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const previousHand = previousHandNumberRef.current;
    if (previousHand !== null && handNumber !== previousHand) {
      hardResetVisualState();
    }
    previousHandNumberRef.current = handNumber;
  }, [handNumber, hardResetVisualState]);

  useEffect(() => {
    const signature = seats
      .map((seat, idx) => (
        seat
          ? `${idx}:${seat.user_id ?? seat.username ?? 'occupied'}`
          : `${idx}:empty`
      ))
      .join('|');
    if (seatOccupancySignatureRef.current && seatOccupancySignatureRef.current !== signature) {
      hardResetVisualState();
    }
    seatOccupancySignatureRef.current = signature;
  }, [seats, hardResetVisualState]);

  useEffect(() => {
    if (!connected || handNumber <= 0 || phase !== 'preflop') return;
    const dealCycleKey = `${handNumber}-${preflopCycleRef.current}`;
    if (dealtHandRef.current === dealCycleKey) return;
    dealtHandRef.current = dealCycleKey;
    const generation = animationGenerationRef.current;

    const timeoutId = scheduleAnimationTimeout(() => {
      const deck = getDeckAnchorPoint();
      if (!deck) return;
      const activeSeats = seats
        .map((seat, idx) => ({ seat, idx }))
        .filter(({ seat }) => seat && seat.status !== 'sit_out' && seat.status !== 'seduto_out');

      const flights = [];
      activeSeats.forEach(({ idx }, order) => {
        const to = getSeatCardPoint(idx) ?? getSeatAnchorPoint(idx);
        if (!to) return;
        for (let cardIdx = 0; cardIdx < 2; cardIdx += 1) {
          const delayMs = (order * 85) + (cardIdx * 110);
          const flight = createFlightScaffold({
            kind: 'deal-hole',
            from: deck,
            to: { x: to.x + (cardIdx === 0 ? -12 : 12), y: to.y + (mySeat === idx ? -4 : 0) },
            delayMs,
            durationMs: Math.max(ANIM_TIMINGS.quickMs + 180, 420),
          });
          flight.animKey = `deal-hole-${dealCycleKey}-${idx}-${cardIdx}`;
          flight.size = mySeat === idx ? 'md' : 'sm';
          flight.rotateFrom = cardIdx === 0 ? -16 : 16;
          flight.rotateMid = cardIdx === 0 ? -10 : 10;
          flight.rotateTo = cardIdx === 0 ? -2 : 2;
          flights.push(flight);
          queueScaffoldFlight({
            kind: flight.kind,
            from: flight.from,
            to: flight.to,
            delayMs: flight.delayMs,
            durationMs: flight.durationMs,
          });
        }
      });

      spawnCardFlights(flights, generation);
    }, 70, generation);

    return () => {
      animationTimeoutsRef.current.delete(timeoutId);
      window.clearTimeout(timeoutId);
    };
  }, [
    connected,
    handNumber,
    phase,
    seats,
    mySeat,
    getDeckAnchorPoint,
    getSeatCardPoint,
    getSeatAnchorPoint,
    queueScaffoldFlight,
    scheduleAnimationTimeout,
    spawnCardFlights,
  ]);

  useEffect(() => {
    const previousCommunity = previousCommunityRef.current ?? [];
    const currentCommunity = Array.isArray(community) ? community : [];
    const newIndexes = [];

    for (let i = 0; i < 5; i += 1) {
      if (currentCommunity[i] && !previousCommunity[i]) newIndexes.push(i);
    }

    previousCommunityRef.current = [...currentCommunity];

    if (newIndexes.length === 0) {
      if (currentCommunity.length === 0) setCommunityRevealTokens({});
      return;
    }
    const generation = animationGenerationRef.current;

    const timeoutId = scheduleAnimationTimeout(() => {
      const deck = getDeckAnchorPoint();
      const flights = [];
      const tokenUpdates = {};
      const now = Date.now();

      newIndexes.forEach((index, order) => {
        tokenUpdates[index] = `community-${now}-${index}-${currentCommunity[index]}`;
        const to = getCommunityCardPoint(index);
        if (!deck || !to) return;
        const flight = createFlightScaffold({
          kind: 'deal-community',
          from: deck,
          to,
          delayMs: order * 120,
          durationMs: Math.max(ANIM_TIMINGS.baseMs + 100, 560),
        });
        flight.animKey = `deal-community-${handNumber}-${index}`;
        flight.size = 'md';
        flight.rotateFrom = order % 2 === 0 ? -12 : 12;
        flight.rotateTo = 0;
        flights.push(flight);
        queueScaffoldFlight({
          kind: flight.kind,
          from: flight.from,
          to: flight.to,
          delayMs: flight.delayMs,
          durationMs: flight.durationMs,
        });
      });

      setCommunityRevealTokens((prev) => ({ ...prev, ...tokenUpdates }));
      spawnCardFlights(flights, generation);
    }, 45, generation);

    return () => {
      animationTimeoutsRef.current.delete(timeoutId);
      window.clearTimeout(timeoutId);
    };
  }, [community, getDeckAnchorPoint, getCommunityCardPoint, handNumber, queueScaffoldFlight, scheduleAnimationTimeout, spawnCardFlights]);

  useEffect(() => {
    if (!Array.isArray(showdownResults) || showdownResults.length === 0) {
      showdownSignatureRef.current = '';
      setShowdownRevealTokens({});
      return;
    }
    const signature = showdownResults
      .map((result) => `${result?.seat ?? 'x'}:${(result?.cards ?? []).join(',')}`)
      .join('|');
    if (signature === showdownSignatureRef.current) return;
    showdownSignatureRef.current = signature;
    const now = Date.now();
    const tokens = {};
    showdownResults.forEach((result, idx) => {
      const seatIdx = Number(result?.seat);
      if (!Number.isInteger(seatIdx) || seatIdx < 0 || seatIdx >= MAX_SEATS) return;
      if (!Array.isArray(result?.cards) || result.cards.length === 0) return;
      tokens[seatIdx] = { token: `showdown-${now}-${seatIdx}`, delayMs: idx * 120 };
    });
    setShowdownRevealTokens(tokens);
  }, [showdownResults]);

  useEffect(() => {
    if (!handWinner || !connected) {
      if (!handWinner) {
        lastWinnerAnimKeyRef.current = '';
        clearPotPayoutFlights();
      }
      return;
    }

    const potPoint = getPotAnchorPoint();
    if (!potPoint) return;

    const winnerEntries = (handWinner.is_split
      ? (Array.isArray(handWinner.players) ? handWinner.players : [])
      : [{ seat: handWinner.seat, amount: handWinner.amount, name: handWinner.name }])
      .map((winner) => {
        const seatFromPayload = Number(winner?.seat);
        const bySeat = Number.isInteger(seatFromPayload) ? seatFromPayload : null;
        const byName = bySeat === null && winner?.name
          ? seats.findIndex((seat) => seat?.username === winner.name)
          : -1;
        const seatIdx = bySeat ?? (byName >= 0 ? byName : null);
        if (seatIdx === null || seatIdx < 0 || seatIdx >= MAX_SEATS) return null;
        const to = getSeatStackPoint(seatIdx) ?? getSeatAnchorPoint(seatIdx);
        if (!to) return null;
        return {
          seatIdx,
          to,
          amount: Math.abs(Number(winner?.amount ?? 0)),
        };
      })
      .filter(Boolean);

    if (winnerEntries.length === 0) return;

    const winnerKey = `${handNumber}|${handWinner.is_split ? 'split' : 'single'}|${winnerEntries.map((w) => `${w.seatIdx}:${w.amount}`).join(',')}`;
    if (lastWinnerAnimKeyRef.current === winnerKey) return;
    lastWinnerAnimKeyRef.current = winnerKey;
    clearPotPayoutFlights();

    const fallbackAmount = Math.abs(Number(handWinner.pot ?? pot ?? 0));
    const splitFallback = winnerEntries.length > 0 ? Math.max(1, Math.floor(fallbackAmount / winnerEntries.length)) : fallbackAmount;

    winnerEntries.forEach((winner, idx) => {
      const distance = Math.hypot(winner.to.x - potPoint.x, winner.to.y - potPoint.y);
      enqueuePotPayoutFlight({
        from: potPoint,
        to: winner.to,
        amount: winner.amount > 0 ? winner.amount : splitFallback,
        delayMs: 90 + (idx * (handWinner.is_split ? 150 : 90)),
        durationMs: ANIM_TIMINGS.baseMs + 250,
        arcHeight: Math.min(132, Math.max(40, distance * 0.22)),
      });
    });
  }, [
    handWinner,
    connected,
    handNumber,
    seats,
    pot,
    getPotAnchorPoint,
    getSeatStackPoint,
    getSeatAnchorPoint,
    clearPotPayoutFlights,
    enqueuePotPayoutFlight,
  ]);

  useEffect(() => {
    if (!tableStageRef.current) return;

    const currentSnapshot = {
      phase,
      handNumber,
      seats: seats.map((seat) => (
        seat
          ? {
              bet_in_round: Number(seat.bet_in_round ?? 0),
              last_action: (seat.last_action ?? '').toLowerCase(),
              status: seat.status ?? null,
            }
          : null
      )),
    };

    const previousSnapshot = previousTableSnapshotRef.current;
    if (!previousSnapshot) {
      previousTableSnapshotRef.current = currentSnapshot;
      return;
    }

    const potPoint = getPotAnchorPoint();
    const handProgressed = handNumber !== previousSnapshot.handNumber;
    const streetChanged = previousSnapshot.phase !== phase;
    const shouldCollectToPot = (streetChanged || handProgressed)
      && previousSnapshot.phase
      && previousSnapshot.phase !== 'waiting'
      && previousSnapshot.phase !== 'in_attesa';

    if (shouldCollectToPot && potPoint) {
      const previousBets = previousSnapshot.seats
        .map((seat, idx) => ({ idx, amount: Number(seat?.bet_in_round ?? 0) }))
        .filter((row) => row.amount > 0);

      previousBets.forEach((row, i) => {
        const from = getSeatBetPoint(row.idx);
        const delayStep = ANIM_TIMINGS.chipStaggerMinMs + Math.round(Math.random() * (ANIM_TIMINGS.chipStaggerMaxMs - ANIM_TIMINGS.chipStaggerMinMs));
        const distance = from ? Math.hypot(potPoint.x - from.x, potPoint.y - from.y) : 0;
        enqueueChipFlight({
          kind: 'collect',
          from,
          to: potPoint,
          amount: row.amount,
          delayMs: i * delayStep,
          durationMs: ANIM_TIMINGS.baseMs + 140,
          arcHeight: Math.min(120, Math.max(36, distance * 0.24)),
        });
      });
    }

    const bettingActions = new Set(['bet', 'call', 'raise', 'allin', 'all-in']);
    if (!handProgressed) {
      seats.forEach((seat, idx) => {
        const previousSeat = previousSnapshot.seats[idx];
        if (!seat || !previousSeat) return;

        const previousBet = Number(previousSeat.bet_in_round ?? 0);
        const currentBet = Number(seat.bet_in_round ?? 0);
        const action = (seat.last_action ?? '').toLowerCase();
        if (currentBet <= previousBet || !bettingActions.has(action)) return;

        const from = getSeatStackPoint(idx);
        const to = getSeatBetPoint(idx);
        const chipDelta = currentBet - previousBet;
        const distance = from && to ? Math.hypot(to.x - from.x, to.y - from.y) : 0;
        const delayStep = ANIM_TIMINGS.chipStaggerMinMs + Math.round(Math.random() * (ANIM_TIMINGS.chipStaggerMaxMs - ANIM_TIMINGS.chipStaggerMinMs));
        enqueueChipFlight({
          kind: 'bet',
          from,
          to,
          amount: chipDelta,
          delayMs: idx * delayStep,
          durationMs: ANIM_TIMINGS.quickMs + 220,
          arcHeight: Math.min(96, Math.max(24, distance * 0.2)),
        });
      });
    }

    previousTableSnapshotRef.current = currentSnapshot;
  }, [
    seats,
    phase,
    handNumber,
    getPotAnchorPoint,
    getSeatStackPoint,
    getSeatBetPoint,
    enqueueChipFlight,
  ]);

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
          <div
            ref={tableStageRef}
            style={{ position: 'relative', width: '100%', height: '100%', maxWidth: 900, margin: '0 auto' }}
          >

            {/* Feltro */}
            <div ref={feltRef} style={{ position: 'absolute', inset: '8% 3%', background: 'radial-gradient(ellipse at center,#2d7a4a 0%,#1a5233 55%,#0e2e1c 100%)', borderRadius: '50%', border: '8px solid #3a2a12', boxShadow: 'inset 0 0 40px rgba(0,0,0,0.35),0 20px 60px rgba(0,0,0,0.55),inset 0 0 80px rgba(45,122,74,0.15)' }}>
              <div style={{ position: 'absolute', inset: 14, borderRadius: '50%', border: '1px solid rgba(212,175,55,0.18)' }} />
              <div style={{ position: 'absolute', top: '27%', left: '50%', transform: 'translateX(-50%)', fontFamily: 'Playfair Display, serif', fontSize: 24, color: 'rgba(212,175,55,0.18)', fontStyle: 'italic', userSelect: 'none', whiteSpace: 'nowrap' }}>
                Ridotto
              </div>

              {/* Centro: Piatto o attesa giocatori */}
              <div ref={potAnchorRef} style={{ position: 'absolute', top: '63%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', minWidth: 130 }}>
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

              <div
                ref={deckAnchorRef}
                style={{
                  position: 'absolute',
                  top: '45%',
                  left: '37.5%',
                  transform: 'translate(-50%,-50%)',
                  width: 1,
                  height: 1,
                  opacity: 0,
                  pointerEvents: 'none',
                  zIndex: 0,
                }}
              />

              {/* Carte comuni */}
              <div ref={communityAnchorRef} style={{ position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%,-50%)', display: 'flex', gap: 5, zIndex: 2 }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    ref={(node) => setCommunityCardRef(i, node)}
                    style={{ transition: 'opacity 0.35s,transform 0.35s', opacity: community[i] ? 1 : 0, transform: community[i] ? 'translateY(0)' : 'translateY(-8px)' }}
                  >
                    {community[i]
                      ? (
                        communityRevealTokens[i]
                          ? (
                            <FlipRevealCard
                              card={community[i]}
                              size="md"
                              cardBack={cardBack}
                              triggerKey={`${communityRevealTokens[i]}-${community[i]}`}
                              durationMs={Math.max(ANIM_TIMINGS.revealMinMs, 620)}
                            />
                          )
                          : <Card card={community[i]} size="md" cardBack={cardBack} />
                      )
                      : <div style={{ width: 50, height: 72, border: '1px dashed rgba(212,175,55,0.07)', borderRadius: 5 }} />
                    }
                  </div>
                ))}
              </div>
            </div>

            {/* Overlay scaffolding per animazioni future (carte/chips/piatto) */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                overflow: 'hidden',
                zIndex: TABLE_ANIMATION_TOKENS.zLayers.overlays,
              }}
            >
              <div ref={(node) => setOverlayLayerRef('cards', node)} data-anim-layer="cards-flight" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {cardFlights.map((flight) => (
                  <FlightCard key={flight.id} flight={flight} cardBack={cardBack} />
                ))}
              </div>
              <div ref={(node) => setOverlayLayerRef('chips', node)} data-anim-layer="chips-flight" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {chipFlights.map((flight) => {
                  const elapsedMs = chipFlightNow - flight.startAt;
                  const baseProgress = Math.max(0, Math.min(1, elapsedMs / Math.max(1, flight.durationMs)));
                  const easedProgress = 1 - ((1 - baseProgress) ** 3);
                  const fadeProgress = elapsedMs > flight.durationMs
                    ? Math.max(0, 1 - ((elapsedMs - flight.durationMs) / Math.max(1, ANIM_TIMINGS.chipFadeMs)))
                    : 1;
                  const opacity = elapsedMs < 0 ? 0 : fadeProgress;
                  if (opacity <= 0) return null;

                  const x = flight.from.x + ((flight.to.x - flight.from.x) * easedProgress);
                  const baseY = flight.from.y + ((flight.to.y - flight.from.y) * easedProgress);
                  const arcLift = Math.sin(Math.PI * baseProgress) * flight.arcHeight;
                  const y = baseY - arcLift;
                  const isCollect = flight.kind === 'collect';
                  const glow = isCollect ? '0 0 14px rgba(212,175,55,0.55)' : '0 0 10px rgba(232,194,82,0.42)';
                  const stackCount = Math.max(2, Math.min(5, Math.ceil((flight.amount ?? 0) / 25)));

                  return (
                    <div key={flight.id} style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%,-50%)', opacity, pointerEvents: 'none' }}>
                      <div style={{ position: 'relative', width: 24, height: 10 + (stackCount * 2.5), filter: `drop-shadow(${glow})` }}>
                        {Array.from({ length: stackCount }).map((_, stackIdx) => (
                          <div
                            key={stackIdx}
                            style={{
                              position: 'absolute',
                              left: 0,
                              bottom: stackIdx * 2.5,
                              width: 24,
                              height: 7,
                              borderRadius: 5,
                              background: isCollect
                                ? 'radial-gradient(ellipse at 30% 30%,#E8C252,#8f761f)'
                                : 'radial-gradient(ellipse at 30% 30%,#f0ce69,#9a7b24)',
                              border: '0.6px solid rgba(0,0,0,0.45)',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div ref={(node) => setOverlayLayerRef('pot', node)} data-anim-layer="pot-effects" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {potPayoutFlights.map((flight) => {
                  const elapsedMs = chipFlightNow - flight.startAt;
                  const baseProgress = Math.max(0, Math.min(1, elapsedMs / Math.max(1, flight.durationMs)));
                  const easedProgress = 1 - ((1 - baseProgress) ** 3);
                  const fadeProgress = elapsedMs > flight.durationMs
                    ? Math.max(0, 1 - ((elapsedMs - flight.durationMs) / Math.max(1, ANIM_TIMINGS.chipFadeMs)))
                    : 1;
                  const opacity = elapsedMs < 0 ? 0 : fadeProgress;
                  if (opacity <= 0) return null;

                  const x = flight.from.x + ((flight.to.x - flight.from.x) * easedProgress);
                  const baseY = flight.from.y + ((flight.to.y - flight.from.y) * easedProgress);
                  const arcLift = Math.sin(Math.PI * baseProgress) * flight.arcHeight;
                  const y = baseY - arcLift;
                  const stackCount = Math.max(2, Math.min(7, Math.ceil((flight.amount ?? 0) / 20)));

                  return (
                    <div key={flight.id} style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) scale(${0.95 + (0.05 * easedProgress)})`, opacity, pointerEvents: 'none' }}>
                      <div style={{ position: 'relative', width: 24, height: 10 + (stackCount * 2.5), filter: 'drop-shadow(0 0 16px rgba(212,175,55,0.65))' }}>
                        {Array.from({ length: stackCount }).map((_, stackIdx) => (
                          <div
                            key={stackIdx}
                            style={{
                              position: 'absolute',
                              left: 0,
                              bottom: stackIdx * 2.5,
                              width: 24,
                              height: 7,
                              borderRadius: 5,
                              background: 'radial-gradient(ellipse at 30% 30%,#F0CF6A,#9C7B23)',
                              border: '0.6px solid rgba(0,0,0,0.45)',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
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
                timerTrigger={timerTrigger}
                phase={phase}
                cardBack={cardBack}
                showdownResult={showdownResults?.find((r) => r.seat === idx) ?? null}
                showdownReveal={showdownRevealTokens[idx] ?? null}
                anchorRef={(node) => setSeatAnchorRef(idx, node)}
                cardAnchorRef={(node) => setSeatCardAnchorRef(idx, node)}
                stackAnchorRef={(node) => setSeatStackAnchorRef(idx, node)}
                betAnchorRef={(node) => setSeatBetAnchorRef(idx, node)}
                onEmptyClick={() => handleSeatClick(idx)}
                seatDelta={seatDeltas[String(idx)] ?? seatDeltas[idx] ?? null}
              />
            ))}

            {/* Tournament panel */}
            {isTournament && (
              <TournamentPanel
                tournament={tournament}
                blindLevelEndsAt={blindLevelEndsAt}
                seats={seats}
                eliminatedPlayers={eliminatedPlayers}
                myUserId={user?.id ?? null}
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

          {/* ── Saldo profilo + ricarica ────────────────────────────────── */}
          {mySeat !== null && !isTournament && (
            <RebuyWidget
              profileBalance={profileBalance}
              myStack={myStack}
              showRebuy={showRebuy}
              setShowRebuy={setShowRebuy}
              sendRebuy={sendRebuy}
            />
          )}

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
                  {tab === 'mano' ? 'CRONOLOGIA' : 'CHAT'}
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
      {!isTournament && showBuyin && selectedSeat !== null && (
        <BuyinDialog
          isOpen={true}
          seat={selectedSeat}
          tableConfig={tableConfig}
          userBalance={user?.chips_balance ?? 0}
          onConfirm={(seat, amount) => { joinSeat?.(seat, amount); setShowBuyin(false); setSelectedSeat(null); }}
          onClose={() => { setShowBuyin(false); setSelectedSeat(null); }}
        />
      )}

      {/* ── Toast vincitore / pareggio ──────────────────────────────────── */}
      {handWinner && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          {handWinner.is_split ? (
            /* ── PAREGGIO ── */
            <div style={{
              background: 'rgba(0,0,0,0.82)',
              border: '2px solid rgba(100,200,255,0.55)',
              borderRadius: 14,
              padding: '22px 48px',
              textAlign: 'center',
              backdropFilter: 'blur(8px)',
              animation: 'fadeInOut 4s forwards',
            }}>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, color: '#7EC8E3', fontWeight: 700, letterSpacing: 1 }}>
                🤝 PAREGGIO!
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#aaa', marginTop: 4, marginBottom: 10 }}>
                Piatto diviso — {(handWinner.pot ?? 0).toLocaleString('it-IT')} chips totali
              </div>
              {handWinner.players?.map((p, i) => (
                <div key={i} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 15, color: '#F5F1E8', marginTop: 4 }}>
                  <span style={{ color: '#7EC8E3', fontWeight: 600 }}>{p.name}</span>
                  {' '}+{(p.amount ?? 0).toLocaleString('it-IT')} chips
                </div>
              ))}
            </div>
          ) : (
            /* ── VINCITORE SINGOLO ── */
            <div style={{
              background: 'rgba(0,0,0,0.78)',
              border: '1px solid rgba(212,175,55,0.45)',
              borderRadius: 14,
              padding: '22px 48px',
              textAlign: 'center',
              backdropFilter: 'blur(8px)',
              animation: 'fadeInOut 4s forwards',
            }}>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: '#D4AF37', fontWeight: 600 }}>
                🏆 {handWinner.name} vince!
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, color: '#F5F1E8', marginTop: 6 }}>
                +{Math.abs(handWinner.amount ?? 0).toLocaleString('it-IT')} chips
              </div>
            </div>
          )}
        </div>
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
          currentUsername={user?.username ?? null}
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
