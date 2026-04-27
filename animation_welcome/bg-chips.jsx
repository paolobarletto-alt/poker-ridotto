// Variation 2: Orbiting Chips
// Concentric orbits of poker chips rotating around the center, each with a
// gold rim and stripes. Subtle speed differences create depth.

function BgChips() {
  const wrapperRef = React.useRef(null);

  // generate chip placements on 4 orbital rings
  const rings = React.useMemo(() => [
    { r: 280, count: 3, speed: 80, size: 56, tint: '#7a1220' },   // burgundy
    { r: 420, count: 5, speed: 140, size: 44, tint: '#0c3a2a' },  // green
    { r: 580, count: 7, speed: 220, size: 36, tint: '#1a1a2e' },  // navy
    { r: 760, count: 9, speed: 320, size: 30, tint: '#3a2410' },  // brown
  ], []);

  return (
    <div ref={wrapperRef} style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      background: 'radial-gradient(ellipse at center, #1a0f08 0%, #0a0604 55%, #050302 100%)',
    }}>
      {/* spotlight */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: 900, height: 900, transform: 'translate(-50%, -50%)',
        background: 'radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      {rings.map((ring, i) => (
        <div key={i} style={{
          position: 'absolute', top: '50%', left: '50%',
          width: ring.r * 2, height: ring.r * 2,
          marginLeft: -ring.r, marginTop: -ring.r,
          animation: `chip-orbit-${i} ${ring.speed}s linear infinite ${i % 2 ? 'reverse' : ''}`,
        }}>
          {Array.from({ length: ring.count }).map((_, j) => {
            const angle = (j / ring.count) * 360;
            return (
              <div key={j} style={{
                position: 'absolute',
                top: '50%', left: '50%',
                width: ring.size, height: ring.size,
                marginLeft: -ring.size / 2, marginTop: -ring.size / 2,
                transform: `rotate(${angle}deg) translateY(-${ring.r}px) rotate(-${angle}deg)`,
              }}>
                <Chip size={ring.size} tint={ring.tint} />
              </div>
            );
          })}
        </div>
      ))}

      {/* dashed orbit guides */}
      {rings.map((ring, i) => (
        <div key={'guide' + i} style={{
          position: 'absolute', top: '50%', left: '50%',
          width: ring.r * 2, height: ring.r * 2,
          marginLeft: -ring.r, marginTop: -ring.r,
          borderRadius: '50%',
          border: '1px dashed rgba(212,175,55,0.05)',
          pointerEvents: 'none',
        }} />
      ))}

      <style>{rings.map((_, i) => `
        @keyframes chip-orbit-${i} { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `).join('\n')}</style>

      {/* vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.75) 100%)',
        pointerEvents: 'none',
      }} />
    </div>
  );
}

function Chip({ size, tint }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `radial-gradient(circle at 35% 30%, ${tint} 0%, ${tint} 40%, rgba(0,0,0,0.4) 100%)`,
      boxShadow: `inset 0 0 0 2px rgba(212,175,55,0.35), inset 0 0 0 ${size * 0.12}px ${tint}, inset 0 0 0 ${size * 0.13}px rgba(212,175,55,0.25), 0 4px 12px rgba(0,0,0,0.5)`,
      position: 'relative',
    }}>
      {/* 6 tick stripes around the rim */}
      {Array.from({ length: 8 }).map((_, k) => (
        <div key={k} style={{
          position: 'absolute', top: 0, left: '50%',
          width: 3, height: size * 0.15,
          background: 'rgba(212,175,55,0.6)',
          transformOrigin: `center ${size / 2}px`,
          transform: `translateX(-50%) rotate(${(k / 8) * 360}deg)`,
        }} />
      ))}
      {/* center dot */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        width: size * 0.3, height: size * 0.3,
        marginLeft: -size * 0.15, marginTop: -size * 0.15,
        borderRadius: '50%',
        background: 'rgba(212,175,55,0.15)',
        border: '1px solid rgba(212,175,55,0.4)',
      }} />
    </div>
  );
}

window.BgChips = BgChips;
