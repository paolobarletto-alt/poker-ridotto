import { Sidebar } from '../components/Shell';
import Profile from '../components/Profile';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <div style={{ display: 'flex', height: '100%', background: '#050505' }}>
      <Sidebar user={user} />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Profile />
      </div>
    </div>
  );
}
