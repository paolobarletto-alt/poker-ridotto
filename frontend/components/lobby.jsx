// Lobby — unified view + Tornei/Cash/Sit&Go/Fast views
const { useState: useStateL, useEffect: useEffectL, useMemo } = React;

// ————— Data —————
const TORNEI = [
  { id: 't1', name: 'Il Notturno', buyin: 50, gtd: 5000, players: 142, max: 300, starts: '22:00', status: 'late-reg', type: 'MTT' },
  { id: 't2', name: 'Gran Premio Domenicale', buyin: 250, gtd: 50000, players: 287, max: 500, starts: 'DOM 20:30', status: 'upcoming', type: 'MTT' },
  { id: 't3', name: 'Bounty Hunter', buyin: 20, gtd: 2000, players: 98, max: 200, starts: 'in corso', status: 'running', type: 'KO' },
  { id: 't4', name: 'High Roller', buyin: 1000, gtd: 100000, players: 24, max: 80, starts: '21:15', status: 'upcoming', type: 'MTT' },
  { id: 't5', name: 'Freeroll Benvenuto', buyin: 0, gtd: 500, players: 412, max: 1000, starts: '19:00', status: 'upcoming', type: 'FREE' },
  { id: 't6', name: 'Turbo Serale', buyin: 30, gtd: 3000, players: 76, max: 150, starts: '23:30', status: 'late-reg', type: 'TURBO' },
];

const CASH_TABLES = [
  { id: 'c1', stakes: '€0.10/€0.25', avgPot: '€4.20', players: '6/6', waiting: 2, speed: 'Normal' },
  { id: 'c2', stakes: '€0.25/€0.50', avgPot: '€12.80', players: '5/6', waiting: 0, speed: 'Normal' },
  { id: 'c3', stakes: '€0.50/€1', avgPot: '€28.50', players: '4/6', waiting: 0, speed: 'Normal' },
  { id: 'c4', stakes: '€1/€2', avgPot: '€64.00', players: '6/6', waiting: 4, speed: 'Normal' },
  { id: 'c5', stakes: '€2/€5', avgPot: '€142.00', players: '3/6', waiting: 0, speed: 'Normal' },
  { id: 'c6', stakes: '€0.25/€0.50', avgPot: '€8.40', players: '8/9', waiting: 1, speed: 'Normal' },
  { id: 'c7', stakes: '€5/€10', avgPot: '€320.00', players: '5/6', waiting: 0, speed: 'Normal' },
  { id: 'c8', stakes: '€0.50/€1', avgPot: '€22.10', players: '6/6', waiting: 1, speed: 'Heads-Up' },
];

const SITNGO = [
  { id: 's1', seats: 3, buyin: 5, prize: 15, players: 2, speed: 'Standard' },
  { id: 's2', seats: 4, buyin: 10, prize: 40, players: 3, speed: 'Standard' },
  { id: 's3', seats: 5, buyin: 25, prize: 125, players: 4, speed: 'Standard' },
  { id: 's4', seats: 6, buyin: 50, prize: 300, players: 2, speed: 'Turbo' },
  { id: 's5', seats: 9, buyin: 10, prize: 90, players: 7, speed: 'Standard' },
  { id: 's6', seats: 9, buyin: 100, prize: 900, players: 6, speed: 'Hyper' },
];

const FAST = [
  { id: 'f1', name: 'Fast €5', seats: 3, buyin: 5, speed: 'Hyper' },
  { id: 'f2', name: 'Fast €10', seats: 4, buyin: 10, speed: 'Hyper' },
  { id: 'f3', name: 'Fast €25', seats: 5, buyin: 25, speed: 'Hyper' },
  { id: 'f4', name: 'Fast €100', seats: 6, buyin: 100, speed: 'Hyper' },
];

// ————— Shared bits —————
function StatusDot({ status }) {
  const map = {
    'late-reg': { c: '#D4AF37', t: 'Iscrizioni in corso' },
    'upcoming': { c: 'rgba(245,241,232,0.45)', t: 'In programma' },
    'running': { c: '#c0392b', t: 'In corso' },
  };
  const m = map[status] || map.upcoming;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', background: m.c,
        boxShadow: status === 'running' ? '0 0 8px rgba(192,57,43,0.8)' : 'none',
      }} />
      <span style={{ fontSize: 10.5, color: 'rgba(245,241,232,0.7)', letterSpacing: '0.05em' }}>{m.t}</span>
    </span>
  );
}

function Pill({ children, accent = false }) {
  return (
    <span style={{
      fontFamily: 'Inter, sans-serif', fontSize: 9.5, fontWeight: 600,
      padding: '3px 8px', borderRadius: 2, letterSpacing: '0.14em',
      color: accent ? '#0a0a0a' : '#D4AF37',
      background: accent ? '#D4AF37' : 'rgba(212,175,55,0.1)',
      border: accent ? 'none' : '1px solid rgba(212,175,55,0.25)',
    }}>{children}</span>
  );
}

// ————— Hero carousel —————
function HeroFeatured({ onPlay }) {
  return (
    <div style={{
      margin: '20px 32px 0', position: 'relative',
      background: 'radial-gradient(ellipse at 20% 50%, #14402a 0%, #0a2418 40%, #050f0a 100%)',
      border: '1px solid rgba(212,175,55,0.2)', padding: '34px 38px',
      overflow: 'hidden',
    }}>
      {/* decorative spade pattern */}
      <div style={{
        position: 'absolute', right: -40, top: -40, width: 360, height: 360,
        opacity: 0.07, color: '#D4AF37',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 400, fontFamily: 'serif', lineHeight: 1,
      }}>♠</div>

      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 32 }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600,
            color: '#D4AF37', letterSpacing: '0.28em', marginBottom: 12,
          }}>● IN EVIDENZA · QUESTA SERA</div>
          <div style={{
            fontFamily: 'Playfair Display, serif', fontSize: 48, fontWeight: 500,
            color: '#F5F1E8', letterSpacing: '-0.02em', lineHeight: 1.05,
            marginBottom: 10,
          }}>
            Gran Premio<br/>
            <span style={{ fontStyle: 'italic', color: '#D4AF37' }}>Domenicale</span>
          </div>
          <div style={{
            fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(245,241,232,0.65)',
            maxWidth: 440, lineHeight: 1.55,
          }}>
            Il torneo della settimana. Montepremi garantito €50.000,
            struttura lenta, late registration di 2 ore.
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 28, marginBottom: 16, justifyContent: 'flex-end' }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: '0.2em', color: 'rgba(245,241,232,0.5)', marginBottom: 4 }}>GARANTITO</div>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, color: '#D4AF37', fontWeight: 500 }}>€50.000</div>
            </div>
            <div>
              <div style={{ fontSize: 9, letterSpacing: '0.2em', color: 'rgba(245,241,232,0.5)', marginBottom: 4 }}>BUY-IN</div>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, color: '#F5F1E8', fontWeight: 500 }}>€250</div>
            </div>
            <div>
              <div style={{ fontSize: 9, letterSpacing: '0.2em', color: 'rgba(245,241,232,0.5)', marginBottom: 4 }}>INIZIA</div>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, color: '#F5F1E8', fontWeight: 500 }}>20:30</div>
            </div>
          </div>
          <GoldButton size="lg" onClick={onPlay}>Iscrivimi ora →</GoldButton>
        </div>
      </div>
    </div>
  );
}

// ————— Section heading —————
function SectionHeading({ overline, title, action }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      padding: '36px 32px 18px',
    }}>
      <div>
        <div style={{ fontSize: 10, letterSpacing: '0.22em', color: '#D4AF37', fontWeight: 600, marginBottom: 6 }}>{overline}</div>
        <div style={{
          fontFamily: 'Playfair Display, serif', fontSize: 24, color: '#F5F1E8',
          fontWeight: 500, letterSpacing: '-0.01em',
        }}>{title}</div>
      </div>
      {action}
    </div>
  );
}

// ————— Tornei table —————
function TorneiTable({ data, onJoin }) {
  return (
    <div style={{ margin: '0 32px', border: '1px solid rgba(212,175,55,0.12)' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '2.2fr 0.8fr 1fr 1.3fr 1fr 1fr 1fr',
        padding: '11px 18px', background: 'rgba(212,175,55,0.04)',
        borderBottom: '1px solid rgba(212,175,55,0.12)',
        fontSize: 9.5, letterSpacing: '0.2em', fontWeight: 600,
        color: 'rgba(245,241,232,0.5)',
      }}>
        <div>NOME</div><div>TIPO</div><div>BUY-IN</div><div>GARANTITO</div><div>GIOCATORI</div><div>INIZIO</div><div></div>
      </div>
      {data.map((t, i) => (
        <div key={t.id} style={{
          display: 'grid', gridTemplateColumns: '2.2fr 0.8fr 1fr 1.3fr 1fr 1fr 1fr',
          padding: '14px 18px', alignItems: 'center',
          borderBottom: i < data.length - 1 ? '1px solid rgba(212,175,55,0.06)' : 'none',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,175,55,0.03)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, color: '#F5F1E8', marginBottom: 3 }}>{t.name}</div>
            <StatusDot status={t.status} />
          </div>
          <div><Pill>{t.type}</Pill></div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', color: '#F5F1E8', fontSize: 13 }}>
            {t.buyin === 0 ? 'FREE' : `€${t.buyin}`}
          </div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, color: '#D4AF37' }}>
            €{t.gtd.toLocaleString('it-IT')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#F5F1E8' }}>
              {t.players}<span style={{ color: 'rgba(245,241,232,0.4)' }}>/{t.max}</span>
            </div>
            <div style={{ height: 2, background: 'rgba(245,241,232,0.1)', width: 80 }}>
              <div style={{ height: '100%', width: `${(t.players/t.max)*100}%`, background: '#D4AF37' }} />
            </div>
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'rgba(245,241,232,0.75)' }}>{t.starts}</div>
          <div style={{ textAlign: 'right' }}>
            <GoldButton size="sm" variant={t.status === 'running' ? 'ghost' : 'solid'} onClick={() => onJoin(t)}>
              {t.status === 'running' ? 'Osserva' : 'Iscrivi'}
            </GoldButton>
          </div>
        </div>
      ))}
    </div>
  );
}

// ————— Cash table list —————
function CashTable({ data, onJoin }) {
  return (
    <div style={{ margin: '0 32px', border: '1px solid rgba(212,175,55,0.12)' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 1fr 1fr 1fr',
        padding: '11px 18px', background: 'rgba(212,175,55,0.04)',
        borderBottom: '1px solid rgba(212,175,55,0.12)',
        fontSize: 9.5, letterSpacing: '0.2em', fontWeight: 600,
        color: 'rgba(245,241,232,0.5)',
      }}>
        <div>LIMITI</div><div>GIOCATORI</div><div>PIATTO MEDIO</div><div>IN ATTESA</div><div>MODALITÀ</div><div></div>
      </div>
      {data.map((t, i) => (
        <div key={t.id} style={{
          display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 1fr 1fr 1fr',
          padding: '13px 18px', alignItems: 'center',
          borderBottom: i < data.length - 1 ? '1px solid rgba(212,175,55,0.06)' : 'none',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,175,55,0.03)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 17, color: '#F5F1E8' }}>{t.stakes}</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, color: '#F5F1E8' }}>{t.players}</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, color: '#D4AF37' }}>{t.avgPot}</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, color: 'rgba(245,241,232,0.7)' }}>
            {t.waiting > 0 ? `${t.waiting} giocatori` : '—'}
          </div>
          <div><Pill>{t.speed}</Pill></div>
          <div style={{ textAlign: 'right' }}>
            <GoldButton size="sm" onClick={() => onJoin(t)}>Siediti</GoldButton>
          </div>
        </div>
      ))}
    </div>
  );
}

// ————— Sit & Go grid —————
function SitGoGrid({ data, onJoin }) {
  return (
    <div style={{
      margin: '0 32px', display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)', gap: 14,
    }}>
      {data.map(s => {
        const pct = s.players / s.seats;
        return (
          <div key={s.id} style={{
            border: '1px solid rgba(212,175,55,0.15)', padding: '20px 22px',
            background: 'linear-gradient(180deg, rgba(20,64,42,0.25), transparent)',
            position: 'relative',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 9.5, letterSpacing: '0.22em', color: 'rgba(245,241,232,0.45)', marginBottom: 4 }}>
                  {s.seats} GIOCATORI · {s.speed.toUpperCase()}
                </div>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: '#F5F1E8', fontWeight: 500 }}>
                  Sit & Go €{s.buyin}
                </div>
              </div>
              <Pill accent={pct > 0.75}>{s.players}/{s.seats}</Pill>
            </div>

            {/* seat indicator */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 18 }}>
              {Array.from({ length: s.seats }).map((_, i) => (
                <div key={i} style={{
                  flex: 1, height: 3,
                  background: i < s.players ? '#D4AF37' : 'rgba(245,241,232,0.1)',
                }} />
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 9, letterSpacing: '0.2em', color: 'rgba(245,241,232,0.5)', marginBottom: 2 }}>MONTEPREMI</div>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: '#D4AF37' }}>€{s.prize}</div>
              </div>
              <GoldButton size="sm" onClick={() => onJoin(s)}>Iscrivi</GoldButton>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ————— Fast cards —————
function FastCards({ data, onJoin }) {
  return (
    <div style={{
      margin: '0 32px', display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)', gap: 12,
    }}>
      {data.map(f => (
        <div key={f.id} style={{
          border: '1px solid rgba(212,175,55,0.15)', padding: '22px 20px',
          background: 'radial-gradient(ellipse at top right, rgba(212,175,55,0.08), transparent 70%)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: 14, right: 14, fontSize: 9, letterSpacing: '0.22em',
            color: '#D4AF37', fontWeight: 700,
          }}>⚡ FAST</div>
          <div style={{ fontSize: 9.5, letterSpacing: '0.2em', color: 'rgba(245,241,232,0.45)', marginBottom: 4 }}>
            {f.seats} MAX
          </div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, color: '#F5F1E8', fontWeight: 500, marginBottom: 4 }}>
            €{f.buyin}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(245,241,232,0.6)', marginBottom: 18 }}>
            Nuova mano ogni 15 secondi. Fold e vai al tavolo successivo.
          </div>
          <GoldButton size="sm" onClick={() => onJoin(f)}>Entra</GoldButton>
        </div>
      ))}
    </div>
  );
}

// ————— Main lobby with filter on route —————
function Lobby({ route, onJoinTable }) {
  if (route === 'tornei') {
    return (
      <div style={{ paddingBottom: 40 }}>
        <TopBar
          subtitle="SALA TORNEI · 6 EVENTI"
          title="Tornei in programma"
          actions={<>
            <GoldButton variant="ghost" size="sm">Filtri</GoldButton>
            <GoldButton size="sm">Miei tornei</GoldButton>
          </>}
        />
        <div style={{ height: 20 }} />
        <TorneiTable data={TORNEI} onJoin={() => onJoinTable('mtt')} />
      </div>
    );
  }

  if (route === 'cash') {
    return (
      <div style={{ paddingBottom: 40 }}>
        <TopBar
          subtitle="CASH GAME · 8 TAVOLI APERTI"
          title="Cash Game"
          actions={<>
            <GoldButton variant="ghost" size="sm">6-Max</GoldButton>
            <GoldButton variant="ghost" size="sm">9-Max</GoldButton>
            <GoldButton variant="ghost" size="sm">Heads-Up</GoldButton>
          </>}
        />
        <div style={{ height: 20 }} />
        <CashTable data={CASH_TABLES} onJoin={() => onJoinTable('cash')} />
      </div>
    );
  }

  if (route === 'sitgo') {
    return (
      <div style={{ paddingBottom: 40 }}>
        <TopBar
          subtitle="SIT & GO · INIZIA QUANDO SEI PRONTO"
          title="Sit & Go"
          actions={<>
            <GoldButton variant="ghost" size="sm">3 max</GoldButton>
            <GoldButton variant="ghost" size="sm">6 max</GoldButton>
            <GoldButton variant="ghost" size="sm">9 max</GoldButton>
          </>}
        />
        <div style={{ height: 20 }} />
        <SitGoGrid data={SITNGO} onJoin={() => onJoinTable('sng')} />
      </div>
    );
  }

  if (route === 'fast') {
    return (
      <div style={{ paddingBottom: 40 }}>
        <TopBar
          subtitle="FAST · POOL DI GIOCATORI"
          title="Fast Poker"
          actions={null}
        />
        <div style={{ padding: '0 32px 16px', marginTop: 16 }}>
          <div style={{
            padding: '14px 18px', border: '1px solid rgba(212,175,55,0.15)',
            background: 'rgba(212,175,55,0.03)',
            fontSize: 12.5, color: 'rgba(245,241,232,0.75)', lineHeight: 1.55,
          }}>
            <strong style={{ color: '#D4AF37', fontFamily: 'Inter, sans-serif', letterSpacing: '0.08em', fontSize: 11 }}>
              COME FUNZIONA
            </strong>
            <div style={{ marginTop: 6 }}>
              Entri in un pool invece che in un tavolo fisso. Ogni volta che fai fold,
              il sistema ti sposta immediatamente a un nuovo tavolo con mani nuove.
            </div>
          </div>
        </div>
        <FastCards data={FAST} onJoin={() => onJoinTable('fast')} />
      </div>
    );
  }

  // Default: overview lobby
  return (
    <div style={{ paddingBottom: 40 }}>
      <TopBar
        subtitle={`BENTORNATO · ${new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}`}
        title="Buona sera."
        actions={<>
          <GoldButton variant="ghost" size="sm">Cassa</GoldButton>
          <GoldButton size="sm">Siediti subito</GoldButton>
        </>}
      />

      <HeroFeatured onPlay={() => onJoinTable('mtt')} />

      <SectionHeading
        overline="IL RITMO DEL TAVOLO"
        title="Tornei in programma"
        action={<GoldButton variant="ghost" size="sm">Tutti i tornei →</GoldButton>}
      />
      <TorneiTable data={TORNEI.slice(0, 3)} onJoin={() => onJoinTable('mtt')} />

      <SectionHeading
        overline="IL CLASSICO"
        title="Cash Game"
        action={<GoldButton variant="ghost" size="sm">Tutti i tavoli →</GoldButton>}
      />
      <CashTable data={CASH_TABLES.slice(0, 4)} onJoin={() => onJoinTable('cash')} />

      <SectionHeading
        overline="RAPIDO"
        title="Sit & Go"
        action={<GoldButton variant="ghost" size="sm">Tutte le modalità →</GoldButton>}
      />
      <SitGoGrid data={SITNGO.slice(0, 3)} onJoin={() => onJoinTable('sng')} />
    </div>
  );
}

Object.assign(window, { Lobby });
