// Variation 5: Smoke & Bokeh
// Slow-drifting bokeh circles of warm gold light (like a dim lounge at night),
// with a soft smoke/haze layer that ebbs. Most cinematic of the five.

function BgBokeh() {
  const orbs = React.useMemo(() => Array.from({ length: 14 }, (_, i) => ({
    size: 120 + Math.random() * 260,
    left: Math.random() * 120 - 10,
    top: Math.random() * 120 - 10,
    dur: 18 + Math.random() * 22,
    delay: Math.random() * -30,
    blur: 40 + Math.random() * 80,
    hue: Math.random() < 0.7 ? 'gold' : 'red',
    opacity: 0.08 + Math.random() * 0.18,
  })), []);

  return (
    <div style={{
      position: 'absolute', inset: 0, overflow: 'hidden',
      background: `
        radial-gradient(ellipse at 30% 20%, #1f1408 0%, transparent 50%),
        radial-gradient(ellipse at 70% 80%, #1a0808 0%, transparent 50%),
        #070503
      `,
    }}>
      {/* smoke layer — big slow gradient blobs */}
      <div className="smoke-a" style={{
        position: 'absolute', inset: '-20%',
        background: 'radial-gradient(ellipse 50% 60% at 30% 40%, rgba(120,80,40,0.15), transparent 70%)',
        animation: 'smoke-drift-a 40s ease-in-out infinite',
      }} />
      <div className="smoke-b" style={{
        position: 'absolute', inset: '-20%',
        background: 'radial-gradient(ellipse 60% 55% at 70% 60%, rgba(180,40,40,0.08), transparent 70%)',
        animation: 'smoke-drift-b 55s ease-in-out infinite',
      }} />

      {/* bokeh orbs */}
      {orbs.map((o, i) => (
        <div key={i} style={{
          position: 'absolute',
          width: o.size, height: o.size,
          left: o.left + '%', top: o.top + '%',
          borderRadius: '50%',
          background: o.hue === 'gold'
            ? 'radial-gradient(circle, rgba(255,210,120,0.9) 0%, rgba(212,175,55,0.2) 40%, transparent 70%)'
            : 'radial-gradient(circle, rgba(220,80,80,0.7) 0%, rgba(140,30,30,0.15) 40%, transparent 70%)',
          filter: `blur(${o.blur}px)`,
          opacity: o.opacity,
          animation: `bokeh-float-${i % 4} ${o.dur}s ease-in-out infinite`,
          animationDelay: o.delay + 's',
          mixBlendMode: 'screen',
        }} />
      ))}

      {/* grain */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.3, mixBlendMode: 'overlay', pointerEvents: 'none' }}>
        <filter id="bokeh-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" />
          <feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.4  0 0 0 0 0.3  0 0 0 0.4 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#bokeh-noise)" />
      </svg>

      {/* vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.8) 100%)',
        pointerEvents: 'none',
      }} />

      <style>{`
        @keyframes smoke-drift-a {
          0%,100% { transform: translate(0,0) scale(1); }
          50%     { transform: translate(6%, -4%) scale(1.15); }
        }
        @keyframes smoke-drift-b {
          0%,100% { transform: translate(0,0) scale(1); }
          50%     { transform: translate(-5%, 5%) scale(1.2); }
        }
        @keyframes bokeh-float-0 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%     { transform: translate(40px,-30px) scale(1.1); }
        }
        @keyframes bokeh-float-1 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%     { transform: translate(-30px,40px) scale(1.15); }
        }
        @keyframes bokeh-float-2 {
          0%,100% { transform: translate(0,0) scale(0.95); }
          50%     { transform: translate(25px,25px) scale(1.05); }
        }
        @keyframes bokeh-float-3 {
          0%,100% { transform: translate(0,0) scale(1.05); }
          50%     { transform: translate(-40px,-20px) scale(0.95); }
        }
      `}</style>
    </div>
  );
}

window.BgBokeh = BgBokeh;
