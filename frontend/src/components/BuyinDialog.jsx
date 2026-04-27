import { useState } from 'react';
import { useViewport } from '../hooks/useViewport';

const S = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(4px)',
  },
  panel: {
    background: '#0e0e0e',
    border: '1px solid rgba(212,175,55,0.25)',
    boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
    padding: '36px 40px',
    width: 480,
    maxWidth: '90vw',
    position: 'relative',
  },
};

export default function BuyinDialog({ isOpen, onClose, seat, tableConfig, userBalance, onConfirm }) {
  const { isMobile } = useViewport();
  const tc = tableConfig ?? {};
  const balance = userBalance ?? 0;
  const minBuyin = tc.min_buyin ?? 100;
  const maxBuyin = tc.max_buyin != null ? Math.min(tc.max_buyin, balance) : balance;
  const safeMax = Math.max(minBuyin, maxBuyin);
  const mid = Math.round((minBuyin + safeMax) / 2);

  const [amount, setAmount] = useState(() => Math.min(Math.max(mid, minBuyin), safeMax));

  if (!isOpen) return null;

  const invalid = amount < minBuyin || amount > balance || amount > safeMax;

  const presets = [
    { label: 'Min', value: minBuyin },
    { label: 'Metà', value: mid },
    { label: 'Max', value: safeMax },
  ];

  const handleSlider = (v) => setAmount(Number(v));
  const panelStyle = {
    ...S.panel,
    width: isMobile ? 340 : S.panel.width,
    maxWidth: isMobile ? '86vw' : S.panel.maxWidth,
    padding: isMobile ? '20px 16px' : S.panel.padding,
    maxHeight: isMobile ? '86vh' : undefined,
    overflowY: isMobile ? 'auto' : 'visible',
  };

  return (
    <div style={S.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={panelStyle}>
        {/* Close */}
        <button onClick={onClose} style={{ position: 'absolute', top: isMobile ? 10 : 16, right: isMobile ? 12 : 18, background: 'none', border: 'none', color: 'rgba(245,241,232,0.4)', fontSize: isMobile ? 16 : 18, cursor: 'pointer' }}>✕</button>

        {/* Title */}
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9.5, letterSpacing: '0.25em', color: 'rgba(245,241,232,0.45)', fontFamily: 'Inter, sans-serif' }}>
            POSTO {seat != null ? seat + 1 : '—'}
          </div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: isMobile ? 20 : 24, color: '#F5F1E8', marginTop: 4 }}>
            Siediti al tavolo
          </div>
        </div>

        {/* Subtitle: table name + blinds */}
        {(tc.name || tc.small_blind) && (
          <div style={{ fontSize: isMobile ? 10 : 11, color: 'rgba(245,241,232,0.5)', fontFamily: 'Inter, sans-serif', marginBottom: isMobile ? 16 : 24 }}>
            {tc.name && <span>{tc.name}</span>}
            {tc.small_blind && <span style={{ color: 'rgba(212,175,55,0.7)' }}> · €{tc.small_blind}/{tc.big_blind ?? tc.small_blind * 2}</span>}
          </div>
        )}

        {/* Balance */}
        <div style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)', padding: isMobile ? '8px 10px' : '10px 14px', marginBottom: isMobile ? 16 : 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'rgba(245,241,232,0.55)', fontFamily: 'Inter, sans-serif' }}>Saldo disponibile</span>
          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#D4AF37' }}>
            {balance.toLocaleString('it-IT')} chips
          </span>
        </div>

        {/* Amount display */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.2em', color: 'rgba(245,241,232,0.4)', fontFamily: 'Inter, sans-serif', marginBottom: 4 }}>BUY-IN</div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: isMobile ? 27 : 32, color: '#D4AF37', fontWeight: 500 }}>
            {amount.toLocaleString('it-IT')}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(245,241,232,0.35)', fontFamily: 'Inter, sans-serif', marginTop: 2 }}>chips</div>
        </div>

        {/* Slider */}
        <div style={{ marginBottom: 12, padding: '0 4px' }}>
          <input type="range" min={minBuyin} max={safeMax} value={amount} onChange={(e) => handleSlider(e.target.value)}
            style={{ width: '100%', accentColor: '#D4AF37', cursor: 'pointer' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(245,241,232,0.35)', fontFamily: 'JetBrains Mono, monospace', marginTop: 4 }}>
            <span>{minBuyin.toLocaleString('it-IT')}</span>
            <span>{safeMax.toLocaleString('it-IT')}</span>
          </div>
        </div>

        {/* Presets */}
        <div style={{ display: 'flex', gap: 8, marginBottom: isMobile ? 18 : 28 }}>
          {presets.map(({ label, value }) => {
            const active = amount === value;
            return (
              <button key={label} onClick={() => setAmount(value)} style={{
                flex: 1, padding: '7px 0',
                background: active ? 'rgba(212,175,55,0.15)' : 'transparent',
                border: `1px solid ${active ? '#D4AF37' : 'rgba(212,175,55,0.25)'}`,
                color: active ? '#D4AF37' : 'rgba(245,241,232,0.6)',
                fontSize: 10, fontFamily: 'Inter, sans-serif', letterSpacing: '0.12em',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
                {label}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, flexDirection: isMobile ? 'column' : 'row' }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '12px 0', background: 'transparent',
            border: '1px solid rgba(245,241,232,0.15)', color: 'rgba(245,241,232,0.6)',
            fontSize: 12, fontFamily: 'Inter, sans-serif', letterSpacing: '0.12em', cursor: 'pointer',
          }}>Annulla</button>
          <button onClick={() => { if (!invalid) onConfirm(seat, amount); }} disabled={invalid} style={{
            flex: 2, padding: '12px 0',
            background: invalid ? 'rgba(212,175,55,0.3)' : 'linear-gradient(180deg, #D4AF37 0%, #B8941F 100%)',
            border: 'none', color: '#0a0a0a',
            fontSize: 12, fontFamily: 'Inter, sans-serif', fontWeight: 700, letterSpacing: '0.12em',
            cursor: invalid ? 'not-allowed' : 'pointer', opacity: invalid ? 0.5 : 1, transition: 'all 0.15s',
          }}>SIEDITI</button>
        </div>
      </div>
    </div>
  );
}
