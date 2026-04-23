import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { tablesApi } from '../api/tables';

// ————— Traffic lights —————
export function TrafficLights() {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
      <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
      <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
    </div>
  );
}

// ————— Sidebar —————
const ROUTE_MAP = {
  lobby:   '/lobby',
  cash:    '/lobby/cash',
  table:   '/table/active',
  profile: '/profile',
  cassa:   '/lobby',
  admin:   '/admin',
};

export function Sidebar({ user }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const activeSeat = null;
  const tableRoute = null;

  const items = [
    { id: 'lobby',   label: 'Lobby',        section: 'gioca' },
    { id: 'cash',    label: 'Cash Game',     section: 'gioca' },
    { id: 'sitgo',   label: 'Sit & Go',      section: 'gioca' },
    { id: 'profile', label: 'Profilo',       section: 'account' },
    { id: 'race',    label: 'Race',          section: 'classifiche' },
    ...(user?.is_admin ? [{ id: 'admin', label: 'Admin', section: 'account', badge: 'ADM' }] : []),
  ];

  const ROUTE_MAP_LOCAL = {
    lobby:   '/lobby',
    cash:    '/lobby/cash',
    sitgo:   '/lobby/sitgo',
    table:   '/lobby',
    profile: '/profile',
    race:    '/race',
    admin:   '/admin',
  };

  const sections = ['gioca', 'classifiche', 'account'];
  const sectionLabels = { gioca: 'GIOCA', classifiche: 'CLASSIFICHE', account: 'ACCOUNT' };

  const isActive = (id) => {
    const target = ROUTE_MAP_LOCAL[id];
    if (id === 'lobby') return pathname === '/lobby';
    return pathname.startsWith(target);
  };

  return (
    <div style={{
      width: 240, height: '100%', flexShrink: 0,
      background: 'linear-gradient(180deg, #0a0a0a 0%, #070707 100%)',
      borderRight: '1px solid rgba(212,175,55,0.08)',
      display: 'flex', flexDirection: 'column',
      padding: '14px 0',
    }}>
      <div style={{ padding: '4px 16px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <TrafficLights />
      </div>

      {/* Logo */}
      <div style={{ padding: '0 20px 24px', borderBottom: '1px solid rgba(212,175,55,0.08)' }}>
        <div style={{
          fontFamily: 'Playfair Display, serif', fontSize: 26, fontWeight: 700,
          color: '#D4AF37', letterSpacing: '-0.02em', lineHeight: 1,
        }}>
          Micetti<span style={{ color: '#F5F1E8', fontStyle: 'italic', fontWeight: 400 }}>.</span>
        </div>
        <div style={{
          fontFamily: 'Inter, sans-serif', fontSize: 9, fontWeight: 600,
          color: 'rgba(245,241,232,0.4)', letterSpacing: '0.2em', marginTop: 4,
        }}>
          POKER CLUB DI SCARSI
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 0' }}>
        {sections.map(sec => (
          <div key={sec} style={{ marginBottom: 18 }}>
            <div style={{
              padding: '0 20px 8px', fontSize: 9.5, fontWeight: 700,
              color: 'rgba(245,241,232,0.35)', letterSpacing: '0.22em',
              fontFamily: 'Inter, sans-serif',
            }}>{sectionLabels[sec]}</div>
            {items.filter(i => i.section === sec).map(item => {
              const active = isActive(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => !item.disabled && navigate(ROUTE_MAP_LOCAL[item.id])}
                  style={{
                    padding: '9px 20px', cursor: item.disabled ? 'default' : 'pointer', position: 'relative',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontFamily: 'Inter, sans-serif', fontSize: 13.5,
                    color: item.disabled ? 'rgba(245,241,232,0.28)' : (active ? '#F5F1E8' : 'rgba(245,241,232,0.62)'),
                    fontWeight: active ? 500 : 400,
                    background: active ? 'linear-gradient(90deg, rgba(212,175,55,0.08), transparent)' : 'transparent',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => !item.disabled && !active && (e.currentTarget.style.color = '#F5F1E8')}
                  onMouseLeave={e => !item.disabled && !active && (e.currentTarget.style.color = 'rgba(245,241,232,0.62)')}
                >
                  {active && <div style={{
                    position: 'absolute', left: 0, top: 6, bottom: 6, width: 2,
                    background: '#D4AF37',
                  }} />}
                  <span>{item.label}</span>
                  {item.badge && (
                    <span style={{
                      fontSize: 8.5, fontWeight: 700, letterSpacing: '0.12em',
                      padding: '2px 6px', borderRadius: 2,
                      background: '#c0392b', color: '#fff',
                    }}>{item.badge}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* User chip */}
      {user && (
        <div style={{
          margin: '0 12px', padding: '10px 12px',
          background: 'rgba(212,175,55,0.04)',
          border: '1px solid rgba(212,175,55,0.12)',
          borderRadius: 4, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'linear-gradient(135deg, #D4AF37, #8a6d1e)',
            color: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 700,
            flexShrink: 0,
          }}>{user.avatar_initials ?? (user.username ?? '?').slice(0, 2).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: '#F5F1E8', fontWeight: 500, fontFamily: 'Inter, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.display_name || user.username}
            </div>
            <div style={{ fontSize: 10.5, color: '#D4AF37', fontFamily: 'JetBrains Mono, monospace', marginTop: 1 }}>
              {(user.chips_balance ?? 0).toLocaleString('it-IT')} chips
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ————— TopBar —————
export function TopBar({ title, subtitle, actions }) {
  return (
    <div style={{
      padding: '22px 32px 18px', display: 'flex', alignItems: 'flex-end',
      justifyContent: 'space-between', borderBottom: '1px solid rgba(212,175,55,0.08)',
    }}>
      <div>
        <div style={{
          fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600,
          color: 'rgba(245,241,232,0.45)', letterSpacing: '0.22em', marginBottom: 6,
        }}>{subtitle}</div>
        <div style={{
          fontFamily: 'Playfair Display, serif', fontSize: 32, fontWeight: 500,
          color: '#F5F1E8', letterSpacing: '-0.015em', lineHeight: 1,
        }}>{title}</div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>{actions}</div>
    </div>
  );
}

// ————— GoldButton —————
export function GoldButton({ children, onClick, variant = 'solid', size = 'md', style: extraStyle = {} }) {
  const sizes = {
    sm: { padding: '7px 14px', fontSize: 11 },
    md: { padding: '10px 20px', fontSize: 12 },
    lg: { padding: '14px 28px', fontSize: 13 },
  };
  const base = {
    ...sizes[size],
    fontFamily: 'Inter, sans-serif', fontWeight: 600,
    letterSpacing: '0.15em', textTransform: 'uppercase',
    cursor: 'pointer', border: 'none', transition: 'all 0.18s',
    ...extraStyle,
  };
  if (variant === 'solid') {
    return (
      <button onClick={onClick} style={{
        ...base,
        background: 'linear-gradient(180deg, #E8C252, #B8941F)',
        color: '#0a0a0a',
        boxShadow: '0 1px 0 rgba(255,255,255,0.2) inset, 0 -1px 0 rgba(0,0,0,0.3) inset, 0 4px 12px rgba(212,175,55,0.25)',
      }}
      onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.08)'}
      onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}
      >{children}</button>
    );
  }
  return (
    <button onClick={onClick} style={{
      ...base,
      background: 'transparent', color: '#D4AF37',
      border: '1px solid rgba(212,175,55,0.4)',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.08)'; e.currentTarget.style.borderColor = '#D4AF37'; }}
    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)'; }}
    >{children}</button>
  );
}
