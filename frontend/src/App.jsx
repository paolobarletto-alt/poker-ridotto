import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import LobbyPage from './pages/LobbyPage';
import TablePage from './pages/TablePage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import RacePage from './pages/RacePage';

function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#050505',
      }}>
        <div style={{
          fontFamily: 'Playfair Display, serif', fontSize: 28,
          color: 'rgba(212,175,55,0.4)', fontStyle: 'italic',
        }}>Ridotto.</div>
      </div>
    );
  }

  return user ? children : <Navigate to="/" replace />;
}

function AppRoutes() {
  const { user, isLoading } = useAuth();

  // Redirect to lobby if already logged in
  if (!isLoading && user) {
    return (
      <Routes>
        <Route path="/" element={<Navigate to="/lobby" replace />} />
        <Route path="/lobby" element={<ProtectedRoute><LobbyPage /></ProtectedRoute>} />
        <Route path="/lobby/:view" element={<ProtectedRoute><LobbyPage /></ProtectedRoute>} />
        <Route path="/table/:id" element={<ProtectedRoute><TablePage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/race" element={<ProtectedRoute><RacePage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/lobby" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/lobby" element={<ProtectedRoute><LobbyPage /></ProtectedRoute>} />
      <Route path="/lobby/:view" element={<ProtectedRoute><LobbyPage /></ProtectedRoute>} />
      <Route path="/table/:id" element={<ProtectedRoute><TablePage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
