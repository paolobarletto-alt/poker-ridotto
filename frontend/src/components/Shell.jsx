import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { tablesApi } from '../api/tables';
import { useViewport } from '../hooks/useViewport';

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
      borderRight: '2px solid rgba(212,175,55,0.22)',
      display: 'flex', flexDirection: 'column',
      padding: '14px 0',
    }}>
      {/* Logo */}
      <div style={{ padding: '12px 20px 24px', borderBottom: '1.5px solid rgba(212,175,55,0.18)' }}>
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
  const { isMobile } = useViewport();
  return (
    <div style={{
      padding: isMobile ? '16px 16px 14px' : '22px 32px 18px',
      display: 'flex',
      alignItems: isMobile ? 'flex-start' : 'flex-end',
      flexDirection: isMobile ? 'column' : 'row',
      gap: isMobile ? 12 : 0,
      justifyContent: 'space-between',
      borderBottom: '2px solid rgba(212,175,55,0.22)',
    }}>
      <div>
        <div style={{
          fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600,
          color: 'rgba(245,241,232,0.45)', letterSpacing: '0.22em', marginBottom: 6,
        }}>{subtitle}</div>
        <div style={{
          fontFamily: 'Playfair Display, serif', fontSize: isMobile ? 26 : 32, fontWeight: 500,
          color: '#F5F1E8', letterSpacing: '-0.015em', lineHeight: 1,
        }}>{title}</div>
      </div>
      <div style={{ display: 'flex', gap: 10, width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'flex-end' : 'flex-start' }}>{actions}</div>
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

export function AppFrame({ user, children }) {
  const { isMobile } = useViewport();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, isMobile]);

  if (!isMobile) {
    return (
      <div style={{ display: 'flex', height: '100%', background: '#050505' }}>
        <Sidebar user={user} />
        <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', background: '#050505', position: 'relative' }}>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 14px',
        borderBottom: '1px solid rgba(212,175,55,0.22)',
        background: 'rgba(10,10,10,0.96)',
        backdropFilter: 'blur(8px)',
      }}>
        <button
          onClick={() => setMenuOpen((prev) => !prev)}
          style={{
            width: 34,
            height: 34,
            border: '1px solid rgba(212,175,55,0.35)',
            background: 'transparent',
            color: '#D4AF37',
            fontSize: 16,
            cursor: 'pointer',
          }}
          aria-label="Apri menu"
        >
          ☰
        </button>
        <div style={{ fontFamily: 'Playfair Display, serif', color: '#D4AF37', fontSize: 24, lineHeight: 1 }}>
          Micetti<span style={{ color: '#F5F1E8', fontStyle: 'italic', fontWeight: 400 }}>.</span>
        </div>
        <div style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(212,175,55,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D4AF37', fontSize: 12, fontFamily: 'Playfair Display, serif' }}>
          {(user?.avatar_initials ?? user?.username ?? '?').slice(0, 2).toUpperCase()}
        </div>
      </div>

      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.72)' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 240, height: '100%', boxShadow: '8px 0 30px rgba(0,0,0,0.55)' }}
          >
            <Sidebar user={user} />
          </div>
        </div>
      )}

      <div style={{ height: '100%', overflowY: 'auto', paddingTop: 56 }}>
        {children}
      </div>
    </div>
  );
}
