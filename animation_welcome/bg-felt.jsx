// Variation 3: Felt Radial Glow
// Dark green felt texture with a slow pulsing radial spotlight — like a
// single overhead lamp above a poker table. Very atmospheric, almost still.
// Subtle noise grain animation gives it life without being distracting.

function BgFelt() {
  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      background: '#0a0604',
    }}>
      {/* felt base — deep green with fabric texture via noise svg */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `
          radial-gradient(ellipse 60% 55% at 50% 45%, #1a3a28 0%, #0d2418 35%, #06110a 70%, #030806 100%)
        `,
      }} />

      {/* fabric grain via SVG noise */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.4, mixBlendMode: 'overlay' }}>
        <filter id="felt-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
          <feColorMatrix values="0 0 0 0 0.15  0 0 0 0 0.2  0 0 0 0 0.1  0 0 0 0.5 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#felt-noise)" />
      </svg>

      {/* overhead lamp — slow breathing */}
      <div style={{
        position: 'absolute', top: '42%', left: '50%',
        width: 1400, height: 900,
        transform: 'translate(-50%, -50%)',
        background: 'radial-gradient(ellipse 50% 50% at center, rgba(255,220,140,0.25) 0%, rgba(212,175,55,0.1) 30%, transparent 65%)',
        animation: 'felt-pulse 6s ease-in-out infinite',
        pointerEvents: 'none',
      }} />

      {/* concentric table rings */}
      <svg style={{ position: 'absolute', top: '42%', left: '50%', width: 1200, height: 1200, transform: 'translate(-50%, -50%)', pointerEvents: 'none', opacity: 0.25 }}>
        <defs>
          <radialGradient id="felt-ring" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="95%" stopColor="rgba(212,175,55,0.35)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <circle cx="600" cy="600" r="380" fill="none" stroke="rgba(212,175,55,0.2)" strokeWidth="1" />
        <circle cx="600" cy="600" r="500" fill="none" stroke="rgba(212,175,55,0.1)" strokeWidth="1" strokeDasharray="2 8" />
      </svg>

      {/* floating dust */}
      <DustLayer />

      {/* vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.85) 100%)',
        pointerEvents: 'none',
      }} />

      <style>{`
        @keyframes felt-pulse {
          0%,100% { opacity: 0.85; transform: translate(-50%, -50%) scale(1); }
          50%     { opacity: 1;    transform: translate(-50%, -50%) scale(1.04); }
        }
        @keyframes felt-dust {
          0%   { transform: translateY(100vh) translateX(0); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(-10vh) translateX(30px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function DustLayer() {
  const particles = React.useMemo(() => Array.from({ length: 30 }, (_, i) => ({
    left: Math.random() * 100,
    size: 1 + Math.random() * 2,
    delay: Math.random() * -40,
    dur: 25 + Math.random() * 30,
  })), []);
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {particles.map((p, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: p.left + '%', bottom: 0,
          width: p.size, height: p.size,
          borderRadius: '50%',
          background: 'rgba(255,220,140,0.5)',
          boxShadow: '0 0 6px rgba(255,220,140,0.6)',
          animation: `felt-dust ${p.dur}s linear infinite`,
          animationDelay: p.delay + 's',
        }} />
      ))}
    </div>
  );
}

window.BgFelt = BgFelt;
