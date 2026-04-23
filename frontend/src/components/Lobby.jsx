import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoldButton, TopBar } from './Shell';
import { tablesApi } from '../api/tables';
import { useAuth } from '../context/AuthContext';
import CreateTableModal from './CreateTableModal';

if (typeof document !== 'undefined' && !document.getElementById('ridotto-shimmer')) {
  const tag = document.createElement('style');
  tag.id = 'ridotto-shimmer';
  tag.textContent = `
    @keyframes shimmer { 0% { opacity: 0.5; } 50% { opacity: 1; } 100% { opacity: 0.5; } }
    @keyframes pulseDot { 0%,100% { box-shadow: 0 0 4px rgba(40,200,64,0.5); } 50% { box-shadow: 0 0 10px rgba(40,200,64,0.9); } }
  `;
  document.head.appendChild(tag);
}

function normalizeSitGo(row = {}) {
  const statusRaw = String(row.status ?? row.tournament_status ?? '').toLowerCase();
  const status = statusRaw || 'registering';
  return {
    id: String(row.id ?? row.tournament_id ?? ''),
    name: row.name ?? row.title ?? 'Sit & Go',
    speed: row.speed ?? 'normal',
    maxSeats: Number(row.max_seats ?? row.maxSeats ?? 0),
    minPlayers: Number(row.min_players ?? row.minPlayers ?? 2),
    nRegistered: Number(row.n_registered ?? row.registered_count ?? row.players_seated ?? 0),
    status,
    tableId: row.table_id ?? row.tableId ?? row.poker_table_id ?? null,
    startingChips: Number(row.starting_chips ?? row.buyin ?? row.min_buyin ?? 0),
    buyIn: Number(row.buy_in ?? row.buyin ?? row.min_buyin ?? 0),
    prizePool: Number(row.prize_pool ?? 0),
    payoutStructure: Array.isArray(row.payout_structure) ? row.payout_structure : [],
    creatorUsername: row.creator_username ?? row.created_by_username ?? row.creator ?? '',
    creatorId: row.created_by ?? row.creator_id ?? null,
    isRegistered: row.is_registered ?? row.registered ?? row.me_registered ?? null,
  };
}

function useTables() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetch = useCallback(() => {
    tablesApi.list()
      .then((res) => { setTables(Array.isArray(res.data) ? res.data : []); setError(null); })
      .catch((err) => setError(err?.response?.data?.detail || 'Errore caricamento tavoli'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { fetch(); const id = setInterval(fetch, 10000); return () => clearInterval(id); }, [fetch]);
  return { tables, loading, error, refresh: fetch };
}

function useSitGos() {
  const [sitgos, setSitgos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(() => {
    const fallbackFromTables = async () => {
      const fallback = await tablesApi.list();
      const fromTables = (Array.isArray(fallback.data) ? fallback.data : [])
        .filter((t) => String(t.table_type).toLowerCase() === 'sitgo')
        .map((t) => normalizeSitGo({
          id: t.id,
          name: t.name,
          speed: t.speed,
          max_seats: t.max_seats,
          min_players: t.min_players,
          players_seated: t.players_seated,
          status: t.status === 'waiting' ? 'registering' : t.status,
          table_id: t.id,
          starting_chips: t.min_buyin ?? t.max_buyin,
          buy_in: t.min_buyin ?? t.max_buyin,
        }));
      setSitgos(fromTables);
      setError(null);
    };

    tablesApi.listSitGos()
      .then((res) => {
        const rows = Array.isArray(res.data) ? res.data.map(normalizeSitGo) : [];
        setSitgos(rows);
        setError(null);
      })
      .catch(async (err) => {
        try {
          await fallbackFromTables();
        } catch {
          const detail = String(err?.response?.data?.detail ?? '');
          setSitgos([]);
          if (detail.includes('UndefinedColumnError') || detail.includes('UndefinedTableError') || detail.includes('ProgrammingError')) {
            setError('Backend Sit&Go non aggiornato: applica migrazioni DB');
          } else {
            setError(detail || 'Errore caricamento tornei');
          }
        }
      })
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
      .then((res) => setUsers(Array.isArray(res.data) ? res.data : []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { fetch(); const id = setInterval(fetch, 30000); return () => clearInterval(id); }, [fetch]);
  return { users, loading };
}

function SpeedBadge({ speed }) {
  const map = {
    fast: { label: '⚡ FAST', color: '#D4AF37' },
    normal: { label: 'NORMALE', color: 'rgba(245,241,232,0.6)' },
    slow: { label: '🐢 LENTA', color: 'rgba(245,241,232,0.5)' },
  };
  const m = map[String(speed).toLowerCase()] || { label: String(speed || '—').toUpperCase(), color: 'rgba(245,241,232,0.5)' };
  return <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 9.5, fontWeight: 600, padding: '3px 8px', borderRadius: 2, letterSpacing: '0.12em', color: m.color, border: `1px solid ${m.color}33`, background: `${m.color}11` }}>{m.label}</span>;
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

function SectionDivider() {
  return (
    <div style={{ margin: '24px 32px 0' }}>
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.45), transparent)' }} />
    </div>
  );
}

function OnlineUsersSection({ users, loading }) {
  if (loading) {
    return <div style={{ margin: '0 32px', display: 'flex', gap: 12 }}>{[1, 2, 3, 4].map((i) => <div key={i} style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(212,175,55,0.06)', animation: 'shimmer 1.4s ease-in-out infinite' }} />)}</div>;
  }
  if (!users.length) return <div style={{ margin: '0 32px', padding: '20px 0', color: 'rgba(245,241,232,0.4)', fontSize: 13, fontFamily: 'Inter, sans-serif', fontStyle: 'italic' }}>Nessun altro utente online al momento</div>;
  return (
    <div style={{ margin: '0 32px', display: 'flex', flexWrap: 'wrap', gap: 14 }}>
      {users.map((u) => (
        <div key={u.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 60 }}>
          <div style={{ position: 'relative' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(212,175,55,0.3), rgba(212,175,55,0.08))', border: '1px solid rgba(212,175,55,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Playfair Display, serif', fontSize: 16, color: '#D4AF37', fontWeight: 600 }}>{u.avatar_initials}</div>
            <div style={{ position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: '50%', background: '#28c840', border: '2px solid #0a0a0a', animation: 'pulseDot 2s ease-in-out infinite' }} />
          </div>
          <div style={{ fontSize: 10, color: 'rgba(245,241,232,0.7)', fontFamily: 'Inter, sans-serif', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 60 }}>{u.username}</div>
        </div>
      ))}
    </div>
  );
}

function CashTable({ tables, loading, onOpenCreate }) {
  const navigate = useNavigate();
  if (loading) return <div style={{ margin: '0 32px', border: '1px solid rgba(212,175,55,0.12)', padding: 8 }}><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>;
  if (!tables.length) return (
    <div style={{ margin: '0 32px', border: '1px solid rgba(212,175,55,0.12)', padding: '48px 32px', textAlign: 'center' }}>
      <div style={{ fontSize: 52, color: '#D4AF37', marginBottom: 16, fontFamily: 'serif' }}>♠</div>
      <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: '#F5F1E8', marginBottom: 8 }}>Nessun tavolo cash aperto</div>
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
          <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '18px 1.5fr 1fr 1fr 1fr 1fr 1fr', padding: '13px 18px', alignItems: 'center', borderBottom: i < tables.length - 1 ? '1px solid rgba(212,175,55,0.06)' : 'none' }}>
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
              {full ? <GoldButton size="sm" variant="ghost" onClick={() => navigate(`/table/${t.id}`)}>Osserva</GoldButton> : <GoldButton size="sm" onClick={() => navigate(`/table/${t.id}`)}>Siediti →</GoldButton>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SitGoSection({ tournaments, loading, error, busyMap, isRegistered, onRegisterToggle, onOpenCreate, currentUser }) {
  const navigate = useNavigate();
  const statusMeta = {
    registering: { label: 'In registrazione', color: 'rgba(212,175,55,0.9)' },
    waiting: { label: 'In registrazione', color: 'rgba(212,175,55,0.9)' },
    running: { label: 'In corso', color: '#28c840' },
    finished: { label: 'Concluso', color: 'rgba(245,241,232,0.45)' },
  };

  if (loading) return <div style={{ margin: '0 32px', border: '1px solid rgba(212,175,55,0.12)', padding: 8 }}><SkeletonRow /><SkeletonRow /></div>;
  if (error) return <div style={{ margin: '0 32px', padding: '14px 16px', border: '1px solid rgba(200,60,60,0.35)', color: 'rgba(235,120,120,0.92)', fontFamily: 'Inter, sans-serif', fontSize: 12 }}>{error}</div>;
  if (!tournaments.length) return (
    <div style={{ margin: '0 32px', border: '1px solid rgba(212,175,55,0.12)', padding: '36px 28px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, color: '#F5F1E8', marginBottom: 8 }}>Nessun Sit & Go disponibile</div>
      <button onClick={onOpenCreate} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D4AF37', fontFamily: 'Inter, sans-serif', fontSize: 13, textDecoration: 'underline' }}>Crea il primo torneo</button>
    </div>
  );

  return (
    <div style={{ margin: '0 32px', border: '1px solid rgba(212,175,55,0.12)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr 0.8fr 1fr 1.4fr', padding: '11px 18px', background: 'rgba(212,175,55,0.04)', borderBottom: '1px solid rgba(212,175,55,0.12)', fontSize: 9.5, letterSpacing: '0.2em', fontWeight: 600, color: 'rgba(245,241,232,0.5)' }}>
        <div>TORNEO</div><div>STATO</div><div>ISCRITTI</div><div>VEL.</div><div>BUY-IN</div><div style={{ textAlign: 'right' }}>AZIONI</div>
      </div>
      {tournaments.map((t, i) => {
        const registered = isRegistered(t);
        const isCreator = (
          (t.creatorId && currentUser?.id && String(t.creatorId) === String(currentUser.id)) ||
          (t.creatorUsername && currentUser?.username && String(t.creatorUsername).toLowerCase() === String(currentUser.username).toLowerCase())
        );
        const canEnterTable = t.status === 'running' && t.tableId;
        const canRegister = t.status === 'registering' || t.status === 'waiting';
        const busy = !!busyMap[t.id];
        const full = t.nRegistered >= t.maxSeats;
        const showRegisterButton = canRegister && !(isCreator && registered);
        const registerDisabled = busy || (!registered && full);
        const sMeta = statusMeta[t.status] ?? { label: t.status, color: 'rgba(245,241,232,0.55)' };
        return (
          <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr 0.8fr 1fr 1.4fr', padding: '13px 18px', alignItems: 'center', borderBottom: i < tournaments.length - 1 ? '1px solid rgba(212,175,55,0.06)' : 'none' }}>
            <div>
              <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, color: '#F5F1E8' }}>{t.name}</div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, color: 'rgba(245,241,232,0.45)', marginTop: 2 }}>
                {t.creatorUsername ? `Creato da ${t.creatorUsername}` : 'Sit & Go'} · min {t.minPlayers}
              </div>
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 11.5, color: sMeta.color }}>{sMeta.label}</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#F5F1E8' }}>
              {t.nRegistered}<span style={{ color: 'rgba(245,241,232,0.4)' }}>/{t.maxSeats || '—'}</span>{registered ? <span style={{ color: '#D4AF37' }}> · Tu</span> : ''}
            </div>
            <SpeedBadge speed={t.speed} />
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#D4AF37' }}>
              {(t.buyIn || t.startingChips || 0).toLocaleString('it-IT')}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              {canEnterTable && <GoldButton size="sm" onClick={() => navigate(`/table/${t.tableId}`)}>Entra</GoldButton>}
              {showRegisterButton && (
                <GoldButton
                  size="sm"
                  variant={registered ? 'ghost' : 'solid'}
                  onClick={() => !registerDisabled && onRegisterToggle(t, registered)}
                  style={registerDisabled ? { opacity: 0.45, cursor: 'not-allowed' } : {}}
                >
                  {busy ? '...' : registered ? 'Ritirati' : (full ? 'Pieno' : 'Iscriviti')}
                </GoldButton>
              )}
              {canRegister && !showRegisterButton && (
                <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'rgba(245,241,232,0.55)', letterSpacing: '0.08em' }}>
                  Già iscritto (creatore)
                </span>
              )}
              {!canEnterTable && !canRegister && <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'rgba(245,241,232,0.45)', letterSpacing: '0.08em' }}>Concluso</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Lobby({ view = 'lobby' }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tables, loading: tablesLoading } = useTables();
  const { users: onlineUsers, loading: onlineLoading } = useOnlineUsers();
  const { sitgos, loading: sitgoLoading, error: sitgoError, refresh: refreshSitGos } = useSitGos();
  const [createModal, setCreateModal] = useState(null);
  const [busyMap, setBusyMap] = useState({});
  const [registrationState, setRegistrationState] = useState({});
  const [sitgoActionError, setSitgoActionError] = useState('');
  const [uiError, setUiError] = useState('');

  const cashTables = useMemo(() => tables.filter((t) => String(t.table_type).toLowerCase() !== 'sitgo'), [tables]);

  useEffect(() => {
    if (!user?.id || !sitgos.length) return;
    let active = true;
    Promise.all(
      sitgos.map((t) =>
        tablesApi.getSitGo(t.id)
          .then((res) => ({ id: t.id, registrations: res.data?.registrations ?? [] }))
          .catch(() => null)
      )
    ).then((rows) => {
      if (!active) return;
      const next = {};
      rows.filter(Boolean).forEach((row) => {
        next[row.id] = row.registrations.some((r) => String(r.user_id) === String(user.id));
      });
      if (Object.keys(next).length > 0) {
        setRegistrationState((prev) => ({ ...prev, ...next }));
      }
    });
    return () => { active = false; };
  }, [sitgos, user?.id]);

  const isRegistered = useCallback((t) => {
    const explicit = t.isRegistered;
    if (explicit != null) return !!explicit;
    const isCreator = (
      (t.creatorId && user?.id && String(t.creatorId) === String(user.id)) ||
      (t.creatorUsername && user?.username && String(t.creatorUsername).toLowerCase() === String(user.username).toLowerCase())
    );
    if (isCreator && Number(t.nRegistered || 0) > 0) return true;
    if (registrationState[t.id] != null) return !!registrationState[t.id];
    return false;
  }, [registrationState, user?.id, user?.username]);

  useEffect(() => {
    const nextError = sitgoActionError || sitgoError || '';
    if (!nextError) return;
    setUiError(nextError);
    const timeoutId = setTimeout(() => {
      setUiError('');
      setSitgoActionError('');
    }, 3000);
    return () => clearTimeout(timeoutId);
  }, [sitgoActionError, sitgoError]);

  const handleRegisterToggle = useCallback(async (t, registered) => {
    if (!t?.id) return;
    setSitgoActionError('');
    setBusyMap((prev) => ({ ...prev, [t.id]: true }));
    try {
      if (registered) {
        await tablesApi.unregisterSitGo(t.id);
        setRegistrationState((prev) => ({ ...prev, [t.id]: false }));
      } else {
        await tablesApi.registerSitGo(t.id);
        setRegistrationState((prev) => ({ ...prev, [t.id]: true }));
      }
      await refreshSitGos();
    } catch (err) {
      const raw = String(err?.response?.data?.detail ?? 'Operazione non riuscita');
      const message = raw.includes('non accetta più iscrizioni')
        ? 'Iscrizioni chiuse: il torneo è già partito'
        : raw;
      setSitgoActionError(message);
    } finally {
      setBusyMap((prev) => ({ ...prev, [t.id]: false }));
    }
  }, [refreshSitGos]);

  const modal = createModal && (
    <CreateTableModal
      isOpen
      onClose={() => setCreateModal(null)}
      defaultType={createModal}
      forcedType={createModal}
    />
  );

  if (view === 'cash') {
    return (
      <div style={{ paddingBottom: 40 }}>
        <TopBar subtitle={`CASH GAME · ${cashTables.length} TAVOLI`} title="Cash Game" actions={<GoldButton variant="ghost" size="sm" onClick={() => setCreateModal('cash')}>＋ Tavolo</GoldButton>} />
        <div style={{ padding: '10px 28px 20px', fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(245,241,232,0.45)', lineHeight: 1.6, borderBottom: '1px solid rgba(212,175,55,0.08)' }}>
          Gioca quando vuoi, siediti e alzati liberamente. Nessun buy-in fisso, nessun vincolo di tempo.
        </div>
        <SectionDivider />
        <CashTable tables={cashTables} loading={tablesLoading} onOpenCreate={() => setCreateModal('cash')} />
        {modal}
      </div>
    );
  }

  if (view === 'sitgo') {
    return (
      <div style={{ paddingBottom: 40 }}>
        <TopBar subtitle={`SIT & GO · ${sitgos.length} TORNEI`} title="Sit & Go" actions={<GoldButton variant="ghost" size="sm" onClick={() => setCreateModal('sitgo')}>＋ Torneo</GoldButton>} />
        <div style={{ padding: '10px 28px 20px', fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'rgba(245,241,232,0.45)', lineHeight: 1.6, borderBottom: '1px solid rgba(212,175,55,0.08)' }}>
          Iscriviti, aspetta che il tavolo sia completo e gioca fino all'ultimo chip.
        </div>
        <SectionDivider />
        <SitGoSection
          tournaments={sitgos}
          loading={sitgoLoading}
          error={uiError}
          busyMap={busyMap}
          isRegistered={isRegistered}
          onRegisterToggle={handleRegisterToggle}
          currentUser={user}
          onOpenCreate={() => setCreateModal('sitgo')}
        />
        {modal}
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <TopBar subtitle={`BENTORNATO ${user?.display_name ? `· ${String(user.display_name).toUpperCase()}` : ''}`} title="Lobby" />

      <SectionHeading overline={`ONLINE ORA · ${onlineUsers.length} ${onlineUsers.length === 1 ? 'GIOCATORE' : 'GIOCATORI'}`} title="Utenti online" />
      <OnlineUsersSection users={onlineUsers} loading={onlineLoading} />
      <SectionDivider />

      <SectionHeading overline={`CASH GAME · ${cashTables.length} TAVOLI`} title="Tavoli Cash" action={<GoldButton variant="ghost" size="sm" onClick={() => navigate('/lobby/cash')}>Vedi tutti</GoldButton>} />
      <CashTable tables={cashTables} loading={tablesLoading} onOpenCreate={() => setCreateModal('cash')} />
      <SectionDivider />

      <SectionHeading overline={`SIT & GO · ${sitgos.length} TORNEI`} title="Tornei Sit & Go" action={<GoldButton variant="ghost" size="sm" onClick={() => navigate('/lobby/sitgo')}>Vedi tutti</GoldButton>} />
      <SitGoSection
        tournaments={sitgos}
        loading={sitgoLoading}
        error={uiError}
        busyMap={busyMap}
        isRegistered={isRegistered}
        onRegisterToggle={handleRegisterToggle}
        currentUser={user}
        onOpenCreate={() => setCreateModal('sitgo')}
      />

      {modal}
    </div>
  );
}
