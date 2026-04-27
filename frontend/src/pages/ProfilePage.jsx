import { AppFrame } from '../components/Shell';
import Profile from '../components/Profile';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <AppFrame user={user}>
      <Profile />
    </AppFrame>
  );
}
