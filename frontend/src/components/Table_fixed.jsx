import { useState, useEffect, useRef } from 'react';
import { GoldButton } from './Shell';
import { usePokerTable } from '../hooks/usePokerTable';
import { useTableChat } from '../hooks/useTableChat_v2';
import BuyinDialog from './BuyinDialog';

export default function PokerTable({ tableId, cardBack = 'ridotto', onLeave }) {
  const { tableState, mySeat, myCards, sendAction, sendChat, joinSeat, leaveSeat } = usePokerTable(tableId);
  const { messages, sendMessage } = useTableChat(sendChat);

  const [pot, setPot] = useState(0);
  const [community, setCommunity] = useState([]);
  const [phase, setPhase] = useState('preflop');
  const [raiseAmt, setRaiseAmt] = useState(40);
  const [log, setLog] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [showBuyin, setShowBuyin] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const chatEndRef = useRef();

  useEffect(() => {
    if (tableState) {
      setPot(tableState.pot || 0);
      setCommunity(tableState.community || []);
      setPhase(tableState.phase || 'preflop');
      if (tableState.log && tableState.log.length) setLog(tableState.log.slice(0, 200).reverse());
    }
  }, [tableState]);

  useEffect(() => {
    if (messages && messages.length) {
      setLog(l => [...messages.map(m => ({ t: new Date(m.ts).toLocaleTimeString('it-IT'), txt: `${m.user}: ${m.text}` })), ...l]);
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleAction = (action, amount = 0) => {
    const time = new Date().toLocaleTimeString('it-IT');
    const txt = action.toUpperCase();
    setLog(l => [{ t: time, txt }, ...l]);
    if (sendAction) sendAction(action, amount);
  };

  const handleSendChat = () => { if (!chatInput) return; if (sendMessage) sendMessage(chatInput); setChatInput(''); };

  const seats = (tableState && tableState.seats) ? tableState.seats : Array.from({ length: 8 }).map(() => null);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 14, borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 10, color: '#888' }}>TAVOLO {tableState?.id ?? tableId}</div>
          <div style={{ fontSize: 16 }}>No-Limit Hold'em <span style={{ color: '#D4AF37' }}>{tableState?.stakes ?? '€0.50/€1'}</span></div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 12 }}>Mano <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{tableState?.handId ?? '-'}</span></div>
          <div style={{ fontSize: 12 }}>{(tableState?.seats || seats).filter(Boolean).length}/{tableState?.seats?.length ?? seats.length}</div>
          <GoldButton variant="ghost" size="sm" onClick={onLeave}>Abbandona ↩</GoldButton>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, position: 'relative', padding: 20 }}>
          <div style={{ position: 'relative', width: '100%', height: '100%', maxWidth: 980, margin: '0 auto' }}>
            <div style={{ position: 'absolute', inset: '10% 4%', borderRadius: '50%', background: 'green', border: '8px solid #3a2818' }}>
              <div style={{ position: 'absolute', top: '58%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#ddd' }}>PIATTO</div>
                <div style={{ fontSize: 24, color: '#D4AF37' }}>€{pot}</div>
              </div>

              <div style={{ position: 'absolute', top: '42%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', gap: 6 }}>
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i}>{community[i] ? <div style={{ width: 52, height: 74, background: '#fff' }}>{community[i]}</div> : <div style={{ width: 52, height: 74, border: '1px dashed rgba(212,175,55,0.1)' }} />}</div>
                ))}
              </div>
            </div>

            {seats.map((s, idx) => (
              <div key={idx} style={{ position: 'absolute', left: `${10 + idx * 11}%`, top: idx < 4 ? '15%' : '85%', transform: 'translate(-50%,-50%)', width: 150, textAlign: 'center' }}>
                {s ? (
                  <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.6)', borderRadius: 8 }}>
                    <div style={{ color: '#fff', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.username}</div>
                    <div style={{ color: '#ddd', fontFamily: 'JetBrains Mono, monospace' }}>€{s.stack}</div>
                  </div>
                ) : (
                  <div role="button" tabIndex={0} onClick={() => { setSelectedSeat(idx); setShowBuyin(true); }} onKeyDown={(e) => { if (e.key === 'Enter') { setSelectedSeat(idx); setShowBuyin(true); } }} style={{ width: 62, height: 62, borderRadius: '50%', border: '1px dashed rgba(212,175,55,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', margin: '0 auto' }}>VUOTO</div>
                )}
              </div>
            ))}

          </div>
        </div>

        <div style={{ width: 300, borderLeft: '1px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 12, borderBottom: '1px solid rgba(0,0,0,0.04)' }}>STORICO</div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 12, background: 'rgba(0,0,0,0.04)', color: '#eee' }}>
            {log.map((l, i) => (
              <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#aaa' }}>{l.t}</div>
                <div>{l.txt || l}</div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div style={{ padding: 10, borderTop: '1px solid rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSendChat(); }} placeholder="Scrivi..." style={{ flex: 1, padding: 8 }} />
              <GoldButton size="sm" onClick={handleSendChat}>Invia</GoldButton>
            </div>
          </div>
        </div>
      </div>

      {showBuyin && <BuyinDialog seat={selectedSeat} tableInfo={tableState?.table ?? tableState} onConfirm={(seat, amount) => { if (joinSeat) joinSeat(seat, amount); setShowBuyin(false); setSelectedSeat(null); }} onCancel={() => { setShowBuyin(false); setSelectedSeat(null); }} />}
    </div>
  );
}
