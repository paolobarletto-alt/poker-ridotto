// Variation 1: Floating Suits
// Large, soft, slowly-drifting suit glyphs (♠♥♦♣) with parallax and gentle rotation.
// Very subtle — almost like dust motes. Dark warm background with a vignette.

function BgSuits() {
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h, dpr;
    const suits = ['♠', '♥', '♦', '♣'];
    let particles = [];
    let raf;

    function resize() {
      dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // seed
    particles = Array.from({ length: 28 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.08,
      vy: -0.05 - Math.random() * 0.08,
      size: 40 + Math.random() * 110,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.0015,
      suit: suits[Math.floor(Math.random() * 4)],
      // red suits use deeper burgundy, black suits tinted gold
      hue: Math.random() < 0.4,
      alpha: 0.025 + Math.random() * 0.05,
      depth: Math.random(), // for parallax feel
    }));

    function frame() {
      ctx.clearRect(0, 0, w, h);
      // radial vignette background
      const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
      g.addColorStop(0, '#1a1108');
      g.addColorStop(0.6, '#0e0805');
      g.addColorStop(1, '#050302');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx * (0.4 + p.depth);
        p.y += p.vy * (0.4 + p.depth);
        p.rot += p.vrot;
        if (p.y < -p.size) { p.y = h + p.size; p.x = Math.random() * w; }
        if (p.x < -p.size) p.x = w + p.size;
        if (p.x > w + p.size) p.x = -p.size;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = p.alpha * (0.6 + p.depth * 0.5);
        ctx.fillStyle = p.hue ? '#8a1a1a' : '#d4af37';
        ctx.font = `${p.size}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = p.hue ? '#5a0f0f' : '#b8941e';
        ctx.shadowBlur = 18;
        ctx.fillText(p.suit, 0, 0);
        ctx.restore();
      }

      raf = requestAnimationFrame(frame);
    }
    frame();

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#0a0604' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      {/* soft vignette */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)',
        pointerEvents: 'none',
      }} />
    </div>
  );
}

window.BgSuits = BgSuits;
