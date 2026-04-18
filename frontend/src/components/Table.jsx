import { useState, useEffect, useRef } from 'react';
import { GoldButton } from './Shell';

const SUITS = { '♠': '#0a0a0a', '♥': '#c0392b', '♦': '#c0392b', '♣': '#0a0a0a' };

// ————— Card back patterns —————
export const CARD_BACKS = {
  classico: {
    name: 'Classico Rosso',
    render: () => (
      <div style={{
        width: '100%', height: '100%',
        background: 'repeating-linear-gradient(45deg, #7a1a1a 0 4px, #5a0f0f 4px 8px)',
        border: '3px solid #fff', boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: '60%', height: '60%', border: '1.5px solid #D4AF37',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Playfair Display, serif', color: '#D4AF37', fontSize: 20,
          fontStyle: 'italic', fontWeight: 500,
        }}>R</div>
      </div>
    ),
  },
  ridotto: {
    name: 'Ridotto Oro',
    render: () => (
      <div style={{
        width: '100%', height: '100%',
        background: 'radial-gradient(ellipse at center, #1a3a25, #0a1810)',
        border: '2px solid #D4AF37', boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 4, border: '0.5px solid rgba(212,175,55,0.4)' }} />
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, color: '#D4AF37', fontStyle: 'italic' }}>♠</div>
      </div>
    ),
  },
  damier: {
    name: 'Damier',
    render: () => (
      <div style={{
        width: '100%', height: '100%',
        backgroundImage: 'linear-gradient(45deg, #0a1810 25%, transparent 25%), linear-gradient(-45deg, #0a1810 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #0a1810 75%), linear-gradient(-45deg, transparent 75%, #0a1810 75%)',
        backgroundSize: '10px 10px',
        backgroundColor: '#D4AF37',
        backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0',
        border: '2px solid #fff', boxSizing: 'border-box',
      }} />
    ),
  },
  minimale: {
    name: 'Minimale',
    render: () => (
      <div style={{
        width: '100%', height: '100%',
        background: '#0a0a0a',
        border: '1.5px solid #D4AF37', boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ width: 3, height: 3, background: '#D4AF37', borderRadius: '50%' }} />
      </div>
    ),
  },
  trama: {
    name: 'Trama',
    render: () => (
      <div style={{
        width: '100%', height: '100%', position: 'relative',
        background: 'linear-gradient(135deg, #2a1f0a 0%, #0a0a0a 100%)',
        border: '2px solid #B8941F', boxSizing: 'border-box', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 6px, rgba(212,175,55,0.15) 6px 7px), repeating-linear-gradient(90deg, transparent 0 6px, rgba(212,175,55,0.15) 6px 7px)',
        }} />
      </div>
    ),
  },
};

// ————— Card —————
export function Card({ card, size = 'md', cardBack = 'ridotto' }) {
  const sizes = {
    sm: { w: 38, h: 54, rank: 14, suit: 16 },
    md: { w: 52, h: 74, rank: 20, suit: 22 },
    lg: { w: 64, h: 92, rank: 26, suit: 30 },
  };
  const s = sizes[size];

  if (!card || card === 'back') {
    return (
      <div style={{ width: s.w, height: s.h, borderRadius: 5, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
        {CARD_BACKS[cardBack].render()}
      </div>
    );
  }

  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  const color = SUITS[suit];

  return (
    <div style={{
      width: s.w, height: s.h, background: '#fafafa',
      borderRadius: 5, padding: '5px 6px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
      position: 'relative', fontFamily: 'Playfair Display, serif',
    }}>
      <div style={{ fontSize: s.rank, fontWeight: 600, color, lineHeight: 0.9 }}>{rank}</div>
      <div style={{ fontSize: s.rank * 0.78, color, lineHeight: 0.9, marginTop: 1 }}>{suit}</div>
      <div style={{ position: 'absolute', bottom: 5, right: 6, fontSize: s.suit, color, lineHeight: 1 }}>{suit}</div>
    </div>
  );
}

// ————— Chip stack —————
function ChipStack({ amount }) {
  if (!amount) return null;
  const count = Math.min(5, Math.ceil(amount / 20));
  return (
    <div style={{ position: 'relative', width: 20, height: 14 + count * 2 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', bottom: i * 2, left: 0,
          width: 20, height: 6, borderRadius: 3,
          background: 'radial-gradient(ellipse at 30% 30%, #E8C252, #8a6d1e)',
          border: '0.5px solid rgba(0,0,0,0.4)',
        }} />
      ))}
    </div>
  );
}

// ————— Seat —————
function Seat({ seat, pos, isHero, dealerBtn, cardBack }) {
  if (!seat) {
    return (
      <div style={{ position: 'absolute', ...pos, width: 130, transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
        <div style={{
          width: 62, height: 62, borderRadius: '50%',
          border: '1px dashed rgba(212,175,55,0.3)',
          margin: '0 auto',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'rgba(212,175,55,0.4)', fontSize: 10, letterSpacing: '0.2em',
          fontFamily: 'Inter, sans-serif',
        }}>VUOTO</div>
      </div>
    );
  }

  const { folded, acting } = seat;

  return (
    <div style={{
      position: 'absolute', ...pos, transform: 'translate(-50%, -50%)',
      width: 150, textAlign: 'center',
      opacity: folded ? 0.35 : 1, transition: 'opacity 0.3s',
    }}>
      {seat.cards && (
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 2, marginBottom: 6,
          transform: isHero ? 'scale(1.15)' : 'none',
        }}>
          {seat.cards.map((c, i) => (
            <div key={i} style={{ transform: `rotate(${i === 0 ? -4 : 4}deg)`, transformOrigin: 'bottom center' }}>
              <Card card={isHero ? c : 'back'} size={isHero ? 'md' : 'sm'} cardBack={cardBack} />
            </div>
          ))}
        </div>
      )}

      <div style={{
        background: acting
          ? 'linear-gradient(180deg, rgba(212,175,55,0.25), rgba(212,175,55,0.08))'
          : 'rgba(0,0,0,0.65)',
        border: acting ? '1px solid #D4AF37' : '1px solid rgba(212,175,55,0.15)',
        padding: '8px 12px 10px',
        backdropFilter: 'blur(6px)',
        boxShadow: acting ? '0 0 20px rgba(212,175,55,0.4)' : 'none',
        transition: 'all 0.2s',
      }}>
        <div style={{
          fontFamily: 'Inter, sans-serif', fontSize: 11.5, fontWeight: 500,
          color: '#F5F1E8', marginBottom: 3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{seat.name}</div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: acting ? '#D4AF37' : 'rgba(245,241,232,0.75)' }}>
          €{seat.stack.toLocaleString('it-IT')}
        </div>
      </div>

      {dealerBtn && (
        <div style={{
          position: 'absolute', top: -6, right: -6,
          width: 22, height: 22, borderRadius: '50%',
          background: '#fafafa', color: '#0a0a0a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Playfair Display, serif', fontSize: 11, fontWeight: 700,
          border: '1px solid #D4AF37', boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
        }}>D</div>
      )}

      {seat.lastAction && !folded && (
        <div style={{ marginTop: 4, fontSize: 9.5, letterSpacing: '0.2em', fontWeight: 600, color: '#D4AF37', fontFamily: 'Inter, sans-serif' }}>
          {seat.lastAction}
        </div>
      )}
      {folded && (
        <div style={{ marginTop: 4, fontSize: 9.5, letterSpacing: '0.2em', fontWeight: 600, color: 'rgba(245,241,232,0.5)', fontFamily: 'Inter, sans-serif' }}>
          FOLD
        </div>
      )}

      {seat.bet > 0 && !folded && (
        <div style={{ position: 'absolute', ...seat.betOffset, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ChipStack amount={seat.bet} />
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#D4AF37', whiteSpace: 'nowrap' }}>
            €{seat.bet}
          </span>
        </div>
      )}
    </div>
  );
}

// ————— PokerTable —————
export default function PokerTable({ cardBack = 'ridotto', onLeave }) {
  const [pot, setPot] = useState(0);
  const [community, setCommunity] = useState([]);
  const [phase, setPhase] = useState('preflop');
  const [raiseAmt, setRaiseAmt] = useState(40);
  const [log, setLog] = useState([
    { t: '21:34:12', txt: 'Mano #4,182,093 iniziata' },
    { t: '21:34:12', txt: 'Piccolo buio: Alessia €5' },
    { t: '21:34:12', txt: 'Grande buio: Marco €10' },
  ]);

  const seats = [
    { id: 1, name: 'Tu', stack: 1250, cards: ['A♠', 'K♥'], bet: 0, folded: false, acting: true,
      pos: { left: '50%', top: '88%' }, betOffset: { top: '-30px', left: '50%', transform: 'translateX(-50%)' }, isHero: true },
    { id: 2, name: 'Alessia_94', stack: 845, cards: ['back', 'back'], bet: 5, folded: false, lastAction: 'SB',
      pos: { left: '15%', top: '75%' }, betOffset: { top: '-22px', right: '-10px' } },
    { id: 3, name: 'Marco.R', stack: 2140, cards: ['back', 'back'], bet: 10, folded: false, lastAction: 'BB',
      pos: { left: '5%', top: '40%' }, betOffset: { top: '20px', right: '-10px' } },
    { id: 4, name: 'il_nonno', stack: 620, cards: ['back', 'back'], bet: 0, folded: true,
      pos: { left: '25%', top: '10%' }, betOffset: { bottom: '-22px', left: '50%' } },
    { id: 5, name: 'Giulia_88', stack: 1580, cards: ['back', 'back'], bet: 40, folded: false, lastAction: 'RAISE',
      pos: { left: '50%', top: '5%' }, betOffset: { bottom: '-28px', left: '50%', transform: 'translateX(-50%)' } },
    { id: 6, name: 'Pietro_L', stack: 980, cards: ['back', 'back'], bet: 0, folded: true,
      pos: { left: '75%', top: '10%' }, betOffset: { bottom: '-22px', left: '-10px' } },
    { id: 7, name: 'CarloFrancesco', stack: 3120, cards: ['back', 'back'], bet: 40, folded: false, lastAction: 'CALL',
      pos: { left: '95%', top: '40%' }, betOffset: { top: '20px', left: '-10px' } },
    { id: 8, name: 'Sara.P', stack: 0, cards: null, bet: 0, folded: false,
      pos: { left: '85%', top: '75%' }, betOffset: {} },
  ];

  useEffect(() => {
    setPot(5 + 10 + 40 + 40);
    const phases = [
      { at: 2500, do: () => { setCommunity(['10♥', 'J♠', 'Q♦']); setPhase('flop'); setLog(l => [{ t: '21:34:18', txt: 'FLOP: 10♥  J♠  Q♦' }, ...l]); } },
      { at: 5500, do: () => { setCommunity(c => [...c, '9♣']); setPhase('turn'); setLog(l => [{ t: '21:34:24', txt: 'TURN: 9♣' }, ...l]); } },
      { at: 8500, do: () => { setCommunity(c => [...c, '2♠']); setPhase('river'); setLog(l => [{ t: '21:34:30', txt: 'RIVER: 2♠' }, ...l]); } },
    ];
    const timers = phases.map(p => setTimeout(p.do, p.at));
    return () => timers.forEach(clearTimeout);
  }, []);

  const handleAction = (action) => {
    const time = new Date().toLocaleTimeString('it-IT');
    const txt = {
      fold:  'Tu: FOLD',
      call:  `Tu: CALL €40`,
      raise: `Tu: RAISE €${raiseAmt}`,
      check: 'Tu: CHECK',
    }[action];
    setLog(l => [{ t: time, txt }, ...l]);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'radial-gradient(ellipse at center, #0a1810 0%, #050a07 100%)' }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px', borderBottom: '1px solid rgba(212,175,55,0.1)',
        background: 'rgba(0,0,0,0.4)',
      }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '0.22em', color: 'rgba(245,241,232,0.5)' }}>TAVOLO #4.182</div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, color: '#F5F1E8', marginTop: 2 }}>
            No-Limit Hold'em <span style={{ color: '#D4AF37', fontStyle: 'italic' }}>— €0.50/€1</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: 'rgba(245,241,232,0.7)' }}>
            <span style={{ color: 'rgba(245,241,232,0.45)' }}>Mano</span>{' '}
            <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>#4,182,093</span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(245,241,232,0.7)' }}>
            <span style={{ color: 'rgba(245,241,232,0.45)' }}>Seduti</span>{' '}
            <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>6/8</span>
          </div>
          <GoldButton variant="ghost" size="sm" onClick={onLeave}>Abbandona ↩</GoldButton>
        </div>
      </div>

      {/* Table + log sidebar */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Table area */}
        <div style={{ flex: 1, position: 'relative', padding: 20 }}>
          <div style={{ position: 'relative', width: '100%', height: '100%', maxWidth: 880, margin: '0 auto' }}>
            {/* Felt */}
            <div style={{
              position: 'absolute', inset: '10% 4%',
              background: 'radial-gradient(ellipse at center, #1a4a2e 0%, #0a2418 65%, #05140c 100%)',
              borderRadius: '50%',
              border: '8px solid #3a2818',
              boxShadow: 'inset 0 0 40px rgba(0,0,0,0.6), 0 20px 60px rgba(0,0,0,0.6)',
            }}>
              <div style={{ position: 'absolute', inset: 14, borderRadius: '50%', border: '1px solid rgba(212,175,55,0.12)' }} />
              <div style={{
                position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)',
                fontFamily: 'Playfair Display, serif', fontSize: 28,
                color: 'rgba(212,175,55,0.15)', fontStyle: 'italic',
              }}>Ridotto</div>

              {/* Pot */}
              <div style={{ position: 'absolute', top: '58%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <div style={{ fontSize: 9, letterSpacing: '0.25em', color: 'rgba(245,241,232,0.5)', fontFamily: 'Inter, sans-serif', marginBottom: 4 }}>PIATTO</div>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: '#D4AF37', fontWeight: 500 }}>
                  €{pot.toLocaleString('it-IT')}
                </div>
              </div>

              {/* Community cards */}
              <div style={{ position: 'absolute', top: '42%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', gap: 5 }}>
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} style={{ transition: 'all 0.4s', transform: community[i] ? 'translateY(0)' : 'translateY(-8px)', opacity: community[i] ? 1 : 0 }}>
                    {community[i]
                      ? <Card card={community[i]} size="md" cardBack={cardBack} />
                      : <div style={{ width: 52, height: 74, border: '1px dashed rgba(212,175,55,0.1)', borderRadius: 5 }} />
                    }
                  </div>
                ))}
              </div>
            </div>

            {/* Seats */}
            {seats.map(s => (
              <Seat key={s.id} seat={s} pos={s.pos} isHero={s.isHero} dealerBtn={s.id === 7} cardBack={cardBack} />
            ))}
          </div>

          {/* Action bar */}
          <div style={{
            position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', gap: 10, alignItems: 'center',
            background: 'rgba(0,0,0,0.7)', padding: '12px 16px',
            border: '1px solid rgba(212,175,55,0.2)', backdropFilter: 'blur(10px)',
          }}>
            <GoldButton variant="ghost" size="sm" onClick={() => handleAction('fold')}>Fold</GoldButton>
            <GoldButton variant="ghost" size="sm" onClick={() => handleAction('call')}>Call €40</GoldButton>
            <GoldButton size="sm" onClick={() => handleAction('raise')}>Raise €{raiseAmt}</GoldButton>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
              <input type="range" min="40" max="1250" value={raiseAmt} onChange={e => setRaiseAmt(+e.target.value)}
                style={{ width: 110, accentColor: '#D4AF37' }} />
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#D4AF37', minWidth: 50 }}>
                €{raiseAmt}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, marginLeft: 4 }}>
              {[40, 80, 160, 1250].map(v => (
                <button key={v} onClick={() => setRaiseAmt(v)} style={{
                  background: 'transparent', border: '1px solid rgba(212,175,55,0.3)',
                  color: 'rgba(245,241,232,0.8)', padding: '4px 8px', fontSize: 9.5,
                  fontFamily: 'Inter, sans-serif', cursor: 'pointer', letterSpacing: '0.1em',
                }}>{v === 1250 ? 'ALL' : v}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Log sidebar */}
        <div style={{
          width: 260, flexShrink: 0, borderLeft: '1px solid rgba(212,175,55,0.1)',
          background: 'rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(212,175,55,0.1)' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.22em', color: '#D4AF37', fontWeight: 600 }}>STORICO MANO</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 18px', fontFamily: 'Inter, sans-serif' }}>
            {log.map((l, i) => (
              <div key={i} style={{
                padding: '7px 0', borderBottom: '1px solid rgba(245,241,232,0.05)',
                fontSize: 11.5, color: 'rgba(245,241,232,0.8)', lineHeight: 1.4,
              }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'rgba(245,241,232,0.4)', marginRight: 8 }}>{l.t}</span>
                {l.txt}
              </div>
            ))}
          </div>
          <div style={{
            padding: '12px 18px', borderTop: '1px solid rgba(212,175,55,0.1)',
            fontSize: 10.5, color: 'rgba(245,241,232,0.55)',
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span>Fase: <span style={{ color: '#D4AF37', textTransform: 'uppercase' }}>{phase}</span></span>
            <span>Tempo: <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#F5F1E8' }}>12s</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
