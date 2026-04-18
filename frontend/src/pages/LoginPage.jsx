import { useState } from 'react';
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
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{
        minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(ellipse at 40% 35%, #1a1008 0%, #050505 65%)',
        padding: '40px 16px',
      }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <div style={{
              fontFamily: 'Playfair Display, serif', fontSize: 46, fontWeight: 700,
              color: '#D4AF37', letterSpacing: '-0.025em', lineHeight: 1,
            }}>
              Ridotto<span style={{ color: '#F5F1E8', fontStyle: 'italic', fontWeight: 400 }}>.</span>
            </div>
            <div style={{
              marginTop: 10, fontSize: 9.5, fontWeight: 700,
              color: 'rgba(245,241,232,0.35)', letterSpacing: '0.3em',
              fontFamily: 'Inter, sans-serif',
            }}>
              POKER CLUB PRIVATO
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
