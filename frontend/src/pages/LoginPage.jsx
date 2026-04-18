import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GoldButton } from '../components/Shell';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
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
      navigate('/lobby');
    } catch (err) {
      setError(err.response?.data?.detail || 'Credenziali non valide.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '12px 16px',
    background: 'rgba(245,241,232,0.04)',
    border: '1px solid rgba(212,175,55,0.2)',
    color: '#F5F1E8', fontSize: 14,
    fontFamily: 'Inter, sans-serif',
    outline: 'none',
    transition: 'border-color 0.15s',
  };

  return (
    <div style={{
      height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 30% 40%, #0a1810 0%, #050505 60%)',
    }}>
      <div style={{ width: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            fontFamily: 'Playfair Display, serif', fontSize: 42, fontWeight: 700,
            color: '#D4AF37', letterSpacing: '-0.02em', lineHeight: 1,
          }}>
            Ridotto<span style={{ color: '#F5F1E8', fontStyle: 'italic', fontWeight: 400 }}>.</span>
          </div>
          <div style={{
            fontFamily: 'Inter, sans-serif', fontSize: 9.5, fontWeight: 600,
            color: 'rgba(245,241,232,0.4)', letterSpacing: '0.28em', marginTop: 8,
          }}>
            POKER CLUB · DAL 2019
          </div>
        </div>

        {/* Card */}
        <div style={{
          border: '1px solid rgba(212,175,55,0.15)',
          background: 'rgba(10,10,10,0.8)',
          padding: '36px 32px',
          backdropFilter: 'blur(20px)',
        }}>
          <div style={{
            fontFamily: 'Playfair Display, serif', fontSize: 22, color: '#F5F1E8',
            marginBottom: 28, fontWeight: 500,
          }}>Accedi al club</div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: 'block', fontSize: 9.5, letterSpacing: '0.2em', fontWeight: 600,
                color: 'rgba(245,241,232,0.5)', marginBottom: 8, fontFamily: 'Inter, sans-serif',
              }}>EMAIL</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'rgba(212,175,55,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(212,175,55,0.2)'}
              />
            </div>

            <div style={{ marginBottom: 28 }}>
              <label style={{
                display: 'block', fontSize: 9.5, letterSpacing: '0.2em', fontWeight: 600,
                color: 'rgba(245,241,232,0.5)', marginBottom: 8, fontFamily: 'Inter, sans-serif',
              }}>PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'rgba(212,175,55,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(212,175,55,0.2)'}
              />
            </div>

            {error && (
              <div style={{
                marginBottom: 20, padding: '10px 14px',
                background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.3)',
                fontSize: 12, color: '#e07070', fontFamily: 'Inter, sans-serif',
              }}>{error}</div>
            )}

            <GoldButton style={{ width: '100%', justifyContent: 'center' }} onClick={handleSubmit}>
              {loading ? 'Accesso…' : 'Entra'}
            </GoldButton>
          </form>
        </div>

        <div style={{
          textAlign: 'center', marginTop: 20,
          fontSize: 12, color: 'rgba(245,241,232,0.4)', fontFamily: 'Inter, sans-serif',
        }}>
          Accesso riservato ai soci del club.
        </div>
      </div>
    </div>
  );
}
