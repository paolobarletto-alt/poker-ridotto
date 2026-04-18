import { GoldButton } from './Shell';

const USER = {
  name: 'Lorenzo Bianchi',
  username: 'lorenzo_b',
  initials: 'LB',
  member: 'Marzo 2022',
  vipLevel: 'Oro',
  balance: 3842.50,
  stats: {
    gamesPlayed: 2847,
    hoursPlayed: 612,
    totalWinnings: 18420,
    totalLosses: 14180,
    netResult: 4240,
    biggestPot: 1280,
    roi: 14.7,
    vpip: 22.4,
    pfr: 18.1,
    af: 2.4,
    winRate: 53.2,
  },
};

const PL_DATA = [
  0, 45, 120, 80, 210, 180, 340, 280, 420, 380,
  510, 480, 420, 580, 640, 720, 680, 580, 740, 820,
  890, 960, 1020, 980, 1180, 1240, 1320, 1400, 1360, 1480,
  1540, 1680, 1820, 2100, 2240, 2380, 2460, 2580, 2720, 2880,
  3020, 3180, 3320, 3480, 3620, 3780, 3960, 4100, 4180, 4240,
];

const RECENT_GAMES = [
  { id: 1, date: '17 APR', time: '22:14', type: 'Cash €0.50/€1', duration: '2h 14m', hands: 287, result: +185.40, status: 'win' },
  { id: 2, date: '17 APR', time: '19:30', type: 'Sit & Go €25', duration: '48m', hands: 62, result: -25, status: 'loss' },
  { id: 3, date: '16 APR', time: '21:00', type: 'Tornei · Il Notturno', duration: '3h 42m', hands: 412, result: +420, status: 'win' },
  { id: 4, date: '16 APR', time: '18:45', type: 'Fast €10', duration: '32m', hands: 58, result: +34.20, status: 'win' },
  { id: 5, date: '15 APR', time: '23:10', type: 'Cash €1/€2', duration: '1h 48m', hands: 194, result: -128, status: 'loss' },
  { id: 6, date: '15 APR', time: '20:22', type: 'Sit & Go €50', duration: '1h 12m', hands: 98, result: +150, status: 'win' },
  { id: 7, date: '14 APR', time: '22:00', type: 'Tornei · Turbo Serale', duration: '1h 56m', hands: 284, result: -30, status: 'loss' },
  { id: 8, date: '13 APR', time: '21:32', type: 'Cash €0.25/€0.50', duration: '3h 12m', hands: 389, result: +88.60, status: 'win' },
];

// ————— P/L chart —————
function PLChart({ data }) {
  const w = 560, h = 170, pad = 4;
  const max = Math.max(...data);
  const min = Math.min(0, ...data);
  const range = max - min || 1;
  const xStep = (w - pad * 2) / (data.length - 1);
  const points = data.map((v, i) => [
    pad + i * xStep,
    h - pad - ((v - min) / range) * (h - pad * 2),
  ]);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
  const areaPath = `${path} L${points[points.length - 1][0]},${h - pad} L${points[0][0]},${h - pad} Z`;
  const zeroY = h - pad - ((0 - min) / range) * (h - pad * 2);

  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="plg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#D4AF37" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map(p => (
        <line key={p} x1={pad} x2={w - pad} y1={pad + p * (h - pad * 2)} y2={pad + p * (h - pad * 2)}
          stroke="rgba(245,241,232,0.04)" strokeWidth="1" />
      ))}
      <line x1={pad} x2={w - pad} y1={zeroY} y2={zeroY} stroke="rgba(245,241,232,0.15)" strokeDasharray="2,3" />
      <path d={areaPath} fill="url(#plg)" />
      <path d={path} stroke="#D4AF37" strokeWidth="1.5" fill="none" />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="3" fill="#D4AF37" />
    </svg>
  );
}

// ————— Stat tile —————
function StatTile({ label, value, sub, accent, wide }) {
  return (
    <div style={{
      gridColumn: wide ? 'span 2' : undefined,
      padding: '18px 20px',
      border: '1px solid rgba(212,175,55,0.12)',
      background: accent ? 'linear-gradient(180deg, rgba(212,175,55,0.08), transparent)' : 'transparent',
    }}>
      <div style={{ fontSize: 9.5, letterSpacing: '0.22em', color: 'rgba(245,241,232,0.5)', fontWeight: 600, marginBottom: 8, fontFamily: 'Inter, sans-serif' }}>
        {label}
      </div>
      <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 500, color: accent ? '#D4AF37' : '#F5F1E8', letterSpacing: '-0.01em', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(245,241,232,0.55)', fontFamily: 'Inter, sans-serif' }}>{sub}</div>
      )}
    </div>
  );
}

// ————— Profile —————
export default function Profile() {
  const winRate = Math.round((RECENT_GAMES.filter(g => g.status === 'win').length / RECENT_GAMES.length) * 100);

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div style={{
        padding: '32px 32px 28px',
        borderBottom: '1px solid rgba(212,175,55,0.08)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'linear-gradient(135deg, #D4AF37, #8a6d1e)',
            color: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Playfair Display, serif', fontSize: 34, fontWeight: 700,
            boxShadow: '0 6px 20px rgba(212,175,55,0.3)',
          }}>{USER.initials}</div>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.22em', color: 'rgba(245,241,232,0.5)', marginBottom: 5 }}>
              MEMBRO DAL {USER.member.toUpperCase()} · LIVELLO <span style={{ color: '#D4AF37' }}>{USER.vipLevel.toUpperCase()}</span>
            </div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 32, color: '#F5F1E8', fontWeight: 500, letterSpacing: '-0.015em', lineHeight: 1 }}>
              {USER.name}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(245,241,232,0.6)', marginTop: 6, fontFamily: 'JetBrains Mono, monospace' }}>
              @{USER.username}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <GoldButton variant="ghost" size="sm">Impostazioni</GoldButton>
          <GoldButton size="sm">Deposita</GoldButton>
        </div>
      </div>

      {/* Balance + chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 0, borderBottom: '1px solid rgba(212,175,55,0.08)' }}>
        <div style={{ padding: '26px 32px', borderRight: '1px solid rgba(212,175,55,0.08)' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.22em', color: 'rgba(245,241,232,0.5)', marginBottom: 8 }}>SALDO</div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 38, color: '#F5F1E8', fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 4 }}>
            €{USER.balance.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(245,241,232,0.55)' }}>Disponibile per il gioco</div>
          <div style={{ marginTop: 22, fontSize: 10, letterSpacing: '0.22em', color: 'rgba(245,241,232,0.5)', marginBottom: 8 }}>RISULTATO NETTO</div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, color: '#D4AF37', fontWeight: 500, lineHeight: 1 }}>
            +€{USER.stats.netResult.toLocaleString('it-IT')}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(245,241,232,0.55)', marginTop: 4 }}>
            ROI {USER.stats.roi}% · tutto il tempo
          </div>
        </div>
        <div style={{ padding: '26px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: '0.22em', color: '#D4AF37', marginBottom: 4 }}>ANDAMENTO</div>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: '#F5F1E8' }}>Ultimi 50 giorni</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {['7g', '30g', '50g', 'Tutto'].map((p, i) => (
                <button key={p} style={{
                  background: i === 2 ? 'rgba(212,175,55,0.15)' : 'transparent',
                  border: '1px solid rgba(212,175,55,0.25)',
                  color: i === 2 ? '#D4AF37' : 'rgba(245,241,232,0.65)',
                  padding: '4px 10px', fontSize: 10, fontFamily: 'Inter, sans-serif',
                  letterSpacing: '0.1em', cursor: 'pointer',
                }}>{p}</button>
              ))}
            </div>
          </div>
          <PLChart data={PL_DATA} />
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ padding: '26px 32px', borderBottom: '1px solid rgba(212,175,55,0.08)' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.22em', color: '#D4AF37', marginBottom: 14 }}>STATISTICHE LIFETIME</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, border: '1px solid rgba(212,175,55,0.08)' }}>
          <StatTile label="PARTITE GIOCATE" value={USER.stats.gamesPlayed.toLocaleString('it-IT')} sub="su tutte le modalità" />
          <StatTile label="ORE AL TAVOLO" value={`${USER.stats.hoursPlayed}h`} sub="in 4 anni" />
          <StatTile label="VINCITE TOTALI" value={`€${USER.stats.totalWinnings.toLocaleString('it-IT')}`} accent />
          <StatTile label="PERDITE TOTALI" value={`€${USER.stats.totalLosses.toLocaleString('it-IT')}`} />
          <StatTile label="WIN RATE" value={`${USER.stats.winRate}%`} sub="mani vinte allo showdown" />
          <StatTile label="VPIP / PFR" value={`${USER.stats.vpip} / ${USER.stats.pfr}`} sub="stile leggermente tight" />
          <StatTile label="AGGRESSION FACTOR" value={USER.stats.af} sub="bilanciato" />
          <StatTile label="PIATTO PIÙ GROSSO" value={`€${USER.stats.biggestPot.toLocaleString('it-IT')}`} sub="Cash €1/€2 · 12 feb" accent />
        </div>
      </div>

      {/* Recent games */}
      <div style={{ padding: '26px 32px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.22em', color: '#D4AF37', marginBottom: 6 }}>STORICO PARTITE</div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: '#F5F1E8' }}>Sessioni recenti</div>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(245,241,232,0.6)' }}>
            {winRate}% vincite · ultimi 8 giorni
          </div>
        </div>

        <div style={{ border: '1px solid rgba(212,175,55,0.12)' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '0.8fr 1.8fr 1fr 1fr 1fr 1fr',
            padding: '11px 18px', background: 'rgba(212,175,55,0.04)',
            borderBottom: '1px solid rgba(212,175,55,0.12)',
            fontSize: 9.5, letterSpacing: '0.2em', fontWeight: 600,
            color: 'rgba(245,241,232,0.5)',
          }}>
            <div>DATA</div><div>TAVOLO</div><div>DURATA</div><div>MANI</div><div>RISULTATO</div><div style={{ textAlign: 'right' }}>ESITO</div>
          </div>
          {RECENT_GAMES.map((g, i) => (
            <div key={g.id} style={{
              display: 'grid', gridTemplateColumns: '0.8fr 1.8fr 1fr 1fr 1fr 1fr',
              padding: '14px 18px', alignItems: 'center',
              borderBottom: i < RECENT_GAMES.length - 1 ? '1px solid rgba(212,175,55,0.06)' : 'none',
            }}>
              <div>
                <div style={{ fontSize: 12, color: '#F5F1E8', fontFamily: 'Inter, sans-serif' }}>{g.date}</div>
                <div style={{ fontSize: 10.5, color: 'rgba(245,241,232,0.5)', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>{g.time}</div>
              </div>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 15, color: '#F5F1E8' }}>{g.type}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'rgba(245,241,232,0.75)' }}>{g.duration}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'rgba(245,241,232,0.75)' }}>{g.hands}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 500, color: g.status === 'win' ? '#D4AF37' : '#c77' }}>
                {g.result > 0 ? '+' : ''}€{Math.abs(g.result).toLocaleString('it-IT', { minimumFractionDigits: g.result % 1 !== 0 ? 2 : 0 })}
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  fontSize: 9.5, letterSpacing: '0.2em', fontWeight: 600,
                  padding: '3px 10px',
                  color: g.status === 'win' ? '#D4AF37' : 'rgba(245,241,232,0.55)',
                  border: `1px solid ${g.status === 'win' ? 'rgba(212,175,55,0.4)' : 'rgba(245,241,232,0.15)'}`,
                  fontFamily: 'Inter, sans-serif',
                }}>
                  {g.status === 'win' ? 'VINTA' : 'PERSA'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
