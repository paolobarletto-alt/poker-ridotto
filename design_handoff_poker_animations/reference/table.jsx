// table.jsx — Il tavolo da poker: feltro ovale, seats, mazzo, pot, community cards.
// Esporta PokerTable component che accetta config (speed, variant, etc).

const TABLE_W = 1040;
const TABLE_H = 580;
const FELT_RX = 460;
const FELT_RY = 230;
const CX = TABLE_W / 2;
const CY = TABLE_H / 2 + 10;

const SEAT_NAMES = [
  'Marco', 'Lucia', 'Dario', 'Elena', 'Paolo',
  'Sofia', 'Andrea', 'Giulia', 'Marco V.', 'Chiara',
];

// 10 seat positions around the oval. Angles start from bottom (player POV) going clockwise.
function seatPositions(n = 10) {
  const out = [];
  // Distribute evenly around an ellipse slightly larger than the felt
  const rx = FELT_RX + 38;
  const ry = FELT_RY + 48;
  for (let i = 0; i < n; i++) {
    const ang = (Math.PI / 2) + (Math.PI * 2 * i) / n; // start at bottom
    out.push({
      x: CX + rx * Math.cos(ang),
      y: CY + ry * Math.sin(ang),
      ang,
    });
  }
  return out;
}

// Position of the two hole cards for a seat — slightly offset sideways.
function holeCardPos(seat, idx) {
  // unit vector from seat toward table center
  const dx = CX - seat.x;
  const dy = CY - seat.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  // perpendicular
  const px = -uy, py = ux;
  const inward = 58;
  const offset = idx === 0 ? -16 : 16;
  return {
    x: seat.x + ux * inward + px * offset,
    y: seat.y + uy * inward + py * offset,
    rot: Math.atan2(uy, ux) * 180 / Math.PI - 90,
  };
}

// Community card positions — 5 cards in a row at center-top
function communityPos(i) {
  const gap = 6;
  const w = 62; // slightly bigger
  const total = 5 * w + 4 * gap;
  return {
    x: CX - total / 2 + w / 2 + i * (w + gap),
    y: CY - 30,
    rot: 0,
  };
}

// Pot chip stack position
const POT_POS = { x: CX, y: CY + 40 };
// Deck position (right side, near dealer area)
const DECK_POS = { x: CX + 140, y: CY - 90 };

// Chip stack position in front of a seat (for player's stack)
function seatStackPos(seat) {
  const dx = CX - seat.x, dy = CY - seat.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: seat.x + (dx / len) * 108,
    y: seat.y + (dy / len) * 108,
  };
}

// Bet chip stack position (between seat stack and pot)
function seatBetPos(seat) {
  const dx = CX - seat.x, dy = CY - seat.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x: seat.x + (dx / len) * 168,
    y: seat.y + (dy / len) * 168,
  };
}

// Seat avatar
function Seat({ seat, name, stack, active, folded, isDealer, timerPct, variant }) {
  const size = 64;
  const ringCol = active ? '#e8c87a' : (folded ? 'rgba(150,130,90,0.25)' : 'rgba(180,150,90,0.55)');
  return (
    <div
      style={{
        position: 'absolute',
        left: seat.x - size / 2,
        top: seat.y - size / 2,
        width: size, height: size,
        zIndex: 3,
        opacity: folded ? 0.45 : 1,
        transition: 'opacity 300ms',
      }}
    >
      {/* turn timer ring */}
      {active && (
        <svg width={size + 10} height={size + 10} style={{ position: 'absolute', left: -5, top: -5 }}>
          <circle
            cx={(size + 10) / 2} cy={(size + 10) / 2} r={(size + 6) / 2}
            fill="none" stroke="rgba(232,200,122,0.18)" strokeWidth="2"
          />
          <circle
            cx={(size + 10) / 2} cy={(size + 10) / 2} r={(size + 6) / 2}
            fill="none" stroke="#f5dc9a" strokeWidth="2.5"
            strokeDasharray={`${Math.PI * (size + 6)}`}
            strokeDashoffset={`${Math.PI * (size + 6) * (1 - timerPct)}`}
            transform={`rotate(-90 ${(size + 10) / 2} ${(size + 10) / 2})`}
            style={{ transition: 'stroke-dashoffset 120ms linear' }}
          />
        </svg>
      )}
      {/* avatar circle */}
      <div style={{
        position: 'absolute', inset: 0,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 30%, #3a3024, #1f1914)',
        border: `2px solid ${ringCol}`,
        boxShadow: active ? '0 0 18px rgba(232,200,122,0.4)' : '0 2px 6px rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#d9c79a',
        fontFamily: 'Cormorant Garamond, Georgia, serif',
        fontSize: 22, fontWeight: 600,
        transition: 'box-shadow 200ms, border-color 200ms',
      }}>
        {name ? name[0] : ''}
      </div>
      {/* name + stack plate */}
      <div style={{
        position: 'absolute',
        left: -16, right: -16,
        top: size + 4,
        textAlign: 'center',
        color: '#c9b685',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 10,
        letterSpacing: 0.5,
        whiteSpace: 'nowrap',
      }}>
        <div style={{ fontSize: 11, color: '#e8c87a' }}>{name}</div>
        <div style={{ fontSize: 10, color: '#a89568', marginTop: 1 }}>€{stack}</div>
      </div>
      {/* dealer button */}
      {isDealer && (
        <div style={{
          position: 'absolute',
          left: size - 8, top: size - 10,
          width: 22, height: 22,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, #fff, #d6cbb0)',
          color: '#2a1e10',
          fontFamily: 'Cormorant Garamond, serif',
          fontWeight: 700, fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.6), 0 0 0 1.5px #8a6a2a inset',
          transition: 'left 600ms cubic-bezier(.4,0,.2,1), top 600ms cubic-bezier(.4,0,.2,1)',
          zIndex: 4,
        }}>D</div>
      )}
    </div>
  );
}

// Oval felt background — recreates the reference screenshot.
function Felt() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <svg width={TABLE_W} height={TABLE_H} style={{ display: 'block' }}>
        <defs>
          <radialGradient id="felt-grad" cx="50%" cy="52%" r="55%">
            <stop offset="0%" stopColor="#2b6b3d" />
            <stop offset="55%" stopColor="#1e5430" />
            <stop offset="100%" stopColor="#0e3a20" />
          </radialGradient>
          <linearGradient id="wood-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8a5a2a" />
            <stop offset="45%" stopColor="#6e4320" />
            <stop offset="100%" stopColor="#4a2d14" />
          </linearGradient>
          <filter id="inner-shadow">
            <feGaussianBlur in="SourceAlpha" stdDeviation="8" />
            <feOffset dy="4" />
            <feComposite in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" />
            <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.6 0"/>
            <feComposite in2="SourceGraphic" operator="in"/>
          </filter>
        </defs>
        {/* Wood rim */}
        <ellipse cx={CX} cy={CY} rx={FELT_RX + 28} ry={FELT_RY + 28} fill="url(#wood-grad)" />
        {/* Gold inner line */}
        <ellipse cx={CX} cy={CY} rx={FELT_RX + 10} ry={FELT_RY + 10} fill="none" stroke="#b89456" strokeWidth="1.5" opacity="0.7" />
        {/* Felt */}
        <ellipse cx={CX} cy={CY} rx={FELT_RX} ry={FELT_RY} fill="url(#felt-grad)" filter="url(#inner-shadow)" />
        {/* Thin inner stitch line */}
        <ellipse cx={CX} cy={CY} rx={FELT_RX - 20} ry={FELT_RY - 20} fill="none" stroke="rgba(232,200,122,0.18)" strokeWidth="1" strokeDasharray="2 4" />
        {/* Center watermark */}
        <text
          x={CX} y={CY - 70}
          textAnchor="middle"
          fontFamily="Cormorant Garamond, Georgia, serif"
          fontSize="28"
          fontStyle="italic"
          fill="rgba(232,200,122,0.18)"
          letterSpacing="2"
        >Ridotto</text>
      </svg>
    </div>
  );
}

// Deck stack at dealer position
function Deck({ cardsLeft }) {
  const n = Math.max(1, Math.min(18, Math.ceil(cardsLeft / 3)));
  return (
    <div style={{ position: 'absolute', left: DECK_POS.x - 26, top: DECK_POS.y - 37, width: 52, height: 74, zIndex: 1 }}>
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: -i * 0.3,
            top: -i * 0.5,
            width: 52, height: 74,
            borderRadius: 5,
            background: 'repeating-linear-gradient(45deg, #8b1a1a 0 4px, #6e1212 4px 8px), #7a1616',
            border: '1.5px solid #e8c87a',
            boxShadow: i === n - 1 ? '0 3px 10px rgba(0,0,0,0.5)' : 'none',
          }}
        />
      ))}
    </div>
  );
}

Object.assign(window, {
  TABLE_W, TABLE_H, CX, CY, DECK_POS, POT_POS,
  seatPositions, holeCardPos, communityPos, seatStackPos, seatBetPos,
  Seat, Felt, Deck, SEAT_NAMES,
});
