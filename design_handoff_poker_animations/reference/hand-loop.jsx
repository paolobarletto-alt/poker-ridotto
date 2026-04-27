// hand-loop.jsx — State machine della mano di Texas Hold'em in auto-loop.
// Esporta PokerTableScene.

const PHASES = {
  IDLE: 'idle', DEAL: 'deal', PREFLOP: 'preflop',
  FLOP: 'flop', FLOPBET: 'flop-bet',
  TURN: 'turn', TURNBET: 'turn-bet',
  RIVER: 'river', RIVERBET: 'river-bet',
  SHOWDOWN: 'showdown', WIN: 'win', COLLECT: 'collect',
};

const VARIANT_CFG = {
  classic:  { speedMul: 1.0,  glow: true,  label: 'Classico' },
  snappy:   { speedMul: 0.55, glow: false, label: 'Snappy' },
  dramatic: { speedMul: 1.35, glow: true,  label: 'Dramatic' },
};

function phaseLabel(p) {
  const map = {
    idle: 'In attesa', deal: 'Distribuzione', preflop: 'Pre-flop',
    flop: 'Flop', 'flop-bet': 'Puntate · flop',
    turn: 'Turn', 'turn-bet': 'Puntate · turn',
    river: 'River', 'river-bet': 'Puntate · river',
    showdown: 'Showdown', win: 'Vincita', collect: 'Raccolta',
  };
  return map[p] || p;
}

function PokerTableScene({ variant = 'classic', numPlayers = 9 }) {
  const cfg = VARIANT_CFG[variant] || VARIANT_CFG.classic;
  const BASE = 500 * cfg.speedMul;
  const seats = React.useMemo(() => seatPositions(numPlayers), [numPlayers]);

  const [players, setPlayers] = React.useState(() =>
    Array.from({ length: numPlayers }, (_, i) => ({
      name: SEAT_NAMES[i] || `P${i + 1}`,
      stack: 2500, bet: 0, folded: false, holeCards: [], revealed: false,
    }))
  );
  const [flyingCards, setFlyingCards] = React.useState([]);
  const [communityCards, setCommunityCards] = React.useState([]);
  const [pot, setPot] = React.useState(0);
  const [phase, setPhase] = React.useState('idle');
  const [dealer, setDealer] = React.useState(0);
  const [activeSeat, setActiveSeat] = React.useState(-1);
  const [timerPct, setTimerPct] = React.useState(0);
  const [winner, setWinner] = React.useState(-1);
  const [chipFlights, setChipFlights] = React.useState([]);
  const [potGlow, setPotGlow] = React.useState(false);
  const [handNum, setHandNum] = React.useState(1);
  const [potSlideTarget, setPotSlideTarget] = React.useState(null);

  // Refs mirroring state so effect closures read current values
  const playersRef = React.useRef(players); playersRef.current = players;
  const potRef = React.useRef(pot); potRef.current = pot;
  const dealerRef = React.useRef(dealer); dealerRef.current = dealer;
  const cancelRef = React.useRef(false);

  React.useEffect(() => {
    let mounted = true;
    cancelRef.current = false;

    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    const runTurnTimer = async (seatIdx, ms) => {
      setActiveSeat(seatIdx);
      const start = performance.now();
      while (mounted && !cancelRef.current) {
        const t = (performance.now() - start) / ms;
        if (t >= 1) break;
        setTimerPct(t);
        await wait(40);
      }
      setTimerPct(1);
      await wait(50);
      setActiveSeat(-1);
      setTimerPct(0);
    };

    const flyChips = (amount, x0, y0, x1, y1, stagger = 40) => {
      const parts = chipBreakdown(amount).slice(0, 12);
      const ids = [];
      const flights = parts.map((denom, i) => {
        const id = `f${performance.now()}-${Math.random()}-${i}`;
        ids.push(id);
        const jit = () => (Math.random() - 0.5) * 8;
        return {
          id, denom,
          x0: x0 + jit(), y0: y0 + jit(),
          x1: x1 + jit(), y1: y1 + jit(),
          delay: i * stagger,
          durationMs: 500 * cfg.speedMul,
        };
      });
      setChipFlights((prev) => [...prev, ...flights]);
      const total = (flights.length * stagger) + 600;
      setTimeout(() => {
        setChipFlights((prev) => prev.filter((f) => !ids.includes(f.id)));
      }, total + 200);
    };

    const doBet = async (seatIdx, amount, quick = false) => {
      const seat = seats[seatIdx];
      const stackPos = seatStackPos(seat);
      const betPos = seatBetPos(seat);
      flyChips(amount, stackPos.x, stackPos.y, betPos.x, betPos.y, quick ? 25 : 40);
      setPlayers((prev) => prev.map((p, i) =>
        i === seatIdx ? { ...p, stack: Math.max(0, p.stack - amount), bet: p.bet + amount } : p
      ));
      await wait(quick ? 300 * cfg.speedMul : 450 * cfg.speedMul);
    };

    const collectBetsToPot = async () => {
      const snap = playersRef.current;
      let total = 0;
      snap.forEach((p, i) => {
        if (p.bet > 0) {
          const bp = seatBetPos(seats[i]);
          flyChips(p.bet, bp.x, bp.y, POT_POS.x, POT_POS.y - 8, 20);
          total += p.bet;
        }
      });
      await wait(BASE * 0.6);
      setPlayers((prev) => prev.map((p) => ({ ...p, bet: 0 })));
      setPot((pp) => pp + total);
      await wait(BASE * 0.2);
    };

    const foldSeat = (sIdx) => {
      setPlayers((prev) => prev.map((p, i) => i === sIdx ? { ...p, folded: true } : p));
      setFlyingCards((prev) => prev.map((c) => {
        if (c.id.startsWith(`c-${sIdx}-`)) {
          return { ...c, x: DECK_POS.x + (Math.random() - 0.5) * 30, y: DECK_POS.y, z: 5, faceUp: false };
        }
        return c;
      }));
      setTimeout(() => {
        setFlyingCards((prev) => prev.filter((c) => !c.id.startsWith(`c-${sIdx}-`)));
      }, BASE * 0.5);
    };

    const bettingRound = async (dealerIdx, baseBet) => {
      const order = [];
      for (let k = 1; k <= numPlayers; k++) order.push((dealerIdx + k) % numPlayers);
      let curCall = 0;
      for (const sIdx of order) {
        if (!mounted || cancelRef.current) return;
        const p = playersRef.current[sIdx];
        if (p.folded) continue;
        await runTurnTimer(sIdx, BASE * 0.5);
        const roll = Math.random();
        if (roll < 0.15) {
          await wait(BASE * 0.08);
        } else if (roll < 0.25) {
          foldSeat(sIdx);
        } else if (roll < 0.85) {
          const amt = curCall > 0 ? curCall : baseBet;
          curCall = Math.max(curCall, amt);
          await doBet(sIdx, amt);
        } else {
          const amt = (curCall || baseBet) * 2;
          curCall = amt;
          await doBet(sIdx, amt);
        }
        await wait(BASE * 0.1);
      }
    };

    const dealCommunity = async (startIdx, count, deck, deckPtr) => {
      for (let i = 0; i < count; i++) {
        if (!mounted || cancelRef.current) return;
        const card = deck[deckPtr + i];
        const pos = communityPos(startIdx + i);
        const id = `com-${startIdx + i}`;
        setCommunityCards((prev) => [...prev, {
          id, r: card.r, s: card.s, c: card.c,
          x: DECK_POS.x, y: DECK_POS.y, rot: 0, faceUp: false, scale: 1.15, z: 10 + startIdx + i,
        }]);
        await wait(30);
        setCommunityCards((prev) => prev.map((c) =>
          c.id === id ? { ...c, x: pos.x, y: pos.y } : c
        ));
        await wait(BASE * 0.45);
        setCommunityCards((prev) => prev.map((c) =>
          c.id === id ? { ...c, faceUp: true } : c
        ));
        await wait(BASE * 0.3);
      }
    };

    const runHand = async () => {
      while (mounted && !cancelRef.current) {
        setPhase('idle');
        setWinner(-1);
        setPotGlow(false);
        await wait(BASE * 0.5);
        if (!mounted || cancelRef.current) return;

        const deck = buildDeck();
        setPlayers((prev) => prev.map((p) => ({
          ...p, bet: 0, folded: false, holeCards: [], revealed: false,
          stack: p.stack <= 0 ? 2500 : p.stack,
        })));
        setCommunityCards([]);
        setFlyingCards([]);
        setPot(0);

        // DEAL — 2 carte a testa, una alla volta
        setPhase('deal');
        const dIdx = dealerRef.current;
        let deckPtr = 0;
        for (let round = 0; round < 2; round++) {
          for (let k = 1; k <= numPlayers; k++) {
            if (!mounted || cancelRef.current) return;
            const seatIdx = (dIdx + k) % numPlayers;
            const card = deck[deckPtr++];
            const pos = holeCardPos(seats[seatIdx], round);
            const id = `c-${seatIdx}-${round}`;
            setFlyingCards((prev) => [...prev, {
              id, r: card.r, s: card.s, c: card.c,
              x: DECK_POS.x, y: DECK_POS.y, rot: 0, faceUp: false, z: 20 + deckPtr,
            }]);
            await wait(25);
            setFlyingCards((prev) => prev.map((c) =>
              c.id === id ? { ...c, x: pos.x, y: pos.y, rot: pos.rot } : c
            ));
            await wait(Math.max(180, BASE * 0.36));
          }
        }
        await wait(BASE * 0.3);

        // PREFLOP bets — blinds + actions
        setPhase('preflop');
        const sb = (dIdx + 1) % numPlayers;
        const bb = (dIdx + 2) % numPlayers;
        await doBet(sb, 25, true);
        await doBet(bb, 50, true);
        await wait(BASE * 0.2);
        // Action order: starts after BB
        let curCall = 50;
        for (let k = 3; k <= numPlayers + 2; k++) {
          if (!mounted || cancelRef.current) return;
          const sIdx = (dIdx + k) % numPlayers;
          const p = playersRef.current[sIdx];
          if (p.folded) continue;
          await runTurnTimer(sIdx, BASE * 0.5);
          const roll = Math.random();
          const currentBet = p.bet;
          const toCall = curCall - currentBet;
          if (toCall <= 0 && roll < 0.5) {
            await wait(BASE * 0.08);
          } else if (roll < 0.35 && toCall > 0) {
            foldSeat(sIdx);
          } else if (roll < 0.85) {
            if (toCall > 0) await doBet(sIdx, toCall);
            else await wait(BASE * 0.08);
          } else {
            const raiseAmt = curCall * 2 - currentBet;
            curCall = curCall * 2;
            await doBet(sIdx, raiseAmt);
          }
          await wait(BASE * 0.1);
        }
        await collectBetsToPot();
        if (!mounted || cancelRef.current) return;

        // FLOP
        setPhase('flop');
        await dealCommunity(0, 3, deck, deckPtr); deckPtr += 3;
        await wait(BASE * 0.3);
        setPhase('flop-bet');
        await bettingRound(dIdx, 100);
        await collectBetsToPot();
        if (!mounted || cancelRef.current) return;

        // TURN
        setPhase('turn');
        await dealCommunity(3, 1, deck, deckPtr); deckPtr += 1;
        await wait(BASE * 0.3);
        setPhase('turn-bet');
        await bettingRound(dIdx, 150);
        await collectBetsToPot();
        if (!mounted || cancelRef.current) return;

        // RIVER
        setPhase('river');
        await dealCommunity(4, 1, deck, deckPtr); deckPtr += 1;
        await wait(BASE * 0.3);
        setPhase('river-bet');
        await bettingRound(dIdx, 200);
        await collectBetsToPot();
        if (!mounted || cancelRef.current) return;

        // SHOWDOWN — flip hole cards of non-folded players
        setPhase('showdown');
        setFlyingCards((prev) => prev.map((c) => {
          if (!c.id.startsWith('c-')) return c;
          const sIdx = parseInt(c.id.split('-')[1], 10);
          const folded = playersRef.current[sIdx]?.folded;
          return folded ? c : { ...c, faceUp: true };
        }));
        await wait(BASE * 1.1);
        if (!mounted || cancelRef.current) return;

        // WIN — pick random non-folded, glow, slide pot
        setPhase('win');
        const nonFolded = [];
        playersRef.current.forEach((p, i) => { if (!p.folded) nonFolded.push(i); });
        const winIdx = nonFolded[Math.floor(Math.random() * nonFolded.length)] ?? 0;
        setWinner(winIdx);
        if (cfg.glow) setPotGlow(true);
        await wait(BASE * 0.7);
        const winSeat = seats[winIdx];
        const stackTarget = seatStackPos(winSeat);
        setPotSlideTarget({ x: stackTarget.x, y: stackTarget.y });
        await wait(BASE * 1.1);
        const amt = potRef.current;
        setPlayers((prev) => prev.map((p, i) => i === winIdx ? { ...p, stack: p.stack + amt } : p));
        setPot(0);
        setPotSlideTarget(null);
        setPotGlow(false);
        await wait(BASE * 0.3);

        // COLLECT — cards fly back
        setPhase('collect');
        setFlyingCards((prev) => prev.map((c) => ({ ...c, x: DECK_POS.x, y: DECK_POS.y, faceUp: false, z: 5 })));
        setCommunityCards((prev) => prev.map((c) => ({ ...c, x: DECK_POS.x, y: DECK_POS.y, faceUp: false })));
        await wait(BASE * 0.6);
        setFlyingCards([]);
        setCommunityCards([]);
        setDealer((d) => (d + 1) % numPlayers);
        setHandNum((h) => h + 1);
        await wait(BASE * 0.3);
      }
    };

    runHand();
    return () => { mounted = false; cancelRef.current = true; };
  }, [variant, numPlayers]);

  const potPos = potSlideTarget || POT_POS;

  return (
    <div style={{ position: 'relative', width: TABLE_W, height: TABLE_H, background: '#0a0a08', overflow: 'hidden' }}>
      <Felt />
      <Deck cardsLeft={52 - (communityCards.length + flyingCards.length)} />

      {/* Pot label */}
      <div style={{
        position: 'absolute',
        left: POT_POS.x - 60, top: POT_POS.y + 32, width: 120,
        textAlign: 'center', color: '#e8c87a',
        fontFamily: 'Cormorant Garamond, Georgia, serif',
        fontStyle: 'italic', fontSize: 12, letterSpacing: 1.5,
        pointerEvents: 'none', zIndex: 2,
      }}>
        PIATTO
        <div style={{ fontSize: 22, fontWeight: 600, marginTop: 2, fontStyle: 'normal' }}>€{pot}</div>
      </div>

      {potGlow && <div className="pk-pot-glow on" style={{ left: POT_POS.x, top: POT_POS.y }} />}

      {/* Pot stack (slides to winner) */}
      <ChipStack x={potPos.x} y={potPos.y - 12} amount={pot} visible={pot > 0} z={2} />

      {/* Seats */}
      {seats.map((seat, i) => {
        const p = players[i];
        return (
          <Seat key={i}
            seat={seat} name={p?.name} stack={p?.stack ?? 0}
            active={activeSeat === i} folded={p?.folded}
            isDealer={dealer === i} timerPct={timerPct} variant={variant}
          />
        );
      })}

      {/* Seat bets */}
      {seats.map((seat, i) => {
        const p = players[i];
        if (!p || p.bet <= 0) return null;
        const pos = seatBetPos(seat);
        return <ChipStack key={`b-${i}`} x={pos.x} y={pos.y} amount={p.bet} visible z={2} />;
      })}

      {/* Seat mini-stacks */}
      {seats.map((seat, i) => {
        const p = players[i];
        if (!p || p.stack <= 0) return null;
        const pos = seatStackPos(seat);
        return <MiniStack key={`s-${i}`} x={pos.x} y={pos.y} amount={Math.min(p.stack, 300)} />;
      })}

      {/* Cards */}
      {flyingCards.map((c) => (
        <Card key={c.id} x={c.x} y={c.y} rot={c.rot} faceUp={c.faceUp}
          rank={c.r} suit={c.s} color={c.c} z={c.z} durationMs={500 * cfg.speedMul} />
      ))}
      {communityCards.map((c) => (
        <Card key={c.id} x={c.x} y={c.y} rot={c.rot} faceUp={c.faceUp}
          rank={c.r} suit={c.s} color={c.c} scale={c.scale || 1.15} z={c.z}
          durationMs={500 * cfg.speedMul} />
      ))}

      {/* Chip flights */}
      {chipFlights.map((f) => (
        <ChipInFlight key={f.id} denom={f.denom}
          x0={f.x0} y0={f.y0} x1={f.x1} y1={f.y1}
          delay={f.delay} durationMs={f.durationMs} />
      ))}

      {/* Winner halo */}
      {winner >= 0 && (
        <div style={{
          position: 'absolute',
          left: seats[winner].x - 48, top: seats[winner].y - 48,
          width: 96, height: 96, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(232,200,122,0.45) 0%, transparent 65%)',
          pointerEvents: 'none', zIndex: 1,
          animation: 'pk-pulse 1.2s ease-in-out infinite',
        }} />
      )}

      {/* HUD */}
      <div style={{
        position: 'absolute', left: 16, top: 14,
        color: '#c9b685', fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', zIndex: 20,
      }}>
        <div style={{ color: '#8a7b5a', fontSize: 9 }}>Mano #{handNum} · {cfg.label}</div>
        <div style={{ marginTop: 2, color: '#e8c87a' }}>{phaseLabel(phase)}</div>
      </div>
    </div>
  );
}

function MiniStack({ x, y, amount }) {
  const n = Math.min(6, Math.max(1, Math.floor(amount / 200) + 1));
  return (
    <div style={{ position: 'absolute', left: x - 11, top: y, zIndex: 2, pointerEvents: 'none' }}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', left: 0, top: -i * 2.2,
          width: 22, height: 22, borderRadius: '50%',
          background: i % 2 === 0
            ? 'radial-gradient(circle at 35% 30%, rgba(255,226,220,0.2), #b22828 60%)'
            : 'radial-gradient(circle at 35% 30%, rgba(233,245,236,0.2), #1f6b3a 60%)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.5)',
        }} />
      ))}
    </div>
  );
}

if (typeof document !== 'undefined' && !document.getElementById('pulse-styles')) {
  const s = document.createElement('style');
  s.id = 'pulse-styles';
  s.textContent = `@keyframes pk-pulse { 0%,100% { opacity: 0.35 } 50% { opacity: 1 } }`;
  document.head.appendChild(s);
}

Object.assign(window, { PokerTableScene, VARIANT_CFG });
