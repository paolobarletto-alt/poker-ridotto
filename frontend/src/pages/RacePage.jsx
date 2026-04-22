import { useEffect, useState } from 'react';
import api from '../api/client';
import { Sidebar } from '../components/Shell';
import { useAuth } from '../context/AuthContext';

export default function RacePage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState('weekly');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api.get(`/users/race?period=${period}`)
      .then(res => {
        if (!mounted) return;
        setRows(Array.isArray(res?.data) ? res.data : []);
      })
      .catch(() => { if (mounted) setRows([]); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [period]);

  const fmt = (n) => typeof n === 'number' ? n.toLocaleString('it-IT') : '—';

  return (
    <div style={{ display: 'flex', height: '100%', background: '#050505' }}>
      <Sidebar user={user} />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: '0.22em', color: '#D4AF37' }}>RACE</div>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: '#F5F1E8' }}>Classifica profitti</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setPeriod('weekly')} style={{ padding: '8px 12px', background: period === 'weekly' ? '#D4AF37' : 'transparent', border: '1px solid rgba(212,175,55,0.12)', cursor: 'pointer' }}>Settimanale</button>
              <button onClick={() => setPeriod('monthly')} style={{ padding: '8px 12px', background: period === 'monthly' ? '#D4AF37' : 'transparent', border: '1px solid rgba(212,175,55,0.12)', cursor: 'pointer' }}>Mensile</button>
              <button onClick={() => setPeriod('annual')} style={{ padding: '8px 12px', background: period === 'annual' ? '#D4AF37' : 'transparent', border: '1px solid rgba(212,175,55,0.12)', cursor: 'pointer' }}>Annuale</button>
            </div>
          </div>

          <div style={{ border: '1px solid rgba(212,175,55,0.08)', padding: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 160px', padding: '10px 12px', background: 'rgba(212,175,55,0.03)', color: 'rgba(245,241,232,0.6)', fontSize: 12, fontWeight: 700 }}>
              <div>#</div>
              <div>Giocatore</div>
              <div style={{ textAlign: 'right' }}>Profitto</div>
            </div>

            {loading ? (
              <div style={{ padding: 16, color: 'rgba(245,241,232,0.45)' }}>Caricamento...</div>
            ) : (
              <div>
                {rows.map((r, i) => (
                  <div key={r.username} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 160px', padding: '12px', borderBottom: '1px solid rgba(212,175,55,0.04)', alignItems: 'center' }}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace' }}>{i + 1}</div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #D4AF37, #8a6d1e)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0a0a0a', fontFamily: 'Playfair Display, serif', fontWeight: 700 }}>{(r.avatar_initials || (r.username || '?').slice(0,2)).toUpperCase()}</div>
                      <div>
                        <div style={{ fontFamily: 'Playfair Display, serif', color: '#F5F1E8', fontSize: 14 }}>{r.display_name || r.username}</div>
                        <div style={{ fontSize: 12, color: 'rgba(245,241,232,0.5)' }}>{r.username}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, color: (r.profit >= 0 ? '#28c840' : '#c0392b') }}>{r.profit >= 0 ? '+' : ''}{fmt(r.profit)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
