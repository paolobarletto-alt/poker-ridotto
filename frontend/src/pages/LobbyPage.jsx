import { useParams } from 'react-router-dom';
import { AppFrame } from '../components/Shell';
import Lobby from '../components/Lobby';
import { useAuth } from '../context/AuthContext';

export default function LobbyPage() {
  const { view } = useParams();
  const { user } = useAuth();

  return (
    <AppFrame user={user}>
      <Lobby view={view || 'lobby'} />
    </AppFrame>
  );
}
