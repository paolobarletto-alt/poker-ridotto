import { useParams } from 'react-router-dom';
import { Sidebar } from '../components/Shell';
import Lobby from '../components/Lobby';
import { useAuth } from '../context/AuthContext';

export default function LobbyPage() {
  const { view } = useParams();
  const { user } = useAuth();

  return (
    <div style={{ display: 'flex', height: '100%', background: '#050505' }}>
      <Sidebar user={user} />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Lobby view={view || 'lobby'} />
      </div>
    </div>
  );
}
