import { useNavigate } from 'react-router-dom';
import PokerTable from '../components/Table';

export default function TablePage() {
  const navigate = useNavigate();

  return (
    <div style={{ height: '100%' }}>
      <PokerTable
        cardBack="ridotto"
        onLeave={() => navigate('/lobby')}
      />
    </div>
  );
}
