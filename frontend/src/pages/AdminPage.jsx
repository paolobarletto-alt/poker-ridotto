import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AppFrame, TopBar, GoldButton } from '../components/Shell';
import api from '../api/client';
import { tablesApi } from '../api/tables';
import { useViewport } from '../hooks/useViewport';

// ————— Shared primitives —————

const LABEL_STYLE = {
  display: 'block', fontSize: 9.5, letterSpacing: '0.2em', fontWeight: 600,
  color: 'rgba(245,241,232,0.5)', marginBottom: 7, fontFamily: 'Inter, sans-serif',
};

const INPUT_STYLE = {
  padding: '9px 12px', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(212,175,55,0.2)', color: '#F5F1E8',
  fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none',
  transition: 'border-color 0.15s', width: '100%',
};

function Field({ label, type = 'text', value, onChange, placeholder, min }) {
  return (
    <div>
      <label style={LABEL_STYLE}>{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} min={min}
        style={INPUT_STYLE}
        onFocus={e => (e.target.style.borderColor = '#D4AF37')}
        onBlur={e => (e.target.style.borderColor = 'rgba(212,175,55,0.2)')}
      />
    </div>
  );
}

function Badge({ children, color }) {
  const colors = {
    green:  { bg: 'rgba(40,200,80,0.1)',  border: 'rgba(40,200,80,0.3)',  text: '#5de87a' },
    red:    { bg: 'rgba(192,57,43,0.1)',  border: 'rgba(192,57,43,0.3)',  text: '#e07070' },
    gold:   { bg: 'rgba(212,175,55,0.1)', border: 'rgba(212,175,55,0.3)', text: '#D4AF37' },
    muted:  { bg: 'rgba(245,241,232,0.05)', border: 'rgba(245,241,232,0.12)', text: 'rgba(245,241,232,0.5)' },
  };
  const c = colors[color] || colors.muted;
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em',
      padding: '3px 8px', fontFamily: 'Inter, sans-serif',
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
    }}>{children}</span>
  );
}

function SmallButton({ children, onClick, variant = 'ghost', disabled }) {
  const solid = variant === 'solid';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '5px 12px', fontSize: 10.5, fontWeight: 600,
        letterSpacing: '0.12em', textTransform: 'uppercase',
        fontFamily: 'Inter, sans-serif', cursor: disabled ? 'not-allowed' : 'pointer',
        border: solid ? 'none' : '1px solid rgba(212,175,55,0.35)',
        background: solid ? 'linear-gradient(180deg, #E8C252, #B8941F)' : 'transparent',
        color: solid ? '#0a0a0a' : '#D4AF37',
        opacity: disabled ? 0.45 : 1,
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => !disabled && !solid && (e.currentTarget.style.background = 'rgba(212,175,55,0.08)')}
      onMouseLeave={e => !solid && (e.currentTarget.style.background = 'transparent')}
    >{children}</button>
  );
}

function TableHead({ cols }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: cols,
      padding: '10px 18px', background: 'rgba(212,175,55,0.04)',
      borderBottom: '1px solid rgba(212,175,55,0.12)',
      fontSize: 9.5, letterSpacing: '0.2em', fontWeight: 600,
      color: 'rgba(245,241,232,0.45)', fontFamily: 'Inter, sans-serif',
    }}>
    </div>
  );
}

function ErrorLine({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      padding: '9px 13px', background: 'rgba(192,57,43,0.08)',
      border: '1px solid rgba(192,57,43,0.3)',
      fontSize: 12, color: '#e08080', fontFamily: 'Inter, sans-serif',
    }}>{msg}</div>
  );
}

// ————— Invites tab —————

function InvitesTab() {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState('');
  const [maxUses, setMaxUses] = useState('1');
  const [generating, setGenerating] = useState(false);
  const [newLink, setNewLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const fetchInvites = useCallback(async () => {
    try {
      const res = await api.get('/admin/invites');
      setInvites(res.data);
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInvites(); }, [fetchInvites]);

  const handleGenerate = async () => {
    setError('');
    setGenerating(true);
    try {
      const body = { max_uses: parseInt(maxUses) || 1 };
      if (expiresInDays) body.expires_in_days = parseInt(expiresInDays);
      const res = await api.post('/admin/invites', body);
      setNewLink(res.data.invite_link || res.data.code);
      setShowForm(false);
      setExpiresInDays('');
      setMaxUses('1');
      fetchInvites();
    } catch (err) {
      setError(err.response?.data?.detail || 'Errore nella generazione');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(newLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeactivate = async (code) => {
    try {
      await api.delete(`/admin/invites/${code}`);
      fetchInvites();
    } catch {}
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' });
  };

  return (
    <div style={{ padding: '28px 32px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: '0.22em', color: '#D4AF37', fontWeight: 600, marginBottom: 4 }}>
            GESTIONE ACCESSI
          </div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: '#F5F1E8' }}>
            Codici invito
          </div>
        </div>
        <GoldButton size="sm" onClick={() => { setShowForm(s => !s); setNewLink(null); }}>
          {showForm ? '✕ Annulla' : '+ Genera invito'}
        </GoldButton>
      </div>

      {/* Generate form */}
      {showForm && (
        <div style={{
          marginBottom: 24, padding: '22px 24px',
          border: '1px solid rgba(212,175,55,0.2)',
          background: 'rgba(212,175,55,0.03)',
        }}>
          <div style={{
            fontSize: 10, letterSpacing: '0.22em', color: '#D4AF37',
            fontWeight: 600, marginBottom: 18,
          }}>NUOVO CODICE INVITO</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
            <Field
              label="SCADENZA (giorni, lascia vuoto = mai)"
              type="number" min="1"
              value={expiresInDays}
              onChange={setExpiresInDays}
              placeholder="es. 7"
            />
            <Field
              label="USI MASSIMI"
              type="number" min="1"
              value={maxUses}
              onChange={setMaxUses}
              placeholder="1"
            />
          </div>
          <ErrorLine msg={error} />
          {!error && <div style={{ height: error ? 0 : 12 }} />}
          <SmallButton variant="solid" onClick={handleGenerate} disabled={generating}>
            {generating ? 'Generazione…' : 'Genera codice'}
          </SmallButton>
        </div>
      )}

      {/* Generated link banner */}
      {newLink && (
        <div style={{
          marginBottom: 24, padding: '16px 20px',
          border: '1px solid rgba(212,175,55,0.4)',
          background: 'rgba(212,175,55,0.06)',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 9.5, letterSpacing: '0.2em', color: '#D4AF37', marginBottom: 6 }}>
              ✓ LINK INVITO GENERATO
            </div>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
              color: '#F5F1E8', wordBreak: 'break-all',
            }}>{newLink}</div>
          </div>
          <SmallButton onClick={handleCopy}>
            {copied ? '✓ Copiato' : 'Copia'}
          </SmallButton>
        </div>
      )}

      {/* Table */}
      <div style={{ border: '1px solid rgba(212,175,55,0.12)' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 2fr 0.8fr 1fr 0.8fr 0.8fr',
          padding: '10px 18px',
          background: 'rgba(212,175,55,0.04)',
          borderBottom: '1px solid rgba(212,175,55,0.12)',
          fontSize: 9.5, letterSpacing: '0.2em', fontWeight: 600,
          color: 'rgba(245,241,232,0.45)', fontFamily: 'Inter, sans-serif',
        }}>
          <div>CODICE</div>
          <div>LINK</div>
          <div>USATO</div>
          <div>SCADENZA</div>
          <div>STATO</div>
          <div></div>
        </div>

        {loading && (
          <div style={{ padding: '28px 18px', color: 'rgba(245,241,232,0.4)', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
            Caricamento…
          </div>
        )}

        {!loading && invites.length === 0 && (
          <div style={{ padding: '28px 18px', color: 'rgba(245,241,232,0.4)', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
            Nessun codice generato.
          </div>
        )}

        {invites.map((inv, i) => {
          const link = inv.invite_link || `.../${inv.code}`;
          const truncated = link.length > 40 ? link.slice(0, 40) + '…' : link;
          return (
            <div key={inv.id} style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 2fr 0.8fr 1fr 0.8fr 0.8fr',
              padding: '13px 18px', alignItems: 'center',
              borderBottom: i < invites.length - 1 ? '1px solid rgba(212,175,55,0.06)' : 'none',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,175,55,0.03)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, color: '#D4AF37', letterSpacing: '0.08em' }}>
                {inv.code}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(245,241,232,0.55)' }}>
                {truncated}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#F5F1E8' }}>
                {inv.use_count}<span style={{ color: 'rgba(245,241,232,0.35)' }}>/{inv.max_uses}</span>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(245,241,232,0.7)', fontFamily: 'Inter, sans-serif' }}>
                {formatDate(inv.expires_at)}
              </div>
              <div>
                {inv.is_valid
                  ? <Badge color="green">VALIDO</Badge>
                  : <Badge color="muted">SCADUTO</Badge>
                }
              </div>
              <div style={{ textAlign: 'right' }}>
                {inv.is_active && (
                  <SmallButton onClick={() => handleDeactivate(inv.code)}>Disattiva</SmallButton>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ————— Users tab —————

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chipForm, setChipForm] = useState(null); // user id with open form
  const [chipAmount, setChipAmount] = useState('');
  const [chipReason, setChipReason] = useState('');
  const [chipError, setChipError] = useState('');
  const [chipLoading, setChipLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleToggle = async (userId) => {
    try {
      await api.patch(`/admin/users/${userId}/toggle-active`);
      fetchUsers();
    } catch {}
  };

  const openChipForm = (userId) => {
    setChipForm(userId);
    setChipAmount('');
    setChipReason('');
    setChipError('');
  };

  const handleAddChips = async (userId) => {
    const amount = parseInt(chipAmount);
    if (!amount || !chipReason.trim()) {
      setChipError('Importo e motivo sono obbligatori');
      return;
    }
    setChipError('');
    setChipLoading(true);
    try {
      await api.post(`/admin/users/${userId}/add-chips`, { amount, reason: chipReason });
      setChipForm(null);
      fetchUsers();
    } catch (err) {
      setChipError(err.response?.data?.detail || 'Errore');
    } finally {
      setChipLoading(false);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.22em', color: '#D4AF37', fontWeight: 600, marginBottom: 4 }}>
          GESTIONE SOCI
        </div>
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: '#F5F1E8' }}>
          Utenti registrati
        </div>
      </div>

      <div style={{ border: '1px solid rgba(212,175,55,0.12)' }}>
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1.8fr 1fr 1.4fr 0.8fr 1.4fr',
          padding: '10px 18px',
          background: 'rgba(212,175,55,0.04)',
          borderBottom: '1px solid rgba(212,175,55,0.12)',
          fontSize: 9.5, letterSpacing: '0.2em', fontWeight: 600,
          color: 'rgba(245,241,232,0.45)', fontFamily: 'Inter, sans-serif',
        }}>
          <div>USERNAME</div>
          <div>EMAIL</div>
          <div>CHIPS</div>
          <div>ULTIMO ACCESSO</div>
          <div>STATO</div>
          <div>AZIONI</div>
        </div>

        {loading && (
          <div style={{ padding: '28px 18px', color: 'rgba(245,241,232,0.4)', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
            Caricamento…
          </div>
        )}

        {users.map((u, i) => (
          <div key={u.id} style={{ borderBottom: i < users.length - 1 ? '1px solid rgba(212,175,55,0.06)' : 'none' }}>
            {/* Main row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1.8fr 1fr 1.4fr 0.8fr 1.4fr',
              padding: '13px 18px', alignItems: 'center',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,175,55,0.03)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div>
                <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#F5F1E8', fontWeight: 500 }}>
                  {u.username}
                </div>
                {u.is_admin && (
                  <div style={{ marginTop: 3 }}>
                    <Badge color="gold">ADMIN</Badge>
                  </div>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'rgba(245,241,232,0.6)', fontFamily: 'Inter, sans-serif' }}>
                {u.email}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#D4AF37' }}>
                {(u.chips_balance ?? 0).toLocaleString('it-IT')}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(245,241,232,0.55)', fontFamily: 'JetBrains Mono, monospace' }}>
                {formatDate(u.last_login_at)}
              </div>
              <div>
                {u.is_active
                  ? <Badge color="green">ATTIVO</Badge>
                  : <Badge color="red">DISAB.</Badge>
                }
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <SmallButton onClick={() => handleToggle(u.id)}>
                  {u.is_active ? 'Disabilita' : 'Attiva'}
                </SmallButton>
                <SmallButton
                  variant="solid"
                  onClick={() => chipForm === u.id ? setChipForm(null) : openChipForm(u.id)}
                >
                  + Chips
                </SmallButton>
              </div>
            </div>

            {/* Inline chip form */}
            {chipForm === u.id && (
              <div style={{
                margin: '0 18px 14px',
                padding: '16px 18px',
                border: '1px solid rgba(212,175,55,0.2)',
                background: 'rgba(212,175,55,0.03)',
              }}>
                <div style={{ fontSize: 9.5, letterSpacing: '0.2em', color: '#D4AF37', fontWeight: 600, marginBottom: 14 }}>
                  AGGIUNGI / RIMUOVI CHIPS — {u.username}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, marginBottom: 12 }}>
                  <Field
                    label="IMPORTO"
                    type="number"
                    value={chipAmount}
                    onChange={setChipAmount}
                    placeholder="es. 500 o -200"
                  />
                  <Field
                    label="MOTIVO"
                    value={chipReason}
                    onChange={setChipReason}
                    placeholder="es. Ricarica manuale"
                  />
                </div>
                {chipError && <ErrorLine msg={chipError} />}
                {chipError && <div style={{ height: 10 }} />}
                <div style={{ display: 'flex', gap: 8 }}>
                  <SmallButton variant="solid" onClick={() => handleAddChips(u.id)} disabled={chipLoading}>
                    {chipLoading ? 'Salvataggio…' : 'Conferma'}
                  </SmallButton>
                  <SmallButton onClick={() => setChipForm(null)}>Annulla</SmallButton>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ————— Tournaments tab —————

function TournamentsTab() {
  const { isMobile } = useViewport();
  const [cashTables, setCashTables] = useState([]);
  const [sitgos, setSitgos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const fetchData = useCallback(async () => {
    try {
      setError('');
      const [cashRes, sitgoRes] = await Promise.all([
        tablesApi.adminListCashTables(),
        tablesApi.adminListSitGos(),
      ]);
      setCashTables(cashRes.data || []);
      setSitgos(sitgoRes.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Errore nel caricamento tornei');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleCash = async (id, currentVisibility) => {
    const key = `cash-${id}`;
    setBusyKey(key);
    try {
      await tablesApi.adminSetCashTableVisibility(id, !currentVisibility);
      setCashTables(prev => prev.map(t => (t.id === id ? { ...t, is_visible_in_lobby: !currentVisibility } : t)));
    } catch (err) {
      setError(err.response?.data?.detail || 'Errore aggiornamento visibilità');
    } finally {
      setBusyKey('');
    }
  };

  const toggleSitGo = async (id, currentVisibility) => {
    const key = `sitgo-${id}`;
    setBusyKey(key);
    try {
      await tablesApi.adminSetSitGoVisibility(id, !currentVisibility);
      setSitgos(prev => prev.map(t => (t.id === id ? { ...t, is_visible_in_lobby: !currentVisibility } : t)));
    } catch (err) {
      setError(err.response?.data?.detail || 'Errore aggiornamento visibilità');
    } finally {
      setBusyKey('');
    }
  };

  const statusBadge = (status) => {
    if (status === 'running') return <Badge color="green">IN CORSO</Badge>;
    if (status === 'waiting') return <Badge color="gold">IN ATTESA</Badge>;
    return <Badge color="muted">CHIUSO</Badge>;
  };

  const visibilityBadge = (visible) =>
    visible ? <Badge color="green">VISIBILE</Badge> : <Badge color="red">NASCOSTO</Badge>;

  return (
    <div style={{ padding: isMobile ? '20px 16px' : '28px 32px' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.22em', color: '#D4AF37', fontWeight: 600, marginBottom: 4 }}>
          GESTIONE TORNEI
        </div>
        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: isMobile ? 20 : 22, color: '#F5F1E8' }}>
          Visibilità lobby
        </div>
      </div>

      <ErrorLine msg={error} />
      {error && <div style={{ height: 14 }} />}

      {loading && (
        <div style={{ color: 'rgba(245,241,232,0.5)', fontFamily: 'Inter, sans-serif', fontSize: 12 }}>
          Caricamento…
        </div>
      )}

      {!loading && (
        <div style={{ display: 'grid', gap: 20 }}>
          <div style={{ border: '1px solid rgba(212,175,55,0.12)' }}>
            <div style={{
              padding: isMobile ? '12px 14px' : '12px 16px',
              borderBottom: '1px solid rgba(212,175,55,0.12)',
              background: 'rgba(212,175,55,0.04)',
              fontSize: 10,
              letterSpacing: '0.2em',
              color: '#D4AF37',
              fontWeight: 600,
            }}>
              CASH GAME ({cashTables.length})
            </div>
            {cashTables.length === 0 && (
              <div style={{ padding: '16px', fontSize: 12, color: 'rgba(245,241,232,0.45)', fontFamily: 'Inter, sans-serif' }}>
                Nessun tavolo cash disponibile.
              </div>
            )}
            {cashTables.map((t, i) => {
              const key = `cash-${t.id}`;
              const busy = busyKey === key;
              return (
                <div key={t.id} style={{
                  padding: isMobile ? '12px 14px' : '13px 16px',
                  borderBottom: i < cashTables.length - 1 ? '1px solid rgba(212,175,55,0.06)' : 'none',
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '2.3fr 1.2fr 1fr 1fr 1fr',
                  gap: 10,
                  alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#F5F1E8', fontWeight: 500 }}>{t.name}</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(245,241,232,0.5)', marginTop: 2 }}>
                      ID: {String(t.id).slice(0, 8)} · {t.small_blind}/{t.big_blind} · max {t.max_seats}
                    </div>
                  </div>
                  <div>{statusBadge(t.status)}</div>
                  <div>{visibilityBadge(t.is_visible_in_lobby)}</div>
                  <div style={{ fontSize: 11, color: 'rgba(245,241,232,0.55)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {formatDate(t.created_at)}
                  </div>
                  <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
                    <SmallButton
                      variant={t.is_visible_in_lobby ? 'ghost' : 'solid'}
                      onClick={() => toggleCash(t.id, t.is_visible_in_lobby)}
                      disabled={busy}
                    >
                      {busy ? 'Salvataggio…' : t.is_visible_in_lobby ? 'Nascondi' : 'Mostra'}
                    </SmallButton>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ border: '1px solid rgba(212,175,55,0.12)' }}>
            <div style={{
              padding: isMobile ? '12px 14px' : '12px 16px',
              borderBottom: '1px solid rgba(212,175,55,0.12)',
              background: 'rgba(212,175,55,0.04)',
              fontSize: 10,
              letterSpacing: '0.2em',
              color: '#D4AF37',
              fontWeight: 600,
            }}>
              SIT&GO ({sitgos.length})
            </div>
            {sitgos.length === 0 && (
              <div style={{ padding: '16px', fontSize: 12, color: 'rgba(245,241,232,0.45)', fontFamily: 'Inter, sans-serif' }}>
                Nessun torneo Sit&Go disponibile.
              </div>
            )}
            {sitgos.map((t, i) => {
              const key = `sitgo-${t.id}`;
              const busy = busyKey === key;
              return (
                <div key={t.id} style={{
                  padding: isMobile ? '12px 14px' : '13px 16px',
                  borderBottom: i < sitgos.length - 1 ? '1px solid rgba(212,175,55,0.06)' : 'none',
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '2.3fr 1fr 1fr 1fr 1fr',
                  gap: 10,
                  alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#F5F1E8', fontWeight: 500 }}>{t.name}</div>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(245,241,232,0.5)', marginTop: 2 }}>
                      ID: {String(t.id).slice(0, 8)} · buy-in {t.buy_in} · max {t.max_seats}
                    </div>
                  </div>
                  <div>{statusBadge(t.status)}</div>
                  <div>{visibilityBadge(t.is_visible_in_lobby)}</div>
                  <div style={{ fontSize: 11, color: 'rgba(245,241,232,0.55)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {formatDate(t.finished_at || t.started_at)}
                  </div>
                  <div style={{ textAlign: isMobile ? 'left' : 'right' }}>
                    <SmallButton
                      variant={t.is_visible_in_lobby ? 'ghost' : 'solid'}
                      onClick={() => toggleSitGo(t.id, t.is_visible_in_lobby)}
                      disabled={busy}
                    >
                      {busy ? 'Salvataggio…' : t.is_visible_in_lobby ? 'Nascondi' : 'Mostra'}
                    </SmallButton>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ————— AdminPage —————

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isMobile } = useViewport();
  const [tab, setTab] = useState('invites');

  useEffect(() => {
    if (user && !user.is_admin) navigate('/lobby', { replace: true });
  }, [user, navigate]);

  if (!user || !user.is_admin) return null;

  return (
    <AppFrame user={user}>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: '100%' }}>
        <TopBar
          subtitle="PANNELLO ADMIN"
          title="Amministrazione"
          actions={
            <div style={{ fontSize: 12, color: 'rgba(245,241,232,0.5)', fontFamily: 'JetBrains Mono, monospace' }}>
              {user.username}
              <span style={{
                marginLeft: 10, fontSize: 9.5, padding: '2px 8px',
                background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)',
                color: '#D4AF37', letterSpacing: '0.12em', fontFamily: 'Inter, sans-serif',
              }}>ADMIN</span>
            </div>
          }
        />

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(212,175,55,0.1)', background: '#0a0a0a', overflowX: 'auto' }}>
          {[['invites', '⬡ Inviti'], ['users', '◈ Utenti'], ['tables', '⬢ Tornei']].map(([id, label]) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)} style={{
                padding: isMobile ? '12px 16px' : '14px 28px', background: 'transparent', border: 'none',
                borderBottom: active ? '2px solid #D4AF37' : '2px solid transparent',
                color: active ? '#F5F1E8' : 'rgba(245,241,232,0.45)',
                fontFamily: 'Inter, sans-serif', fontSize: isMobile ? 11 : 12, fontWeight: 600,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                cursor: 'pointer', transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}>
                {label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {tab === 'invites' ? <InvitesTab /> : tab === 'users' ? <UsersTab /> : <TournamentsTab />}
        </div>
      </div>
    </AppFrame>
  );
}
