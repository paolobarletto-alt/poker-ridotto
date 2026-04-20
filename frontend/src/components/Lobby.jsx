import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoldButton, TopBar } from './Shell';
import { tablesApi } from '../api/tables';
import CreateTableModal from './CreateTableModal';

// ————— Shimmer keyframes injected once —————
if (typeof document !== 'undefined' && !document.getElementById('ridotto-shimmer')) {
  const tag = document.createElement('style');
  tag.id = 'ridotto-shimmer';
  tag.textContent = `
    @keyframes shimmer {
      0%   { opacity: 0.5; }
      50%  { opacity: 1; }
      100% { opacity: 0.5; }
    }
    @keyframes pulseDot {
      0%, 100% { box-shadow: 0 0 4px rgba(40,200,64,0.5); }
      50%       { box-shadow: 0 0 10px rgba(40,200,64,0.9); }
    }
  `;
  document.head.appendChild(tag);
}

// ————— Data hooks —————
function useTables() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetch = useCallback(() => {
    tablesApi.list()
      .then(res => { setTables(res.data); setError(null); })
      .catch(err => setError(err?.response?.data?.detail || 'Errore'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { fetch(); const id = setInterval(fetch, 10000); return () => clearInterval(id); }, [fetch]);
  return { tables, loading, error };
}

function useSitGos() {
  const [sitgos, setSitGos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetch = useCallback(() => {
    tablesApi.listSitGos()
      .then(res => { setSitGos(res.data); setError(null); })
      .catch(err => setError(err?.response?.data?.detail || 'Errore'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { fetch(); const id = setInterval(fetch, 10000); return () => clearInterval(id); }, [fetch]);
  return { sitgos, loading, error, refresh: fetch };
}

function useOnlineUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetch = useCallback(() => {
    tablesApi.getOnlineUsers()
      .then(res => setUsers(res.data))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { fetch(); const id = setInterval(fetch, 30000); return () => clearInterval(id); }, [fetch]);
  return { users, loading };
}

// ————— Shared components —————
function SpeedBadge({ speed }) {
  const map = {
    fast:   { label: '⚡ FAST',  color: '#D4AF37' },
    normal: { label: 'NORMALE',  color: 'rgba(245,241,232,0.6)' },
    slow:   { label: '🐢 LENTA', color: 'rgba(245,241,232,0.5)' },
  };
  const m = map[speed?.toLowerCase()] || { label: speed?.toUpperCase() || '—', color: 'rgba(245,241,232,0.5)' };
  return (
    <span style={{
      fontFamily: 'Inter, sans-serif', fontSize: 9.5, fontWeight: 600,
      padding: '3px 8px', borderRadius: 2, letterSpacing: '0.12em',
      color: m.color, border: `1px solid ${m.color}33`, background: `${m.color}11`,
    }}>{m.label}</span>
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

function SkeletonRow() {
  return <div style={{ height: 52, margin: '2px 0', background: 'rgba(212,175,55,0.04)', animation: 'shimmer 1.4s ease-in-out infinite' }} />;
}

function SectionHeading({ overline, title, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '36px 32px 18px' }}>
      <div>
        <div style={{ fontSize: 10, letterSpacing: '0.22em', color: '#D4AF37', fontWeight: 600, marginBottom: 6 }}>{overline}</div>
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: '#F5F1E8', fontWeight: 500, letterSpacing: '-0.01em' }}>{title}</div>
      </div>
      {action}
    </div>
  );
}

// ————— Online Users section —————
function OnlineUsersSection({ users, loading }) {
  if (loading) {
    return (
      <div style={{ margin: '0 32px', display: 'flex', gap: 12 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(212,175,55,0.06)', animation: 'shimmer 1.4s ease-in-out infinite',
          }} />
        ))}
      </div>
    );
  }

  if (!users.length) {
    return (
      <div style={{ margin: '0 32px', padding: '20px 0', color: 'rgba(245,241,232,0.4)', fontSize: 13, fontFamily: 'Inter, sans-serif', fontStyle: 'italic' }}>
        Nessun altro utente online al momento
      </div>
    );
  }

  return (
    <div style={{ margin: '0 32px', display: 'flex', flexWrap: 'wrap', gap: 14 }}>
      {users.map(u => (
        <div key={u.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 60 }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(212,175,55,0.3), rgba(212,175,55,0.08))',
              border: '1px solid rgba(212,175,55,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Playfair Display, serif', fontSize: 16, color: '#D4AF37', fontWeight: 600,
            }}>
              {u.avatar_initials}
            </div>
            <div style={{
              position: 'absolute', bottom: 1, right: 1,
              width: 10, height: 10, borderRadius: '50%',
              background: '#28c840', border: '2px solid #0a0a0a',
              animation: 'pulseDot 2s ease-in-out infinite',
            }} />
          </div>
          <div style={{
            fontSize: 10, color: 'rgba(245,241,232,0.7)', fontFamily: 'Inter, sans-serif',
            textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden',
            textOverflow: 'ellipsis', maxWidth: 60,
          }}>
            {u.username}
          </div>
        </div>
      ))}
    </div>
  );
}

// ————— Live Tables (cash + sitgo combined) —————
function LiveTablesSection({ tables, loading, onOpenCreate }) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div style={{ margin: '0 32px', border: '1px solid rgba(212,175,55,0.12)', padding: 8 }}>
        <SkeletonRow /><SkeletonRow /><SkeletonRow />
      </div>
    );
  }

  if (!tables.length) {
    return (
      <div style={{ margin: '0 32px', border: '1px solid rgba(212,175,55,0.12)', padding: '48px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 52, color: '#D4AF37', marginBottom: 16, fontFamily: 'serif' }}>♠</div>
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: '#F5F1E8', marginBottom: 8 }}>Nessun tavolo aperto</div>
        <button onClick={onOpenCreate} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#D4AF37', fontFamily: 'Inter, sans-serif', fontSize: 13,
          textDecoration: 'underline', textDecorationColor: 'rgba(212,175,55,0.4)',
        }}>Sii il primo</button>
      </div>
    );
  }

  return (
    <div style={{ margin: '0 32px', border: '1px solid rgba(212,175,55,0.12)' }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '18px 1.6fr 0.8fr 1fr 1fr 1fr 1fr 1fr',
        padding: '11px 18px', background: 'rgba(212,175,55,0.04)',
        borderBottom: '1px solid rgba(212,175,55,0.12)',
        fontSize: 9.5, letterSpacing: '0.2em', fontWeight: 600, color: 'rgba(245,241,232,0.5)',
      }}>
        <div></div><div>TAVOLO</div><div>TIPO</div><div>LIMITI</div><div>GIOCATORI</div><div>VELOCITÀ</div><div>STATO</div><div></div>
      </div>
      {tables.map((t, i) => {
        const full = t.players_seated >= t.max_seats;
        const stakes = `${t.small_blind}/${t.big_blind}`;
        const typeLabel = t.table_type === 'sitgo' ? 'Sit & Go' : 'Cash';
        return (
          <div key={t.id} style={{
            display: 'grid', gridTemplateColumns: '18px 1.6fr 0.8fr 1fr 1fr 1fr 1fr 1fr',
            padding: '13px 18px', alignItems: 'center',
            borderBottom: i < tables.length - 1 ? '1px solid rgba(212,175,55,0.06)' : 'none',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,175,55,0.03)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {/* Status dot */}
            <span style={{
              display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
              background: t.status === 'running' ? '#28c840' : 'rgba(245,241,232,0.25)',
              animation: t.status === 'running' ? 'pulseDot 2s ease-in-out infinite' : 'none',
            }} />
            {/* Name */}
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, color: '#F5F1E8' }}>{t.name}</div>
            {/* Type */}
            <div><Pill>{typeLabel}</Pill></div>
            {/* Stakes */}
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#F5F1E8' }}>{stakes}</div>
            {/* Players */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#F5F1E8' }}>
                {t.players_seated}<span style={{ color: 'rgba(245,241,232,0.4)' }}>/{t.max_seats}</span>
              </div>
              <div style={{ height: 2, background: 'rgba(245,241,232,0.1)', width: 60 }}>
                <div style={{ height: '100%', width: `${(t.players_seated / t.max_seats) * 100}%`, background: '#D4AF37' }} />
              </div>
            </div>
            {/* Speed */}
            <SpeedBadge speed={t.speed} />
            {/* Status label */}
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10.5, color: t.status === 'running' ? '#28c840' : 'rgba(245,241,232,0.5)' }}>
              {t.status === 'running' ? '● In gioco' : '○ In attesa'}
            </div>
            {/* CTA */}
            <div style={{ textAlign: 'right' }}>
              {full
                ? <GoldButton size="sm" variant="ghost" onClick={() => navigate(`/table/${t.id}`)}>Osserva</GoldButton>
                : <GoldButton size="sm" onClick={() => navigate(`/table/${t.id}`)}>Siediti →</GoldButton>
              }
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ————— Cash table list (dedicated view) —————
function CashTable({ tables, loading, onOpenCreate }) {
  const navigate = useNavigate();
  if (loading) return <div style={{ margin: '0 32px', border: '1px solid rgba(212,175,55,0.12)', padding: 8 }}><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>;
  if (!tables.length) return (
    <div style={{ margin: '0 32px', border: '1px solid rgba(212,175,55,0.12)', padding: '48px 32px', textAlign: 'center' }}>
      <div style={{ fontSize: 52, color: '#D4AF37', marginBottom: 16, fontFamily: 'serif' }}>♠</div>
      <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: '#F5F1E8', marginBottom: 8 }}>Nessun tavolo aperto</div>
      <button onClick={onOpenCreate} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D4AF37', fontFamily: 'Inter, sans-serif', fontSize: 13, textDecoration: 'underline' }}>Sii il primo</button>
    </div>
  );
  return (
    <div style={{ margin: '0 32px', border: '1px solid rgba(212,175,55,0.12)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '18px 1.5fr 1fr 1fr 1fr 1fr 1fr', padding: '11px 18px', background: 'rgba(212,175,55,0.04)', borderBottom: '1px solid rgba(212,175,55,0.12)', fontSize: 9.5, letterSpacing: '0.2em', fontWeight: 600, color: 'rgba(245,241,232,0.5)' }}>
        <div></div><div>TAVOLO</div><div>LIMITI</div><div>GIOCATORI</div><div>VELOCITÀ</div><div>STATO</div><div></div>
      </div>
      {tables.map((t, i) => {
        const full = t.players_seated >= t.max_seats;
        return (
          <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '18px 1.5fr 1fr 1fr 1fr 1fr 1fr', padding: '13px 18px', alignItems: 'center', borderBottom: i < tables.length - 1 ? '1px solid rgba(212,175,55,0.06)' : 'none', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,175,55,0.03)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: t.status === 'running' ? '#28c840' : 'rgba(245,241,232,0.25)', animation: t.status === 'running' ? 'pulseDot 2s ease-in-out infinite' : 'none' }} />
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, color: '#F5F1E8' }}>{t.name}</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#F5F1E8' }}>{t.small_blind}/{t.big_blind}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#F5F1E8' }}>{t.players_seated}<span style={{ color: 'rgba(245,241,232,0.4)' }}>/{t.max_seats}</span></div>
              <div style={{ height: 2, background: 'rgba(245,241,232,0.1)', width: 64 }}><div style={{ height: '100%', width: `${(t.players_seated / t.max_seats) * 100}%`, background: '#D4AF37' }} /></div>
            </div>
            <SpeedBadge speed={t.speed} />
            <div style={{ fontSize: 10.5, color: t.status === 'running' ? '#28c840' : 'rgba(245,241,232,0.5)' }}>{t.status === 'running' ? '● In gioco' : '○ In attesa'}</div>
            <div style={{ textAlign: 'right' }}>
              {full ? <GoldButton size="sm" variant="ghost" onClick={() => navigate(`/table/${t.id}`)}>Osserva</GoldButton>
                     : <GoldButton size="sm" onClick={() => navigate(`/table/${t.id}`)}>Siediti →</GoldButton>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ————— Sit & Go grid —————
function SitGoGrid({ sitgos, loading, myRegistrations, onRegister, onUnregister, onOpenCreate }) {
  const navigate = useNavigate();
  if (loading) return (
    <div style={{ margin: '0 32px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
      {[1, 2, 3].map(i => <div key={i} style={{ height: 160, background: 'rgba(212,175,55,0.04)', border: '1px solid rgba(212,175,55,0.08)', animation: 'shimmer 1.4s ease-in-out infinite' }} />)}
    </div>
  );
  if (!sitgos.length) return (
    <div style={{ margin: '0 32px', border: '1px solid rgba(212,175,55,0.12)', padding: '48px 32px', textAlign: 'center' }}>
      <div style={{ fontSize: 52, color: '#D4AF37', marginBottom: 16, fontFamily: 'serif' }}>♣</div>
      <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: '#F5F1E8', marginBottom: 8 }}>Nessun Sit & Go disponibile</div>
      <button onClick={onOpenCreate} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D4AF37', fontFamily: 'Inter, sans-serif', fontSize: 13, textDecoration: 'underline' }}>Crea il primo</button>
    </div>
  );
  return (
    <div style={{ margin: '0 32px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
      {sitgos.map(s => {
        const registered = myRegistrations.has(s.id);
        const running = s.status === 'running';
        const n = s.n_registered ?? 0;
        return (
          <div key={s.id} style={{ border: '1px solid rgba(212,175,55,0.15)', padding: '20px 22px', background: 'linear-gradient(180deg, rgba(20,64,42,0.25), transparent)', position: 'relative' }}>
            {running && <span style={{ position: 'absolute', top: 14, right: 14, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.12em', padding: '2px 7px', borderRadius: 2, background: '#c0392b', color: '#fff' }}>LIVE</span>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 9.5, letterSpacing: '0.22em', color: 'rgba(245,241,232,0.45)', marginBottom: 4 }}>{s.max_seats} POSTI · {s.speed?.toUpperCase()}</div>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: '#F5F1E8', fontWeight: 500 }}>{s.name}</div>
              </div>
              <Pill accent={n / s.max_seats > 0.75}>{n}/{s.max_seats}</Pill>
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              {Array.from({ length: s.max_seats }).map((_, i) => <div key={i} style={{ flex: 1, height: 3, background: i < n ? '#D4AF37' : 'rgba(245,241,232,0.1)' }} />)}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(245,241,232,0.55)', marginBottom: 14 }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#D4AF37' }}>{(s.starting_chips ?? 0).toLocaleString('it-IT')}</span> chips di partenza
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {registered && !running ? <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.12em', padding: '3px 8px', borderRadius: 2, background: 'rgba(212,175,55,0.15)', color: '#D4AF37', border: '1px solid rgba(212,175,55,0.3)' }}>In attesa</span> : <span />}
              <div style={{ display: 'flex', gap: 8 }}>
                {running ? <GoldButton size="sm" variant="ghost" onClick={() => s.table_id && navigate(`/table/${s.table_id}`)}>Osserva</GoldButton>
                  : registered ? <GoldButton size="sm" variant="ghost" onClick={() => onUnregister(s.id)}>Ritira</GoldButton>
                  : <GoldButton size="sm" onClick={() => onRegister(s.id)}>Iscriviti</GoldButton>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ————— Main Lobby —————
export default function Lobby({ view = 'lobby' }) {
  const { tables, loading: tablesLoading } = useTables();
  const { sitgos, loading: sitgosLoading, refresh: refreshSitGos } = useSitGos();
  const { users: onlineUsers, loading: onlineLoading } = useOnlineUsers();
  const [myRegistrations, setMyRegistrations] = useState(new Set());
  const [loadingReg, setLoadingReg] = useState(null);
  const [createModal, setCreateModal] = useState(null);

  const handleRegister = async (id) => {
    setLoadingReg(id);
    try { await tablesApi.registerSitGo(id); setMyRegistrations(prev => new Set([...prev, id])); refreshSitGos(); }
    catch (e) { console.error(e); } finally { setLoadingReg(null); }
  };

  const handleUnregister = async (id) => {
    setLoadingReg(id);
    try { await tablesApi.unregisterSitGo(id); setMyRegistrations(prev => { const s = new Set(prev); s.delete(id); return s; }); refreshSitGos(); }
    catch (e) { console.error(e); } finally { setLoadingReg(null); }
  };

  const modal = createModal && (
    <CreateTableModal isOpen onClose={() => setCreateModal(null)} defaultType={createModal === 'table' ? undefined : createModal} />
  );

  if (view === 'cash') return (
    <div style={{ paddingBottom: 40 }}>
      <TopBar subtitle={`CASH GAME · ${tables.length} TAVOLI`} title="Cash Game"
        actions={<GoldButton variant="ghost" size="sm" onClick={() => setCreateModal('cash')}>＋ Tavolo</GoldButton>} />
      <div style={{
        padding: '10px 28px 20px',
        fontFamily: 'Inter, sans-serif', fontSize: 13,
        color: 'rgba(245,241,232,0.45)', lineHeight: 1.6,
        borderBottom: '1px solid rgba(212,175,55,0.08)',
      }}>
        Gioca quando vuoi, siediti e alzati liberamente. Le chip sono reali ma il tuo bankroll rimane sempre tuo — nessun buy-in fisso, nessun vincolo di tempo.
      </div>
      <CashTable tables={tables} loading={tablesLoading} onOpenCreate={() => setCreateModal('cash')} />
      {modal}
    </div>
  );

  if (view === 'sitgo') return (
    <div style={{ paddingBottom: 40 }}>
      <TopBar subtitle="SIT & GO" title="Sit & Go"
        actions={<GoldButton variant="ghost" size="sm" onClick={() => setCreateModal('table')}>＋ Tavolo</GoldButton>} />
      <div style={{
        padding: '10px 28px 20px',
        fontFamily: 'Inter, sans-serif', fontSize: 13,
        color: 'rgba(245,241,232,0.45)', lineHeight: 1.6,
        borderBottom: '1px solid rgba(212,175,55,0.08)',
      }}>
        Torneo rapido che inizia non appena i posti sono esauriti. Tutti partono con lo stesso stack, i ciechi salgono nel tempo — vince chi elimina tutti gli altri.
      </div>
      <SitGoGrid sitgos={sitgos} loading={sitgosLoading} myRegistrations={myRegistrations}
        onRegister={handleRegister} onUnregister={handleUnregister} onOpenCreate={() => setCreateModal('sitgo')} />
      {modal}
    </div>
  );

  // ————— Default: overview —————
  const allLiveTables = [...tables, ...sitgos.filter(s => s.status === 'running' && s.table_id)
    .map(s => ({ id: s.table_id, name: s.name, table_type: 'sitgo', small_blind: '—', big_blind: '—', players_seated: s.n_registered, max_seats: s.max_seats, speed: s.speed, status: 'running' }))];

  return (
    <div style={{ paddingBottom: 40 }}>
      <TopBar
        subtitle={`BENTORNATO · ${new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}`}
        title="Lobby"
      />

      <SectionHeading
        overline={`ONLINE ORA · ${onlineUsers.length} ${onlineUsers.length === 1 ? 'GIOCATORE' : 'GIOCATORI'}`}
        title="Utenti online"
      />
      <OnlineUsersSection users={onlineUsers} loading={onlineLoading} />

      <SectionHeading
        overline={`TAVOLI LIVE · ${tables.length + sitgos.filter(s => s.status === 'running').length} ATTIVI`}
        title="Tavoli aperti"
        action={<GoldButton variant="ghost" size="sm" onClick={() => setCreateModal('table')}>＋ Tavolo</GoldButton>}
      />
      <LiveTablesSection tables={tables} loading={tablesLoading} onOpenCreate={() => setCreateModal('table')} />

      {sitgos.length > 0 && (
        <>
          <SectionHeading overline="RAPIDO · INIZIA QUANDO SEI PRONTO" title="Sit & Go" />
          <SitGoGrid sitgos={sitgos} loading={sitgosLoading} myRegistrations={myRegistrations}
            onRegister={handleRegister} onUnregister={handleUnregister} onOpenCreate={() => setCreateModal('table')} />
        </>
      )}

      {modal}
    </div>
  );
}