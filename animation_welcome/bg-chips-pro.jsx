// Variation B2: Floating Chips — upgraded
// Real 3D-feeling chips with perspective rotation, depth parallax, edge
// detail, motion blur at foreground, varied palette. No rigid orbits —
// chips drift and tumble through space like suspended in liquid air.

function BgChipsPro() {
  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      background: 'radial-gradient(ellipse 70% 55% at 50% 45%, #1a0f06 0%, #0a0604 50%, #040201 100%)',
      perspective: 1200,
      perspectiveOrigin: '50% 45%',
    }}>
      {/* caustic floor glow */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: 1600, height: 1000,
        transform: 'translate(-50%, -35%)',
        background: 'radial-gradient(ellipse at center, rgba(212,175,55,0.08) 0%, transparent 55%)',
        animation: 'chippro-glow 8s ease-in-out infinite',
        filter: 'blur(20px)',
        pointerEvents: 'none',
      }} />

      <ChipField />

      {/* atmospheric haze */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(10,6,3,0.5) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.6) 100%)',
        pointerEvents: 'none',
      }} />

      {/* vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 25%, rgba(0,0,0,0.85) 100%)',
        pointerEvents: 'none',
      }} />

      {/* grain */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.25, mixBlendMode: 'overlay', pointerEvents: 'none' }}>
        <filter id="chippro-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" />
          <feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.4  0 0 0 0 0.3  0 0 0 0.5 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#chippro-noise)" />
      </svg>

      <style>{`
        @keyframes chippro-glow {
          0%,100% { opacity: 0.7; transform: translate(-50%, -35%) scale(1); }
          50%     { opacity: 1;   transform: translate(-50%, -35%) scale(1.08); }
        }
        @keyframes chip-tumble {
          0%   { transform: translate3d(var(--x0), var(--y0), var(--z0)) rotateX(var(--rx0)) rotateY(var(--ry0)) rotateZ(var(--rz0)); }
          100% { transform: translate3d(var(--x1), var(--y1), var(--z1)) rotateX(var(--rx1)) rotateY(var(--ry1)) rotateZ(var(--rz1)); }
        }
        @keyframes chip-hero-spin {
          from { transform: translate3d(var(--x), var(--y), var(--z)) rotateY(0deg) rotateX(var(--tilt)); }
          to   { transform: translate3d(var(--x), var(--y), var(--z)) rotateY(360deg) rotateX(var(--tilt)); }
        }
      `}</style>
    </div>
  );
}

// Palette of casino-grade chips. Each has a base tint and an accent stripe.
const CHIP_PALETTE = [
  { base: '#8a1a28', accent: '#f5f5f0', name: 'burgundy' },
  { base: '#0f3d2a', accent: '#f5f5f0', name: 'emerald' },
  { base: '#1a1f3a', accent: '#d4af37', name: 'navy' },
  { base: '#1a1a1a', accent: '#d4af37', name: 'onyx' },
  { base: '#4a2a10', accent: '#f5f5f0', name: 'bronze' },
  { base: '#6a0f1a', accent: '#d4af37', name: 'crimson' },
];

function ChipField() {
  // Deterministic pseudo-random so SSR/re-render stays stable during the session
  const chips = React.useMemo(() => {
    const rng = mulberry32(42);
    const out = [];

    // BACKGROUND layer — small, distant, hazy. 16 chips
    for (let i = 0; i < 16; i++) {
      const palette = CHIP_PALETTE[Math.floor(rng() * CHIP_PALETTE.length)];
      out.push({
        id: 'bg' + i,
        layer: 'bg',
        size: 42 + rng() * 28,
        // spread wide so they frame the form from all sides
        x0: -20 + rng() * 140, y0: -10 + rng() * 120,
        x1: -20 + rng() * 140, y1: -10 + rng() * 120,
        z0: -600 - rng() * 400,
        z1: -600 - rng() * 400,
        rx0: rng() * 360, ry0: rng() * 360, rz0: rng() * 360,
        rx1: rng() * 720, ry1: rng() * 720, rz1: rng() * 720,
        dur: 40 + rng() * 30,
        delay: -rng() * 50,
        palette,
        blur: 2 + rng() * 2,
        opacity: 0.35 + rng() * 0.2,
      });
    }

    // MID layer — medium, varied, visible detail. 10 chips, positioned
    // AROUND the central form (avoid dead zone ~35-65% x, 15-75% y)
    const midSlots = [
      // left column
      { x: 8, y: 20 }, { x: 14, y: 55 }, { x: 4, y: 82 },
      // right column
      { x: 82, y: 18 }, { x: 90, y: 48 }, { x: 76, y: 78 },
      // top & bottom extremes
      { x: 28, y: 8 }, { x: 68, y: 10 }, { x: 22, y: 90 }, { x: 72, y: 88 },
    ];
    midSlots.forEach((slot, i) => {
      const palette = CHIP_PALETTE[i % CHIP_PALETTE.length];
      const drift = 6 + rng() * 8;
      out.push({
        id: 'mid' + i,
        layer: 'mid',
        size: 80 + rng() * 50,
        x0: slot.x, y0: slot.y,
        x1: slot.x + (rng() - 0.5) * drift,
        y1: slot.y + (rng() - 0.5) * drift,
        z0: -150 + rng() * 100,
        z1: -150 + rng() * 100,
        rx0: -30 + rng() * 60, ry0: rng() * 360, rz0: rng() * 360,
        rx1: -30 + rng() * 60, ry1: rng() * 720, rz1: rng() * 720,
        dur: 18 + rng() * 14,
        delay: -rng() * 30,
        palette,
        blur: 0,
        opacity: 1,
      });
    });

    // HERO layer — 3 big foreground chips, one spinning, slight motion blur
    const heroSlots = [
      { x: -2,  y: 62, tilt: 15,  big: true, spin: true },
      { x: 92,  y: 28, tilt: -20, big: true, spin: false },
      { x: 86,  y: 92, tilt: 25,  big: false, spin: false },
    ];
    heroSlots.forEach((slot, i) => {
      const palette = CHIP_PALETTE[i + 2];
      out.push({
        id: 'hero' + i,
        layer: 'hero',
        size: slot.big ? 220 : 160,
        x0: slot.x, y0: slot.y,
        x1: slot.x + (rng() - 0.5) * 4,
        y1: slot.y + (rng() - 0.5) * 4,
        z0: 120, z1: 120,
        rx0: slot.tilt, ry0: 0, rz0: rng() * 20 - 10,
        rx1: slot.tilt, ry1: slot.spin ? 360 : 30, rz1: rng() * 20 - 10,
        dur: slot.spin ? 22 : 14,
        delay: -rng() * 10,
        palette,
        blur: slot.big ? 3 : 1.5,
        opacity: slot.big ? 0.75 : 0.9,
        spin: slot.spin,
        tilt: slot.tilt,
      });
    });

    return out;
  }, []);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      transformStyle: 'preserve-3d',
    }}>
      {chips.map(c => <ChipNode key={c.id} c={c} />)}
    </div>
  );
}

function ChipNode({ c }) {
  const style = {
    position: 'absolute',
    left: c.x0 + '%', top: c.y0 + '%',
    width: c.size, height: c.size,
    marginLeft: -c.size / 2, marginTop: -c.size / 2,
    transformStyle: 'preserve-3d',
    filter: c.blur ? `blur(${c.blur}px)` : 'none',
    opacity: c.opacity,
    '--x0': '0px', '--y0': '0px', '--z0': c.z0 + 'px',
    '--x1': '0px', '--y1': '0px', '--z1': c.z1 + 'px',
    '--rx0': c.rx0 + 'deg', '--ry0': c.ry0 + 'deg', '--rz0': c.rz0 + 'deg',
    '--rx1': c.rx1 + 'deg', '--ry1': c.ry1 + 'deg', '--rz1': c.rz1 + 'deg',
    '--x': '0px', '--y': '0px', '--z': c.z0 + 'px',
    '--tilt': c.tilt + 'deg',
    animation: c.spin
      ? `chip-hero-spin ${c.dur}s linear infinite`
      : `chip-tumble ${c.dur}s ease-in-out ${c.delay}s infinite alternate`,
  };

  return (
    <div style={style}>
      <Chip3D size={c.size} palette={c.palette} />
    </div>
  );
}

// A 3D chip: two faces (top/bottom) + an edge cylinder made of stacked stripes.
function Chip3D({ size, palette }) {
  const edgeDepth = size * 0.12;
  const edgeStripes = 16; // alternating color stripes around the rim
  return (
    <div style={{
      width: '100%', height: '100%',
      position: 'relative',
      transformStyle: 'preserve-3d',
    }}>
      {/* Edge — thin slabs stacked along Z to fake a cylinder */}
      {Array.from({ length: 10 }).map((_, i) => {
        const z = (i / 9 - 0.5) * edgeDepth;
        return (
          <ChipFace key={'edge' + i} size={size} palette={palette} z={z} isEdge />
        );
      })}
      {/* Top face */}
      <ChipFace size={size} palette={palette} z={edgeDepth / 2 + 0.5} />
      {/* Bottom face (mirrored) */}
      <ChipFace size={size} palette={palette} z={-edgeDepth / 2 - 0.5} flip />
    </div>
  );
}

function ChipFace({ size, palette, z, flip, isEdge }) {
  const sections = 8; // alternating stripes on the rim
  const rimWidth = size * 0.15; // how wide the outer colored ring is
  const faceRadius = size / 2 - rimWidth;

  // Rim pie pattern as conic-gradient (supported everywhere modern)
  const conicStops = [];
  for (let i = 0; i < sections; i++) {
    const start = (i / sections) * 360;
    const end = ((i + 1) / sections) * 360;
    const color = i % 2 === 0 ? palette.base : palette.accent;
    conicStops.push(`${color} ${start}deg ${end}deg`);
  }
  const conic = `conic-gradient(${conicStops.join(', ')})`;

  return (
    <div style={{
      position: 'absolute', inset: 0,
      borderRadius: '50%',
      transform: `translateZ(${z}px)${flip ? ' rotateY(180deg)' : ''}`,
      background: conic,
      boxShadow: isEdge
        ? 'inset 0 0 0 1px rgba(0,0,0,0.25)'
        : `0 0 0 1px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.6)`,
      opacity: isEdge ? 0.85 : 1,
    }}>
      {!isEdge && (
        <>
          {/* Inner face — solid with subtle radial highlight */}
          <div style={{
            position: 'absolute',
            top: rimWidth, left: rimWidth,
            right: rimWidth, bottom: rimWidth,
            borderRadius: '50%',
            background: `radial-gradient(circle at 35% 30%, ${lighten(palette.base, 0.25)} 0%, ${palette.base} 55%, ${darken(palette.base, 0.3)} 100%)`,
            boxShadow: `inset 0 0 0 2px ${palette.accent === '#d4af37' ? 'rgba(212,175,55,0.7)' : 'rgba(245,245,240,0.5)'}, inset 0 3px 10px rgba(255,255,255,0.1)`,
          }}>
            {/* center emblem — diamond */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              width: faceRadius * 0.5, height: faceRadius * 0.5,
              marginLeft: -faceRadius * 0.25, marginTop: -faceRadius * 0.25,
              border: `1px solid ${palette.accent}`,
              transform: 'rotate(45deg)',
              opacity: 0.7,
            }} />
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              width: faceRadius * 0.15, height: faceRadius * 0.15,
              marginLeft: -faceRadius * 0.075, marginTop: -faceRadius * 0.075,
              borderRadius: '50%',
              background: palette.accent,
              opacity: 0.8,
            }} />
          </div>
          {/* glossy highlight over the whole face */}
          <div style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse 60% 40% at 30% 25%, rgba(255,255,255,0.18) 0%, transparent 60%)',
            pointerEvents: 'none',
          }} />
        </>
      )}
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────────
function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgbToHex(r, g, b) { return '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join(''); }
function lighten(hex, amt) { const [r, g, b] = hexToRgb(hex); return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt); }
function darken(hex, amt)  { const [r, g, b] = hexToRgb(hex); return rgbToHex(r * (1 - amt), g * (1 - amt), b * (1 - amt)); }

window.BgChipsPro = BgChipsPro;
