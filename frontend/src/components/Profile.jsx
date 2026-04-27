import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { GoldButton } from './Shell';
import { useViewport } from '../hooks/useViewport';
// ————— Skeleton —————
const shimmerStyle = (() => {
  if (typeof document !== 'undefined' && !document.getElementById('profile-shimmer')) {
    const s = document.createElement('style');
    s.id = 'profile-shimmer';
    s.textContent = `
      @keyframes profileShimmer {
        0%   { background-position: -400px 0; }
        100% { background-position: 400px 0; }
      }
      .p-skel {
        background: linear-gradient(90deg,
          rgba(212,175,55,0.06) 25%, rgba(212,175,55,0.14) 50%, rgba(212,175,55,0.06) 75%);
        background-size: 800px 100%;
        animation: profileShimmer 1.6s infinite linear;
        border-radius: 3px;
      }
    `;
    document.head.appendChild(s);
  }
  return null;
})();

function Skel({ w = 80, h = 18, style = {} }) {
  return <div className="p-skel" style={{ width: w, height: h, display: 'inline-block', ...style }} />;
}

// ————— P/L chart —————
function PLChart({ data }) {
  if (!data || data.length < 2) {
    return (
      <div style={{ height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(245,241,232,0.4)', fontSize: 13, fontFamily: 'Inter, sans-serif', fontStyle: 'italic' }}>
        Gioca le tue prime partite per vedere il grafico
      </div>
    );
  }
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

// ————— Profile —————
export default function Profile() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const { isMobile } = useViewport();

  const [statsData, setStatsData] = useState({});
  const [gameHistory, setGameHistory] = useState([]);
  const [chipsHistory, setChipsHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    // Aggiorna il saldo nel contesto auth al mount
    refreshUser();

    async function loadAll() {
      try {
        const [stats, history, chips] = await Promise.all([
          api.get('/users/me/stats'),
          api.get('/users/me/game-history'),
          api.get('/users/me/chips-history'),
        ]);
        if (!mounted) return;
        setStatsData(stats?.data ?? {});
        setGameHistory(Array.isArray(history?.data) ? history.data : []);
        setChipsHistory(Array.isArray(chips?.data) ? chips.data : []);
      } catch (err) {
        if (!mounted) return;
        setStatsData({});
        setGameHistory([]);
        setChipsHistory([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadAll();

    // Poll balance every 5s and chips-history every 10s
    const balInterval = setInterval(async () => {
      try {
        const me = await api.get('/auth/me');
        if (!mounted) return;
        if (me?.data?.chips_balance != null) {
          // update context directly
          if (typeof refreshUser === 'function') refreshUser();
        }
      } catch {}
    }, 5000);

    const chipsInterval = setInterval(async () => {
      try {
        const chips = await api.get('/users/me/chips-history');
        if (!mounted) return;
        setChipsHistory(Array.isArray(chips?.data) ? chips.data : []);
      } catch {}
    }, 10000);

    return () => {
      mounted = false;
      clearInterval(balInterval);
      clearInterval(chipsInterval);
    };
  }, [refreshUser]);

  // Build cumulative P/L series from chips history
  const plData = (() => {
    if (!Array.isArray(chipsHistory) || chipsHistory.length === 0) return null;
    const relevant = [...chipsHistory]
      .filter(e => ['hand_win', 'hand_loss', 'sitgo_buyin', 'sitgo_payout', 'sitgo_refund'].includes(e?.reason))
      .reverse(); // oldest first
    if (!relevant.length) return null;
    const cumulative = [];
    let sum = 0;
    for (const e of relevant) {
      sum += Number(e?.amount || 0);
      cumulative.push(sum);
    }
    return cumulative;
  })();

  const fmt = (n) => typeof n === 'number' ? n.toLocaleString('it-IT') : '—';
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
    : '';

  const initials = user?.avatar_initials || (user?.username || '?').slice(0, 2).toUpperCase();
  const displayName = user?.display_name || user?.username || '';
  const balance = user?.chips_balance ?? 0;
  const netResult = statsData?.net_result ?? null;

  return (
    <div style={{ paddingBottom: 40 }}>

      {/* Header */}
      <div style={{
        padding: isMobile ? '20px 16px 18px' : '32px 32px 28px',
        borderBottom: '1px solid rgba(212,175,55,0.08)',
        display: 'flex', alignItems: isMobile ? 'flex-start' : 'flex-end', justifyContent: 'space-between', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 14 : 0,
      }}>
        <div style={{ display: 'flex', gap: isMobile ? 14 : 22, alignItems: 'center' }}>
          <div style={{
            width: isMobile ? 64 : 80, height: isMobile ? 64 : 80, borderRadius: '50%',
            background: 'linear-gradient(135deg, #D4AF37, #8a6d1e)',
            color: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Playfair Display, serif', fontSize: isMobile ? 28 : 34, fontWeight: 700,
            boxShadow: '0 6px 20px rgba(212,175,55,0.3)',
          }}>{initials}</div>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.22em', color: 'rgba(245,241,232,0.5)', marginBottom: 5 }}>
              MEMBRO DAL {memberSince.toUpperCase()}
            </div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: isMobile ? 26 : 32, color: '#F5F1E8', fontWeight: 500, letterSpacing: '-0.015em', lineHeight: 1 }}>
              {displayName}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(245,241,232,0.6)', marginTop: 6, fontFamily: 'JetBrains Mono, monospace' }}>
              @{user?.username}
            </div>
          </div>
        </div>

        <div>
          <GoldButton variant="ghost" size="sm" onClick={() => { logout(); navigate('/'); }}>
            Logout
          </GoldButton>
        </div>
      </div>

      {/* Balance + chart */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '280px 1fr', gap: 0, borderBottom: '1px solid rgba(212,175,55,0.08)' }}>
        <div style={{ padding: isMobile ? '18px 16px' : '26px 32px', borderRight: isMobile ? 'none' : '1px solid rgba(212,175,55,0.08)', borderBottom: isMobile ? '1px solid rgba(212,175,55,0.08)' : 'none' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.22em', color: 'rgba(245,241,232,0.5)', marginBottom: 8 }}>SALDO</div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 38, color: '#F5F1E8', fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 4 }}>
            {fmt(balance)} <span style={{ fontSize: 18, color: 'rgba(245,241,232,0.5)' }}>chips</span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(245,241,232,0.55)' }}>Disponibile per il gioco</div>
          <div style={{ marginTop: 22, fontSize: 10, letterSpacing: '0.22em', color: 'rgba(245,241,232,0.5)', marginBottom: 8 }}>RISULTATO NETTO</div>
          {loading
            ? <Skel w={120} h={28} />
            : <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, color: netResult != null && netResult >= 0 ? '#D4AF37' : '#c77', fontWeight: 500, lineHeight: 1 }}>
                {netResult != null ? `${netResult >= 0 ? '+' : ''}${fmt(netResult)}` : '—'}
              </div>
          }
          <div style={{ fontSize: 11, color: 'rgba(245,241,232,0.55)', marginTop: 4 }}>tutto il tempo</div>
        </div>
        <div style={{ padding: isMobile ? '18px 16px' : '26px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: '0.22em', color: '#D4AF37', marginBottom: 4 }}>ANDAMENTO P/L</div>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: '#F5F1E8' }}>Storico chips</div>
            </div>
          </div>
          {loading ? <Skel w="100%" h={170} /> : <div style={{ overflowX: 'auto' }}><PLChart data={plData} /></div>}
        </div>
      </div>

      {/* Recent games */}
      <div style={{ padding: isMobile ? '18px 16px 0' : '26px 32px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.22em', color: '#D4AF37', marginBottom: 6 }}>STORICO PARTITE</div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: '#F5F1E8' }}>Sessioni recenti</div>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map(i => <Skel key={i} w="100%" h={52} />)}
          </div>
        ) : !gameHistory?.length ? (
          <div style={{
            padding: '40px 20px', textAlign: 'center',
            border: '1px solid rgba(212,175,55,0.12)',
            color: 'rgba(245,241,232,0.45)', fontSize: 14,
            fontFamily: 'Inter, sans-serif', fontStyle: 'italic',
          }}>
            Nessuna partita giocata ancora
          </div>
        ) : (
          <div style={{ border: '1px solid rgba(212,175,55,0.12)', overflowX: 'auto' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 2fr 0.7fr 0.7fr 1fr',
              padding: '11px 18px', background: 'rgba(212,175,55,0.04)',
              borderBottom: '1px solid rgba(212,175,55,0.12)',
              fontSize: 9.5, letterSpacing: '0.2em', fontWeight: 600,
              color: 'rgba(245,241,232,0.5)',
            }}>
              <div>DATA</div><div>TAVOLO</div><div>DURATA</div><div>MANI</div><div style={{ textAlign: 'right' }}>BILANCIO</div>
            </div>
            {gameHistory.map((g, i) => {
              const isPos = g.result_chips >= 0;
              const tableLabel = g.table_type === 'sitgo' ? 'Sit & Go' : g.table_name;
              const durStr = g.duration_minutes != null
                ? g.duration_minutes >= 60
                  ? `${Math.floor(g.duration_minutes / 60)}h ${g.duration_minutes % 60}m`
                  : `${g.duration_minutes}m`
                : '—';
              return (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '1fr 2fr 0.7fr 0.7fr 1fr',
                  padding: '14px 18px', alignItems: 'center',
                  borderBottom: i < gameHistory.length - 1 ? '1px solid rgba(212,175,55,0.06)' : 'none',
                }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#F5F1E8', fontFamily: 'Inter, sans-serif' }}>
                      {g.date ? new Date(g.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }).toUpperCase() : '—'}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'rgba(245,241,232,0.5)', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>{g.time || '—'}</div>
                  </div>
                  <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 15, color: '#F5F1E8' }}>{tableLabel}</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'rgba(245,241,232,0.75)' }}>{durStr}</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'rgba(245,241,232,0.75)' }}>{g.hands_played}</div>
                  <div style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: 15, fontWeight: 600, color: isPos ? '#4caf50' : '#e57373' }}>
                    {g.result_chips >= 0 ? '+' : ''}{fmt(g.result_chips)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
