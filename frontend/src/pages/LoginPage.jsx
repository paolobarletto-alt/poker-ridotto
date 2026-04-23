import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ————— Shared primitives —————

const LABEL = {
  display: 'block', fontSize: 9.5, letterSpacing: '0.2em', fontWeight: 600,
  color: 'rgba(245,241,232,0.5)', marginBottom: 8, fontFamily: 'Inter, sans-serif',
};

const INPUT_BASE = {
  width: '100%', padding: '11px 14px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(212,175,55,0.2)',
  color: '#F5F1E8', fontSize: 13.5,
  fontFamily: 'Inter, sans-serif',
  outline: 'none',
  transition: 'border-color 0.15s',
};

function Field({ label, type = 'text', value, onChange, required, placeholder }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={LABEL}>{label}{required && <span style={{ color: '#D4AF37', marginLeft: 2 }}>*</span>}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        style={INPUT_BASE}
        onFocus={e => (e.target.style.borderColor = '#D4AF37')}
        onBlur={e => (e.target.style.borderColor = 'rgba(212,175,55,0.2)')}
      />
    </div>
  );
}

function SubmitButton({ loading, children }) {
  return (
    <button
      type="submit"
      disabled={loading}
      style={{
        width: '100%', padding: '13px 20px',
        background: loading
          ? 'rgba(212,175,55,0.3)'
          : 'linear-gradient(180deg, #E8C252, #B8941F)',
        color: '#0a0a0a',
        border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
        fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 700,
        letterSpacing: '0.18em', textTransform: 'uppercase',
        transition: 'all 0.18s',
        boxShadow: loading ? 'none' : '0 4px 14px rgba(212,175,55,0.2)',
      }}
      onMouseEnter={e => !loading && (e.currentTarget.style.filter = 'brightness(1.08)')}
      onMouseLeave={e => (e.currentTarget.style.filter = 'brightness(1)')}
    >
      {loading ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(10,10,10,0.4)', borderTopColor: '#0a0a0a', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          Attendere…
        </span>
      ) : children}
    </button>
  );
}

function ErrorBox({ message }) {
  if (!message) return null;
  return (
    <div style={{
      marginBottom: 20, padding: '10px 14px',
      background: 'rgba(192,57,43,0.08)',
      border: '1px solid rgba(192,57,43,0.35)',
      fontSize: 12.5, color: '#e08080',
      fontFamily: 'Inter, sans-serif', lineHeight: 1.45,
    }}>
      {message}
    </div>
  );
}

function WelcomeBackground() {
  const bokehOrbs = useMemo(
    () => Array.from({ length: 14 }, (_, i) => ({
      id: i,
      size: 130 + ((i * 37) % 190),
      left: (i * 17) % 110,
      top: (i * 23) % 110,
      opacity: 0.08 + ((i % 5) * 0.02),
      blur: 34 + ((i * 7) % 52),
      duration: 18 + ((i * 3) % 18),
      delay: -(i * 2.1),
      hue: i % 4 === 0 ? 'red' : 'gold',
      keyframe: `welcome-bokeh-${i % 4}`,
    })),
    [],
  );

  const dustParticles = useMemo(
    () => Array.from({ length: 26 }, (_, i) => ({
      id: i,
      left: (i * 13) % 100,
      size: 1 + ((i * 5) % 3),
      duration: 20 + ((i * 7) % 24),
      delay: -(i * 1.7),
      opacity: 0.22 + ((i % 4) * 0.1),
    })),
    [],
  );

  const floatingChips = useMemo(
    () => Array.from({ length: 11 }, (_, i) => ({
      id: i,
      size: 62 + ((i * 11) % 34),
      left: 4 + ((i * 9) % 92),
      top: 8 + ((i * 17) % 82),
      depth: i % 3 === 0 ? 'front' : (i % 3 === 1 ? 'mid' : 'back'),
      duration: 16 + ((i * 4) % 12),
      delay: -(i * 1.9),
      tilt: -22 + ((i * 9) % 45),
      spinDuration: 8 + ((i * 2) % 8),
      driftX: -44 + ((i * 13) % 89),
      driftY: -32 + ((i * 17) % 65),
      driftZ: i % 3 === 0 ? 52 : i % 3 === 1 ? 32 : 18,
      pathRotation: -8 + ((i * 5) % 17),
      color: i % 4 === 0 ? '#8a1a28' : i % 4 === 1 ? '#0f3d2a' : i % 4 === 2 ? '#1a1a1a' : '#1a1f3a',
      accent: i % 3 === 0 ? '#D4AF37' : '#f5f1e8',
    })),
    [],
  );

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        background: `
          radial-gradient(ellipse at 28% 22%, rgba(44,27,14,0.95) 0%, rgba(10,7,5,0.72) 45%, transparent 68%),
          radial-gradient(ellipse at 72% 78%, rgba(35,11,11,0.5) 0%, transparent 52%),
          radial-gradient(ellipse 60% 58% at 50% 45%, #163224 0%, #0a1711 38%, #050505 78%)
        `,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '42%',
          left: '50%',
          width: 1300,
          height: 850,
          transform: 'translate(-50%,-50%)',
          background: 'radial-gradient(ellipse 52% 52% at center, rgba(212,175,55,0.22) 0%, rgba(212,175,55,0.08) 34%, transparent 68%)',
          filter: 'blur(8px)',
          animation: 'welcome-lamp-breathe 7.5s ease-in-out infinite',
        }}
      />

      {bokehOrbs.map((orb) => (
        <div
          key={orb.id}
          style={{
            position: 'absolute',
            left: `${orb.left}%`,
            top: `${orb.top}%`,
            width: orb.size,
            height: orb.size,
            borderRadius: '50%',
            background: orb.hue === 'red'
              ? 'radial-gradient(circle, rgba(208,78,78,0.65) 0%, rgba(140,30,30,0.16) 40%, transparent 72%)'
              : 'radial-gradient(circle, rgba(246,214,132,0.78) 0%, rgba(212,175,55,0.2) 42%, transparent 72%)',
            filter: `blur(${orb.blur}px)`,
            opacity: orb.opacity,
            mixBlendMode: 'screen',
            animation: `${orb.keyframe} ${orb.duration}s ease-in-out ${orb.delay}s infinite`,
          }}
        />
      ))}

      {floatingChips.map((chip) => (
        <div
          key={`chip-${chip.id}`}
          style={{
            position: 'absolute',
            left: `${chip.left}%`,
            top: `${chip.top}%`,
            width: chip.size,
            height: chip.size,
            marginLeft: -(chip.size / 2),
            marginTop: -(chip.size / 2),
            opacity: chip.depth === 'front' ? 0.5 : chip.depth === 'mid' ? 0.4 : 0.3,
            filter: chip.depth === 'front' ? 'drop-shadow(0 10px 24px rgba(0,0,0,0.7))' : 'drop-shadow(0 6px 14px rgba(0,0,0,0.5))',
            '--chip-dx': `${chip.driftX}px`,
            '--chip-dy': `${chip.driftY}px`,
            '--chip-dz': `${chip.driftZ}px`,
            '--chip-path-rot': `${chip.pathRotation}deg`,
            animation: `welcome-chip-space ${chip.duration}s ease-in-out ${chip.delay}s infinite`,
            transformStyle: 'preserve-3d',
            zIndex: chip.depth === 'front' ? 2 : 1,
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              '--chip-tilt': `${chip.tilt}deg`,
              animation: `welcome-chip-spin ${chip.spinDuration}s linear ${chip.delay}s infinite`,
              background: `conic-gradient(${chip.color} 0deg 44deg, ${chip.accent} 44deg 90deg, ${chip.color} 90deg 134deg, ${chip.accent} 134deg 180deg, ${chip.color} 180deg 224deg, ${chip.accent} 224deg 270deg, ${chip.color} 270deg 314deg, ${chip.accent} 314deg 360deg)`,
              border: '1px solid rgba(0,0,0,0.45)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: '16%',
                borderRadius: '50%',
                background: `radial-gradient(circle at 34% 30%, rgba(255,255,255,0.22) 0%, ${chip.color} 58%, rgba(0,0,0,0.4) 100%)`,
                border: `1px solid ${chip.accent === '#D4AF37' ? 'rgba(212,175,55,0.65)' : 'rgba(245,241,232,0.55)'}`,
              }}
            />
          </div>
        </div>
      ))}

      {dustParticles.map((p) => (
        <div
          key={`dust-${p.id}`}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            bottom: '-5%',
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            background: 'rgba(255,220,150,0.9)',
            boxShadow: '0 0 6px rgba(255,220,150,0.55)',
            opacity: p.opacity,
            animation: `welcome-dust-float ${p.duration}s linear ${p.delay}s infinite`,
          }}
        />
      ))}

      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.2, mixBlendMode: 'overlay' }}>
        <filter id="welcome-grain-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" />
          <feColorMatrix values="0 0 0 0 0.55  0 0 0 0 0.45  0 0 0 0 0.35  0 0 0 0.42 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#welcome-grain-noise)" />
      </svg>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 34%, rgba(0,0,0,0.84) 100%)',
        }}
      />
    </div>
  );
}

// ————— Login form —————

function LoginForm({ onSuccess }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      onSuccess();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Credenziali non valide.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Field label="EMAIL" type="email" value={email} onChange={setEmail} required />
      <Field label="PASSWORD" type="password" value={password} onChange={setPassword} required />
      <ErrorBox message={error} />
      <SubmitButton loading={loading}>Entra</SubmitButton>
    </form>
  );
}

// ————— Register form —————

function RegisterForm({ onSuccess }) {
  const { register } = useAuth();
  const [fields, setFields] = useState({
    username: '', email: '', password: '', display_name: '', invite_code: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (key) => (val) => setFields(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(fields);
      onSuccess();
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map(d => d.msg).join(' · '));
      } else {
        setError(typeof detail === 'string' ? detail : 'Registrazione non riuscita.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 14px' }}>
        <Field label="USERNAME" value={fields.username} onChange={set('username')} required />
        <Field label="NOME VISUALIZZATO" value={fields.display_name} onChange={set('display_name')} placeholder="opzionale" />
      </div>
      <Field label="EMAIL" type="email" value={fields.email} onChange={set('email')} required />
      <Field label="PASSWORD" type="password" value={fields.password} onChange={set('password')} required />
      <div style={{ marginBottom: 24 }}>
        <label style={LABEL}>
          CODICE INVITO <span style={{ color: '#D4AF37' }}>*</span>
        </label>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={fields.invite_code}
            onChange={e => set('invite_code')(e.target.value)}
            required
            placeholder="XXXX-XXXX"
            style={{
              ...INPUT_BASE,
              letterSpacing: '0.12em',
              paddingLeft: 40,
            }}
            onFocus={e => (e.target.style.borderColor = '#D4AF37')}
            onBlur={e => (e.target.style.borderColor = 'rgba(212,175,55,0.2)')}
          />
          <span style={{
            position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
            color: 'rgba(212,175,55,0.6)', fontSize: 13,
          }}>⬡</span>
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(245,241,232,0.35)', fontFamily: 'Inter, sans-serif' }}>
          Il club è su invito. Richiedi il codice a un socio.
        </div>
      </div>
      <ErrorBox message={error} />
      <SubmitButton loading={loading}>Crea account</SubmitButton>
    </form>
  );
}

// ————— Main page —————

export default function LoginPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('login'); // 'login' | 'register'

  const onSuccess = () => navigate('/lobby');

  return (
    <>
      {/* Spinner keyframe */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes welcome-lamp-breathe {
          0%,100% { opacity: 0.78; transform: translate(-50%,-50%) scale(1); }
          50%     { opacity: 1;    transform: translate(-50%,-50%) scale(1.05); }
        }
        @keyframes welcome-bokeh-0 {
          0%,100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(30px,-26px) scale(1.12); }
        }
        @keyframes welcome-bokeh-1 {
          0%,100% { transform: translate(0,0) scale(1.03); }
          50% { transform: translate(-26px,30px) scale(0.96); }
        }
        @keyframes welcome-bokeh-2 {
          0%,100% { transform: translate(0,0) scale(0.94); }
          50% { transform: translate(20px,22px) scale(1.07); }
        }
        @keyframes welcome-bokeh-3 {
          0%,100% { transform: translate(0,0) scale(1.06); }
          50% { transform: translate(-34px,-18px) scale(0.98); }
        }
        @keyframes welcome-dust-float {
          0%   { transform: translateY(108vh) translateX(0); opacity: 0; }
          8%   { opacity: 1; }
          88%  { opacity: 1; }
          100% { transform: translateY(-12vh) translateX(32px); opacity: 0; }
        }
        @keyframes welcome-chip-space {
          0% {
            transform: translate3d(calc(var(--chip-dx, 0px) * -0.45), calc(var(--chip-dy, 0px) * -0.35), calc(var(--chip-dz, 0px) * -0.55)) rotateZ(calc(var(--chip-path-rot, 0deg) * -0.6)) scale(0.94);
          }
          35% {
            transform: translate3d(calc(var(--chip-dx, 0px) * 0.2), calc(var(--chip-dy, 0px) * -0.75), calc(var(--chip-dz, 0px) * 0.45)) rotateZ(calc(var(--chip-path-rot, 0deg) * 0.35)) scale(1.02);
          }
          70% {
            transform: translate3d(calc(var(--chip-dx, 0px) * 0.92), calc(var(--chip-dy, 0px) * 0.38), calc(var(--chip-dz, 0px) * 0.92)) rotateZ(var(--chip-path-rot, 0deg)) scale(1.06);
          }
          100% {
            transform: translate3d(calc(var(--chip-dx, 0px) * -0.3), calc(var(--chip-dy, 0px) * 0.64), calc(var(--chip-dz, 0px) * -0.35)) rotateZ(calc(var(--chip-path-rot, 0deg) * -0.4)) scale(0.97);
          }
        }
        @keyframes welcome-chip-spin {
          from { transform: rotateX(var(--chip-tilt, 0deg)) rotateY(0deg); }
          to { transform: rotateX(var(--chip-tilt, 0deg)) rotateY(360deg); }
        }
      `}</style>

      <div style={{
        minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        background: '#050505',
        padding: '40px 16px',
      }}>
        <WelcomeBackground />
        <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 2 }}>

          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <div style={{
              fontFamily: 'Playfair Display, serif', fontSize: 46, fontWeight: 700,
              color: '#D4AF37', letterSpacing: '-0.025em', lineHeight: 1,
            }}>
              Micetti<span style={{ color: '#F5F1E8', fontStyle: 'italic', fontWeight: 400 }}>.</span>
            </div>
            <div style={{
              marginTop: 10, fontSize: 9.5, fontWeight: 700,
              color: 'rgba(245,241,232,0.35)', letterSpacing: '0.3em',
              fontFamily: 'Inter, sans-serif',
            }}>
              POKER CLUB DI SCARSI
            </div>
            {/* decorative rule */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}>
              <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.25))' }} />
              <span style={{ color: 'rgba(212,175,55,0.4)', fontSize: 12 }}>♠</span>
              <div style={{ flex: 1, height: '1px', background: 'linear-gradient(270deg, transparent, rgba(212,175,55,0.25))' }} />
            </div>
          </div>

          {/* Card */}
          <div style={{
            border: '1px solid rgba(212,175,55,0.15)',
            background: 'rgba(8,6,4,0.85)',
            backdropFilter: 'blur(24px)',
          }}>

            {/* Tab switcher */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(212,175,55,0.1)' }}>
              {[['login', 'Accedi'], ['register', 'Registrati']].map(([id, label]) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    style={{
                      flex: 1, padding: '16px 0',
                      background: active ? 'rgba(212,175,55,0.06)' : 'transparent',
                      border: 'none',
                      borderBottom: active ? '2px solid #D4AF37' : '2px solid transparent',
                      color: active ? '#F5F1E8' : 'rgba(245,241,232,0.45)',
                      fontFamily: 'Inter, sans-serif', fontSize: 11.5, fontWeight: 600,
                      letterSpacing: '0.14em', textTransform: 'uppercase',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Form area */}
            <div style={{ padding: '32px 30px 28px' }}>
              <div style={{
                fontFamily: 'Playfair Display, serif', fontSize: 21, color: '#F5F1E8',
                fontWeight: 500, marginBottom: 26,
              }}>
                {tab === 'login' ? 'Bentornato.' : 'Unisciti al club.'}
              </div>

              {tab === 'login'
                ? <LoginForm onSuccess={onSuccess} />
                : <RegisterForm onSuccess={onSuccess} />
              }
            </div>
          </div>

          {/* Footer */}
          <div style={{
            textAlign: 'center', marginTop: 22,
            fontSize: 11.5, color: 'rgba(245,241,232,0.3)',
            fontFamily: 'Inter, sans-serif', lineHeight: 1.6,
          }}>
            Accesso riservato ai soci del club.
          </div>
        </div>
      </div>
    </>
  );
}
