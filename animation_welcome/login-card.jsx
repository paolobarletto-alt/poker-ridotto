// Shared login card overlay — the form from the screenshot.
// Uses a placeholder brand name ("Poker Club") to avoid recreating a real brand.
// Sits above whichever animated background is rendered underneath.

function LoginCard({ brand = 'Club Privé.', subtitle = 'POKER CLUB DI SCARSI' }) {
  const [tab, setTab] = React.useState('login');
  const gold = '#d4af37';
  const goldSoft = '#c9a227';

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'flex-start',
      paddingTop: 80,
      pointerEvents: 'none',
      zIndex: 5,
    }}>
      {/* Brand lockup */}
      <div style={{ textAlign: 'center', pointerEvents: 'auto' }}>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontWeight: 600,
          fontSize: 64,
          color: gold,
          letterSpacing: '-0.01em',
          lineHeight: 1,
          textShadow: '0 0 40px rgba(212,175,55,0.15)',
        }}>
          {brand}
        </div>
        <div style={{
          fontFamily: 'Inter, sans-serif',
          fontSize: 11,
          letterSpacing: '0.28em',
          color: 'rgba(255,255,255,0.45)',
          marginTop: 10,
          fontWeight: 400,
        }}>
          {subtitle}
        </div>
        {/* thin ornament */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 8, marginTop: 18,
        }}>
          <span style={{ width: 80, height: 1, background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.5))' }} />
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: gold }} />
          <span style={{ width: 80, height: 1, background: 'linear-gradient(90deg, rgba(212,175,55,0.5), transparent)' }} />
        </div>
      </div>

      {/* Card */}
      <div style={{
        marginTop: 28,
        width: 380,
        background: 'rgba(10,8,6,0.72)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: '1px solid rgba(212,175,55,0.15)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.03)',
        pointerEvents: 'auto',
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {['login', 'register'].map(t => (
            <button key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '16px 0',
                background: 'transparent', border: 'none',
                color: tab === t ? '#fff' : 'rgba(255,255,255,0.45)',
                fontSize: 11, fontWeight: 600, letterSpacing: '0.22em',
                cursor: 'pointer',
                borderBottom: tab === t ? `2px solid ${gold}` : '2px solid transparent',
                fontFamily: 'Inter, sans-serif',
                transition: 'color 0.2s',
              }}>
              {t === 'login' ? 'ACCEDI' : 'REGISTRATI'}
            </button>
          ))}
        </div>

        <div style={{ padding: '28px 28px 26px' }}>
          <div style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 26, fontWeight: 500,
            color: '#f4ead5',
            marginBottom: 22,
          }}>
            {tab === 'login' ? 'Bentornato.' : 'Unisciti al club.'}
          </div>

          {tab === 'register' && (
            <Field label="NOME" />
          )}
          <Field label="EMAIL" />
          <Field label="PASSWORD" type="password" />
          {tab === 'register' && (
            <Field label="CODICE INVITO" />
          )}

          <button style={{
            width: '100%',
            marginTop: 8,
            padding: '14px 0',
            background: `linear-gradient(180deg, ${gold}, ${goldSoft})`,
            color: '#1a1208',
            border: 'none',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.3em',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            boxShadow: '0 6px 20px rgba(212,175,55,0.2)',
          }}>
            {tab === 'login' ? 'ENTRA' : 'RICHIEDI ACCESSO'}
          </button>
        </div>
      </div>

      <div style={{
        marginTop: 22,
        fontSize: 11,
        color: 'rgba(255,255,255,0.35)',
        letterSpacing: '0.05em',
      }}>
        Accesso riservato ai soci del club.
      </div>
    </div>
  );
}

function Field({ label, type = 'text' }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 10, fontWeight: 600,
        letterSpacing: '0.22em',
        color: 'rgba(255,255,255,0.5)',
        marginBottom: 8,
      }}>
        {label} *
      </div>
      <input type={type} style={{
        width: '100%', padding: '11px 12px',
        background: 'rgba(0,0,0,0.35)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: '#fff',
        fontFamily: 'Inter, sans-serif',
        fontSize: 14,
        outline: 'none',
      }} />
    </div>
  );
}

window.LoginCard = LoginCard;
