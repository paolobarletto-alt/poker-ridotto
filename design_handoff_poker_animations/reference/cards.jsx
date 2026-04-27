// cards.jsx — Carte da gioco con flip bounce e animazione di volo dal mazzo
// Espone: <Card />, CARD_W, CARD_H, SUITS, RANKS, buildDeck()

const CARD_W = 52;
const CARD_H = 74;

const SUITS = [
  { s: '♠', c: '#1a1a1a', name: 'spades' },
  { s: '♥', c: '#b3261e', name: 'hearts' },
  { s: '♦', c: '#b3261e', name: 'diamonds' },
  { s: '♣', c: '#1a1a1a', name: 'clubs' },
];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

function buildDeck() {
  const d = [];
  for (const s of SUITS) for (const r of RANKS) d.push({ r, s: s.s, c: s.c });
  // shuffle
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// Inject card styles once
if (typeof document !== 'undefined' && !document.getElementById('card-styles')) {
  const s = document.createElement('style');
  s.id = 'card-styles';
  s.textContent = `
    .pk-card-wrap {
      position: absolute;
      width: ${CARD_W}px;
      height: ${CARD_H}px;
      transform-style: preserve-3d;
      pointer-events: none;
      will-change: transform;
    }
    .pk-card-face {
      position: absolute; inset: 0;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      border-radius: 5px;
      box-shadow: 0 3px 8px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .pk-card-back {
      background:
        repeating-linear-gradient(45deg, #8b1a1a 0 4px, #6e1212 4px 8px),
        #7a1616;
      border: 2px solid #e8c87a;
      box-sizing: border-box;
      display: flex; align-items: center; justify-content: center;
    }
    .pk-card-back::after {
      content: '';
      position: absolute; inset: 4px;
      border: 1px solid rgba(232, 200, 122, 0.4);
      border-radius: 3px;
    }
    .pk-card-back-emblem {
      width: 22px; height: 22px;
      border-radius: 50%;
      background: radial-gradient(circle, #e8c87a 30%, transparent 32%);
      box-shadow: 0 0 0 1px rgba(232, 200, 122, 0.6) inset;
    }
    .pk-card-front {
      background: linear-gradient(180deg, #fefcf6 0%, #f5f0e2 100%);
      transform: rotateY(180deg);
      padding: 4px 5px;
      display: flex; flex-direction: column;
      font-family: 'Cormorant Garamond', Georgia, serif;
      font-weight: 600;
    }
    .pk-card-front .corner {
      display: flex; flex-direction: column;
      align-items: center;
      line-height: 0.95;
    }
    .pk-card-front .rank {
      font-size: 16px;
      letter-spacing: -0.5px;
    }
    .pk-card-front .suit-sm {
      font-size: 11px;
      margin-top: -1px;
    }
    .pk-card-front .big-suit {
      flex: 1;
      display: flex; align-items: center; justify-content: center;
      font-size: 30px;
      margin-top: -4px;
    }
  `;
  document.head.appendChild(s);
}

// A Card component driven by props. It is positioned absolutely at (x,y)
// in the table's coordinate space. rot is degrees. faceUp toggles the flip
// with a bounce. scale lets us make community cards bigger.
function Card({ x, y, rot = 0, faceUp = false, rank, suit, color, scale = 1, z = 0, visible = true, durationMs = 500 }) {
  const style = {
    left: x - CARD_W / 2,
    top: y - CARD_H / 2,
    transform: `rotate(${rot}deg) scale(${scale}) rotateY(${faceUp ? 180 : 0}deg)`,
    transition: `left ${durationMs}ms cubic-bezier(.4,1.3,.5,1), top ${durationMs}ms cubic-bezier(.4,1.3,.5,1), transform ${Math.max(durationMs, 420)}ms cubic-bezier(.34,1.56,.64,1), opacity 200ms ease`,
    zIndex: z,
    opacity: visible ? 1 : 0,
  };
  const suitColor = color || '#1a1a1a';
  return (
    <div className="pk-card-wrap" style={style}>
      <div className="pk-card-face pk-card-back">
        <div className="pk-card-back-emblem" />
      </div>
      <div className="pk-card-face pk-card-front" style={{ color: suitColor }}>
        <div className="corner" style={{ alignSelf: 'flex-start' }}>
          <span className="rank">{rank}</span>
          <span className="suit-sm">{suit}</span>
        </div>
        <div className="big-suit">{suit}</div>
        <div className="corner" style={{ alignSelf: 'flex-end', transform: 'rotate(180deg)' }}>
          <span className="rank">{rank}</span>
          <span className="suit-sm">{suit}</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Card, CARD_W, CARD_H, SUITS, RANKS, buildDeck });
