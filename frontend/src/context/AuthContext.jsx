import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/auth';

const AuthContext = createContext(null);

const TOKEN_KEY = 'ridotto_token';

function safeGetItem(key) { try { return localStorage.getItem(key); } catch { return null; } }
function safeSetItem(key, value) { try { localStorage.setItem(key, value); } catch {} }
function safeRemoveItem(key) { try { localStorage.removeItem(key); } catch {} }

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => safeGetItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState(true);

  // On mount, fetch current user if token exists
  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    authApi.me()
      .then((res) => setUser(res.data))
      .catch(() => {
        // Token invalid or expired
        safeRemoveItem(TOKEN_KEY);
        setToken(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await authApi.login(email, password);
    const { access_token, user: userData } = res.data;
    localStorage.setItem(TOKEN_KEY, access_token);
    setToken(access_token);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    safeRemoveItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  const register = async (data) => {
    const res = await authApi.register(data);
    const { access_token, user: userData } = res.data;
    localStorage.setItem(TOKEN_KEY, access_token);
    setToken(access_token);
    setUser(userData);
    return userData;
  };

  /** Aggiorna istantaneamente il chips_balance nel contesto (senza fetch). */
  const updateBalance = useCallback((newBalance) => {
    setUser((prev) => prev ? { ...prev, chips_balance: newBalance } : prev);
  }, []);

  /** Re-fetcha /users/me e aggiorna tutto l'oggetto utente. */
  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const res = await authApi.me();
      setUser(res.data);
    } catch {
      // Ignora errori di rete
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, register, updateBalance, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
