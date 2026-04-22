import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tablesApi } from '../api/tables';

const BLIND_SCHEDULES = {
  slow:   [{ sb: 25, bb: 50 }, { sb: 50, bb: 100 }, { sb: 75, bb: 150 }, { sb: 150, bb: 300 }],
  normal: [{ sb: 25, bb: 50 }, { sb: 50, bb: 100 }, { sb: 75, bb: 150 }, { sb: 150, bb: 300 }],
  fast:   [{ sb: 25, bb: 50 }, { sb: 50, bb: 100 }, { sb: 100, bb: 200 }, { sb: 200, bb: 400 }],
};
const SPEED_LABELS = { slow: '🐢 Lenta', normal: '⚡ Normale', fast: '⚡⚡ Veloce' };
const SPEED_TIMER = { slow: '30s per mossa', normal: '20s per mossa', fast: '10s per mossa' };
const SITGO_PAYOUT = {
  2: [100],
  3: [70, 30],
  4: [70, 30],
  5: [50, 30, 20],
  6: [50, 30, 20],
  7: [50, 30, 20],
  8: [50, 30, 20],
};

const css = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)',
    overflowY: 'auto', padding: '24px 0',
  },
  panel: {
    background: '#0e0e0e', border: '1px solid rgba(212,175,55,0.25)', boxShadow: '0 24px 80px rgba(0,0,0,0.9)',
    width: 480, maxWidth: '92vw', position: 'relative', display: 'flex', flexDirection: 'column',
  },
  header: { padding: '28px 32px 20px', borderBottom: '1px solid rgba(212,175,55,0.08)' },
  body: { padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto', maxHeight: '70vh' },
  footer: { padding: '18px 32px', borderTop: '1px solid rgba(212,175,55,0.08)', display: 'flex', gap: 10 },
  sectionTitle: {
    fontSize: 9, letterSpacing: '0.22em', color: 'rgba(212,175,55,0.7)', fontFamily: 'Inter, sans-serif', fontWeight: 600, marginBottom: 12,
  },
  label: {
    fontSize: 10.5, letterSpacing: '0.1em', color: 'rgba(245,241,232,0.6)', fontFamily: 'Inter, sans-serif', marginBottom: 6, display: 'block',
  },
  input: {
    width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(212,175,55,0.2)',
    color: '#F5F1E8', padding: '10px 12px', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none',
  },
  inputError: { border: '1px solid rgba(200,60,60,0.6)' },
  errorMsg: { fontSize: 10, color: 'rgba(220,80,80,0.9)', fontFamily: 'Inter, sans-serif', marginTop: 4 },
  select: {
    width: '100%', boxSizing: 'border-box', background: '#111', border: '1px solid rgba(212,175,55,0.2)',
    color: '#F5F1E8', padding: '10px 12px', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none', cursor: 'pointer',
  },
  row2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  btnGold: {
    flex: 2, padding: '13px 0', background: 'linear-gradient(180deg, #D4AF37 0%, #B8941F 100%)', border: 'none', color: '#0a0a0a',
    fontSize: 12, fontFamily: 'Inter, sans-serif', fontWeight: 700, letterSpacing: '0.12em', cursor: 'pointer',
  },
  btnGhost: {
    flex: 1, padding: '13px 0', background: 'transparent', border: '1px solid rgba(245,241,232,0.15)',
    color: 'rgba(245,241,232,0.6)', fontSize: 12, fontFamily: 'Inter, sans-serif', letterSpacing: '0.12em', cursor: 'pointer',
  },
};

function NumInput({ label, value, onChange, min, max, step = 1, readOnly = false, disabled = false, error }) {
  return (
    <div>
      <label style={css.label}>{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        readOnly={readOnly}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ...css.input, ...(error ? css.inputError : {}), ...(readOnly || disabled ? { opacity: 0.6 } : {}) }}
      />
      {error && <div style={css.errorMsg}>{error}</div>}
    </div>
  );
}

export default function CreateTableModal({ isOpen, onClose, defaultType = 'cash' }) {
  const navigate = useNavigate();
  const [type, setType] = useState(defaultType === 'sitgo' ? 'sitgo' : 'cash');
  const [name, setName] = useState('');
  const [minPlayers, setMinPlayers] = useState(2);
  const [maxSeats, setMaxSeats] = useState(6);
  const [speed, setSpeed] = useState('normal');
  const [sb, setSb] = useState(25);
  const [minBuyin, setMinBuyin] = useState(500);
  const [maxBuyin, setMaxBuyin] = useState(5000);
  const [noMaxBuyin, setNoMaxBuyin] = useState(false);
  const [startChips, setStartChips] = useState(10000);
  const [sitgoBuyIn, setSitgoBuyIn] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const bb = sb * 2;
  const maxSeatCap = type === 'sitgo' ? 8 : 9;
  const buyinPreview = useMemo(() => Math.max(100, sitgoBuyIn), [sitgoBuyIn]);
  const payoutPreview = useMemo(() => SITGO_PAYOUT[maxSeats] ?? [100], [maxSeats]);
  const prizePoolPreview = useMemo(() => buyinPreview * maxSeats, [buyinPreview, maxSeats]);

  useEffect(() => {
    if (maxSeats > maxSeatCap) setMaxSeats(maxSeatCap);
    if (minPlayers > maxSeatCap) setMinPlayers(maxSeatCap);
    if (maxSeats < minPlayers) setMaxSeats(minPlayers);
  }, [maxSeats, minPlayers, maxSeatCap]);

  useEffect(() => {
    if (type === 'sitgo' && minPlayers !== maxSeats) {
      setMinPlayers(maxSeats);
    }
  }, [type, minPlayers, maxSeats]);

  useEffect(() => {
    if (minBuyin < bb * 10) setMinBuyin(bb * 10);
  }, [bb, minBuyin]);

  if (!isOpen) return null;

  const errors = {};
  if (name.trim().length < 3) errors.name = 'Min 3 caratteri';
  if (name.trim().length > 50) errors.name = 'Max 50 caratteri';
  if (type === 'cash') {
    if (minPlayers < 2 || minPlayers > maxSeatCap) errors.minPlayers = `Tra 2 e ${maxSeatCap}`;
    if (maxSeats < minPlayers || maxSeats > maxSeatCap) errors.maxSeats = `Tra ${minPlayers} e ${maxSeatCap}`;
    if (minBuyin < bb * 10) errors.minBuyin = `Min buy-in deve essere ≥ ${bb * 10}`;
    if (!noMaxBuyin && maxBuyin < minBuyin) errors.maxBuyin = 'Max buy-in deve essere ≥ min buy-in';
  } else {
    if (maxSeats < 2 || maxSeats > 8) errors.maxSeats = 'Tra 2 e 8';
    if (startChips < 1000) errors.startChips = 'Minimo 1000 chips';
    if (sitgoBuyIn < 100) errors.sitgoBuyIn = 'Minimo 100 chips';
  }

  const canSubmit = Object.keys(errors).length === 0;
  const visibleErrors = submitted ? errors : {};

  const handleSubmit = async () => {
    setSubmitted(true);
    if (!canSubmit || loading) return;
    setLoading(true);
    setServerError('');

    const basePayload = {
      name: name.trim(),
      min_players: type === 'sitgo' ? maxSeats : minPlayers,
      max_seats: maxSeats,
      speed,
    };

    try {
      if (type === 'sitgo') {
        const res = await tablesApi.createSitGo({
          ...basePayload,
          starting_chips: startChips,
          buy_in: buyinPreview,
        });
        const tableId = res.data?.table_id;
        onClose();
        if (tableId) navigate(`/table/${tableId}`);
        else navigate('/lobby/sitgo');
        return;
      }

      const res = await tablesApi.createTable({
        ...basePayload,
        table_type: 'cash',
        small_blind: sb,
        big_blind: bb,
        min_buyin: minBuyin,
        max_buyin: noMaxBuyin ? null : maxBuyin,
      });
      const newId = res.data?.id;
      onClose();
      if (newId) navigate(`/table/${newId}`);
    } catch (err) {
      if (type === 'sitgo' && [404, 405].includes(err?.response?.status)) {
        try {
          const fallback = await tablesApi.createTable({
            ...basePayload,
            table_type: 'sitgo',
            small_blind: 25,
            big_blind: 50,
            min_buyin: buyinPreview,
            max_buyin: buyinPreview,
          });
          onClose();
          if (fallback.data?.id) navigate(`/table/${fallback.data.id}`);
          else navigate('/lobby/sitgo');
          return;
        } catch (fallbackErr) {
          setServerError(fallbackErr?.response?.data?.detail ?? 'Errore durante la creazione del torneo');
          return;
        }
      }
      setServerError(err?.response?.data?.detail ?? `Errore durante la creazione del ${type === 'sitgo' ? 'torneo' : 'tavolo'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={css.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={css.panel}>
        <div style={css.header}>
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 18, background: 'none', border: 'none', color: 'rgba(245,241,232,0.4)', fontSize: 18, cursor: 'pointer' }}>✕</button>
          <div style={{ fontSize: 9.5, letterSpacing: '0.25em', color: 'rgba(245,241,232,0.45)', fontFamily: 'Inter, sans-serif', marginBottom: 4 }}>NUOVA PARTITA</div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, color: '#F5F1E8' }}>
            {type === 'sitgo' ? 'Crea Sit & Go' : 'Crea Cash Game'}
          </div>
        </div>

        <div style={css.body}>
          <div>
            <div style={css.sectionTitle}>TIPO DI GIOCO</div>
            <div style={{ display: 'flex', gap: 0 }}>
              {[['cash', 'Cash Game'], ['sitgo', 'Sit & Go']].map(([val, lbl]) => (
                <button
                  key={val}
                  onClick={() => setType(val)}
                  style={{
                    flex: 1, padding: '11px 0',
                    background: type === val ? 'rgba(212,175,55,0.15)' : 'transparent',
                    border: `1px solid ${type === val ? '#D4AF37' : 'rgba(212,175,55,0.2)'}`,
                    color: type === val ? '#D4AF37' : 'rgba(245,241,232,0.5)',
                    fontSize: 11, fontFamily: 'Inter, sans-serif', letterSpacing: '0.12em', cursor: 'pointer',
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={css.sectionTitle}>STRUTTURA</div>
            <div style={{ marginBottom: 14 }}>
              <label style={css.label}>Nome {type === 'sitgo' ? 'torneo' : 'tavolo'}</label>
              <input
                type="text"
                value={name}
                maxLength={50}
                onChange={(e) => setName(e.target.value)}
                placeholder={type === 'sitgo' ? 'Es. Sunday Micetti' : 'Es. Tavolo dei Campioni'}
                style={{ ...css.input, ...(visibleErrors.name ? css.inputError : {}) }}
              />
              {visibleErrors.name && <div style={css.errorMsg}>{visibleErrors.name}</div>}
            </div>
            {type === 'cash' ? (
              <div style={css.row2}>
                <div>
                  <label style={css.label}>Giocatori minimi</label>
                  <select value={minPlayers} onChange={(e) => setMinPlayers(Number(e.target.value))} style={{ ...css.select, ...(visibleErrors.minPlayers ? css.inputError : {}) }}>
                    {Array.from({ length: maxSeatCap - 1 }, (_, i) => i + 2).map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  {visibleErrors.minPlayers && <div style={css.errorMsg}>{visibleErrors.minPlayers}</div>}
                </div>
                <div>
                  <label style={css.label}>Posti massimi</label>
                  <select value={maxSeats} onChange={(e) => setMaxSeats(Number(e.target.value))} style={{ ...css.select, ...(visibleErrors.maxSeats ? css.inputError : {}) }}>
                    {Array.from({ length: maxSeatCap - minPlayers + 1 }, (_, i) => i + minPlayers).map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  {visibleErrors.maxSeats && <div style={css.errorMsg}>{visibleErrors.maxSeats}</div>}
                </div>
              </div>
            ) : (
              <div>
                <label style={css.label}>Numero partecipanti</label>
                <select value={maxSeats} onChange={(e) => setMaxSeats(Number(e.target.value))} style={{ ...css.select, ...(visibleErrors.maxSeats ? css.inputError : {}) }}>
                  {Array.from({ length: 7 }, (_, i) => i + 2).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                {visibleErrors.maxSeats && <div style={css.errorMsg}>{visibleErrors.maxSeats}</div>}
              </div>
            )}
          </div>

          <div>
            <div style={css.sectionTitle}>VELOCITÀ</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {['slow', 'normal', 'fast'].map((s) => {
                const active = speed === s;
                return (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    style={{
                      flex: 1, padding: '12px 8px',
                      background: active ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${active ? '#D4AF37' : 'rgba(212,175,55,0.15)'}`,
                      color: active ? '#D4AF37' : 'rgba(245,241,232,0.55)',
                      cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{SPEED_LABELS[s].split(' ')[0]}</span>
                    <span style={{ fontSize: 9.5, fontFamily: 'Inter, sans-serif', letterSpacing: '0.05em' }}>{SPEED_LABELS[s].split(' ').slice(1).join(' ')}</span>
                    <span style={{ fontSize: 9, color: active ? 'rgba(212,175,55,0.7)' : 'rgba(245,241,232,0.3)', fontFamily: 'JetBrains Mono, monospace' }}>{SPEED_TIMER[s]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {type === 'cash' && (
            <div>
              <div style={css.sectionTitle}>BLINDS E BUY-IN</div>
              <div style={{ ...css.row2, marginBottom: 14 }}>
                <NumInput label="Blind piccolo" value={sb} onChange={setSb} min={5} step={5} />
                <NumInput label="Blind grande (auto)" value={bb} onChange={() => { }} readOnly />
              </div>
              <div style={css.row2}>
                <NumInput label="Buy-in minimo" value={minBuyin} onChange={setMinBuyin} min={bb * 10} step={bb} error={visibleErrors.minBuyin} />
                <div>
                  <NumInput label="Buy-in massimo" value={maxBuyin} onChange={setMaxBuyin} min={minBuyin} disabled={noMaxBuyin} error={visibleErrors.maxBuyin} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, cursor: 'pointer', fontSize: 10.5, color: 'rgba(245,241,232,0.5)', fontFamily: 'Inter, sans-serif' }}>
                    <input type="checkbox" checked={noMaxBuyin} onChange={(e) => setNoMaxBuyin(e.target.checked)} style={{ accentColor: '#D4AF37' }} />
                    Nessun limite
                  </label>
                </div>
              </div>
            </div>
          )}

          {type === 'sitgo' && (
            <div>
              <div style={css.sectionTitle}>CONFIGURAZIONE TORNEO</div>
              <NumInput
                label="Chips di partenza"
                value={startChips}
                onChange={setStartChips}
                min={1000}
                step={500}
                error={visibleErrors.startChips}
              />
              <div style={{
                marginTop: 12, padding: '10px 12px', border: '1px solid rgba(212,175,55,0.15)',
                background: 'rgba(212,175,55,0.06)', fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'rgba(245,241,232,0.65)',
              }}>
                Buy-in torneo: <span style={{ color: '#D4AF37', fontFamily: 'JetBrains Mono, monospace' }}>{buyinPreview.toLocaleString('it-IT')} chips</span>
                <div style={{ marginTop: 6 }}>
                  Montepremi a tavolo pieno: <span style={{ color: '#D4AF37', fontFamily: 'JetBrains Mono, monospace' }}>{prizePoolPreview.toLocaleString('it-IT')} chips</span>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <NumInput
                  label="Buy-in torneo"
                  value={sitgoBuyIn}
                  onChange={setSitgoBuyIn}
                  min={100}
                  step={100}
                  error={visibleErrors.sitgoBuyIn}
                />
              </div>
              <div style={{ marginTop: 10, fontSize: 10.5, color: 'rgba(245,241,232,0.6)', fontFamily: 'Inter, sans-serif' }}>
                Payout top {payoutPreview.length}: <span style={{ color: '#D4AF37', fontFamily: 'JetBrains Mono, monospace' }}>{payoutPreview.join(' / ')}%</span>
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ ...css.label, marginBottom: 8 }}>Anteprima blind</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(BLIND_SCHEDULES[speed] ?? []).slice(0, 4).map((lvl, idx) => (
                    <div key={`${lvl.sb}-${idx}`} style={{ padding: '5px 8px', border: '1px solid rgba(212,175,55,0.2)', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: 'rgba(245,241,232,0.78)' }}>
                      Lv {idx + 1}: {lvl.sb}/{lvl.bb}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {serverError && (
            <div style={{ padding: '10px 14px', background: 'rgba(200,50,50,0.08)', border: '1px solid rgba(200,50,50,0.3)', fontSize: 11, color: 'rgba(220,80,80,0.9)', fontFamily: 'Inter, sans-serif' }}>
              {serverError}
            </div>
          )}
        </div>

        <div style={css.footer}>
          <button style={css.btnGhost} onClick={onClose}>Annulla</button>
          <button style={{ ...css.btnGold, opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creazione...' : (type === 'sitgo' ? 'CREA TORNEO' : 'CREA TAVOLO')}
          </button>
        </div>
      </div>
    </div>
  );
}
