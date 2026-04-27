// chips.jsx — Chips + pila davanti al giocatore + animazioni bet (arco) e win (slide pila intera).
// Espone: <ChipStack />, <ChipInFlight />, chipBreakdown(amount)

// Palette chip stile casino (valori crescenti)
const CHIP_DENOMS = [
  { v: 1000, base: '#1b1b1b', accent: '#f2d58c', label: 'K' },
  { v: 500,  base: '#5c2a8a', accent: '#ead9ff', label: '500' },
  { v: 100,  base: '#1c1c1c', accent: '#ffffff', label: '100' },
  { v: 25,   base: '#1f6b3a', accent: '#e9f5ec', label: '25' },
  { v: 5,    base: '#b22828', accent: '#ffe2dc', label: '5' },
  { v: 1,    base: '#e6e3d8', accent: '#3a3a3a', label: '1' },
];

// Greedy break down an amount into a list of chip denominations (max ~24 visible)
function chipBreakdown(amount) {
  let a = amount;
  const out = [];
  for (const d of CHIP_DENOMS) {
    while (a >= d.v && out.length < 24) {
      out.push(d);
      a -= d.v;
    }
  }
  return out;
}

// Inject chip styles
if (typeof document !== 'undefined' && !document.getElementById('chip-styles')) {
  const s = document.createElement('style');
  s.id = 'chip-styles';
  s.textContent = `
    .pk-chip {
      position: absolute;
      width: 22px; height: 22px;
      border-radius: 50%;
      box-shadow: 0 1px 0 rgba(0,0,0,0.3), 0 2px 3px rgba(0,0,0,0.4);
      display: flex; align-items: center; justify-content: center;
      font: 700 7px/1 'Inter', system-ui, sans-serif;
      letter-spacing: 0.5px;
    }
    .pk-chip::before {
      content: '';
      position: absolute; inset: 3px;
      border-radius: 50%;
      border: 1.5px dashed currentColor;
      opacity: 0.6;
    }
    .pk-chip-stack {
      position: absolute;
      pointer-events: none;
      transition: left 600ms cubic-bezier(.4,0,.2,1), top 600ms cubic-bezier(.4,0,.2,1), opacity 250ms;
    }
    .pk-chip-flight {
      position: absolute;
      will-change: transform, offset-distance;
      pointer-events: none;
    }
    @keyframes chip-flight {
      0%   { offset-distance: 0%; transform: scale(1); }
      100% { offset-distance: 100%; transform: scale(1); }
    }
    .pk-chip-label {
      position: absolute;
      font: 500 10px/1 'Inter', system-ui, sans-serif;
      color: #e8c87a;
      white-space: nowrap;
      letter-spacing: 0.5px;
      text-shadow: 0 1px 2px rgba(0,0,0,0.8);
    }
    .pk-pot-glow {
      position: absolute;
      width: 120px; height: 120px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(232,200,122,0.25) 0%, transparent 65%);
      pointer-events: none;
      transform: translate(-50%, -50%);
      opacity: 0;
      transition: opacity 400ms;
    }
    .pk-pot-glow.on { opacity: 1; }
  `;
  document.head.appendChild(s);
}

// One chip visual
function Chip({ denom, style }) {
  return (
    <div
      className="pk-chip"
      style={{
        background: `radial-gradient(circle at 35% 30%, ${denom.accent}22, ${denom.base} 60%)`,
        color: denom.accent,
        ...style,
      }}
    >
      <span style={{ position: 'relative', zIndex: 1 }}>{denom.label}</span>
    </div>
  );
}

// Stacked pile of chips at (x,y). amount determines chip composition.
// The pile is split into up to 3 small columns for legibility.
function ChipStack({ x, y, amount, label, visible = true, z = 2 }) {
  if (!amount || amount <= 0) return null;
  const breakdown = chipBreakdown(amount);
  // split into up to 3 columns
  const cols = Math.min(3, Math.max(1, Math.ceil(breakdown.length / 8)));
  const columns = Array.from({ length: cols }, () => []);
  breakdown.forEach((d, i) => columns[i % cols].push(d));
  const colW = 22;
  const gap = 2;
  const totalW = cols * colW + (cols - 1) * gap;
  return (
    <div
      className="pk-chip-stack"
      style={{
        left: x - totalW / 2,
        top: y,
        width: totalW,
        opacity: visible ? 1 : 0,
        zIndex: z,
      }}
    >
      {columns.map((col, ci) => (
        <div key={ci} style={{ position: 'absolute', left: ci * (colW + gap), top: 0 }}>
          {col.map((d, i) => (
            <Chip
              key={i}
              denom={d}
              style={{ left: 0, top: -i * 3 }}
            />
          ))}
        </div>
      ))}
      {label != null && (
        <div
          className="pk-chip-label"
          style={{ left: 0, top: -columns[0].length * 3 - 16, width: totalW, textAlign: 'center' }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

// Single chip in flight along a quadratic arc from (x0,y0) to (x1,y1).
// Uses CSS offset-path so we get a true parabolic arc with rotation.
// delay in ms staggers multiple chips.
function ChipInFlight({ denom, x0, y0, x1, y1, delay = 0, durationMs = 550, onDone }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!ref.current) return;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const cx = (x0 + x1) / 2;
    // arc height scales with distance
    const cy = (y0 + y1) / 2 - Math.max(60, dist * 0.35);
    const path = `path('M ${x0} ${y0} Q ${cx} ${cy} ${x1} ${y1}')`;
    const el = ref.current;
    el.style.offsetPath = path;
    el.style.webkitOffsetPath = path;
    el.style.animation = `chip-flight ${durationMs}ms cubic-bezier(.4,0,.3,1) ${delay}ms forwards`;
    const t = setTimeout(() => onDone && onDone(), delay + durationMs + 10);
    return () => clearTimeout(t);
  }, []);
  return (
    <div ref={ref} className="pk-chip-flight" style={{ zIndex: 50 }}>
      <Chip denom={denom} style={{ position: 'relative', left: -11, top: -11 }} />
    </div>
  );
}

Object.assign(window, { ChipStack, ChipInFlight, Chip, chipBreakdown, CHIP_DENOMS });
