# CLAUDE.md — Frontend Ridotto Poker

## Stack
Vite + React 18 · React Router v6 · Axios · CSS inline (no classi esterne)

## Struttura src/

```
src/
  api/
    client.js          ✅ axios + interceptor JWT — NON TOCCARE
    auth.js            ✅ login, register, me — NON TOCCARE
    tables.js          ✅ include metodi Sit&Go (list/create/detail/register/unregister)
  components/
    Shell.jsx          ✅ Sidebar, TopBar, GoldButton, TrafficLights — NON TOCCARE
    Lobby.jsx          ✅ fetch reale tavoli + Sit&Go, polling, registrazione torneo
    Table.jsx          ⚠️  collegare a usePokerTable, timer, showdown, chat
    Table_clean.jsx    ⚠️  versione attuale in uso (da unificare in Table.jsx)
    Table_fixed.jsx    🗑️  versione obsoleta, ignorare
    Profile.jsx        ⚠️  sostituire mock con fetch reali
    BuyinDialog.jsx    ✅ creato
    CreateTableModal.jsx ✅ creato, supporta Cash + Sit&Go
  context/
    AuthContext.jsx    ✅ useAuth() → { user, token, login, logout, register } — NON TOCCARE
  hooks/
    usePokerTable.js   ⚠️  aggiungere sendAction, sendChat, joinSeat, leaveSeat
    useTableChat.js    ⚠️  completare o usare useTableChat_v2.js
  pages/
    LoginPage.jsx      ✅ NON TOCCARE
    LobbyPage.jsx      ✅ wrapper della Lobby
    TablePage.jsx      ⚠️  non passa tableId correttamente, da correggere
    ProfilePage.jsx    da collegare a Profile.jsx
    AdminPage.jsx      da verificare/completare
  App.jsx              ✅ routing + ProtectedRoute — NON TOCCARE
  main.jsx             ✅ NON TOCCARE
```

---

## ⚠️ REGOLA ASSOLUTA — Design System

**Non aggiungere MAI:**
- File `.css` o `.scss`
- Librerie UI (MUI, Chakra, Tailwind, Ant Design, Bootstrap, ecc.)
- `className` con stili da file esterni
- `styled-components`, `emotion`, o simili

**Tutto lo stile è CSS inline:**
```jsx
// GIUSTO
<div style={{ color: '#D4AF37', fontSize: 14, fontFamily: 'Inter, sans-serif' }}>

// SBAGLIATO
<div className="gold-text">
<div class="text-yellow-400">
```

---

## Design System — valori esatti

### Colori
```js
const C = {
  bg:          '#050505',   // body
  panel:       '#0a0a0a',   // pannelli
  modal:       '#0e0e0e',   // modali
  gold:        '#D4AF37',   // primario
  goldLight:   '#E8C252',   // gradient top bottone
  goldDark:    '#B8941F',   // gradient bottom bottone
  cream:       '#F5F1E8',   // testo primario
  cream60:     'rgba(245,241,232,0.6)',   // testo secondario
  cream35:     'rgba(245,241,232,0.35)',  // testo disabilitato
  red:         '#c0392b',   // errori, fold
  felt:        '#1a4a2e',   // tavolo poker
  border:      'rgba(212,175,55,0.12)',   // bordi sottili
  borderMid:   'rgba(212,175,55,0.25)',   // bordi normali
  goldBg:      'rgba(212,175,55,0.04)',   // sfondo gold tenue
  goldBg8:     'rgba(212,175,55,0.08)',   // sfondo gold hover
}
```

### Font
```js
const F = {
  serif:  "'Playfair Display', serif",   // titoli, nomi, valori chip importanti
  sans:   "'Inter', sans-serif",          // UI, label, testo normale
  mono:   "'JetBrains Mono', monospace",  // chip, numeri, timestamp, codici
}
```

### GoldButton (già in Shell.jsx)
```jsx
// Usa sempre il GoldButton esistente — non creare bottoni custom
<GoldButton variant="solid" size="sm|md|lg" onClick={fn}>Testo</GoldButton>
<GoldButton variant="ghost" size="sm" onClick={fn}>Testo</GoldButton>
```

### Modale standard
```jsx
// Overlay
<div style={{
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
}}>
  // Pannello
  <div style={{
    width: 480, background: '#0e0e0e',
    border: '1px solid rgba(212,175,55,0.25)',
    padding: '32px 36px',
  }}>
```

### Input standard
```jsx
<input style={{
  width: '100%', background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(212,175,55,0.2)',
  color: '#F5F1E8', padding: '10px 14px',
  fontFamily: "'Inter', sans-serif", fontSize: 13,
  outline: 'none',
}}
onFocus={e => e.target.style.borderColor = '#D4AF37'}
onBlur={e => e.target.style.borderColor = 'rgba(212,175,55,0.2)'}
/>
```

### Skeleton loading
```jsx
// Placeholder animato mentre carica
const shimmer = {
  background: 'rgba(212,175,55,0.04)',
  animation: 'shimmer 1.5s infinite',
  // Keyframes in index.html o main.jsx:
  // @keyframes shimmer { 0%,100% { opacity:0.4 } 50% { opacity:0.8 } }
}
```

---

## Convenzioni codice React

### Componenti
```jsx
// Funzionali con hooks
function MyComponent({ prop1, prop2 }) {
  const { user } = useAuth()
  // ...
  return (/* JSX con style inline */)
}
export default MyComponent
```

### API calls
```jsx
// SEMPRE tramite api/client.js (mai fetch() o axios diretto)
import api from '../api/client'

const res = await api.get('/tables')          // GET /tables
const res = await api.post('/tables', data)   // POST /tables
```

### Auth
```jsx
// SEMPRE useAuth() — mai localStorage diretto
import { useAuth } from '../context/AuthContext'
const { user, token, login, logout } = useAuth()
```

### Navigazione
```jsx
import { useNavigate, useParams } from 'react-router-dom'
const navigate = useNavigate()
const { tableId } = useParams()

navigate('/lobby')
navigate(`/table/${id}`)
```

### WebSocket
```jsx
// useRef per il socket, NON useState (evita re-render continui)
const wsRef = useRef(null)

useEffect(() => {
  const ws = new WebSocket(`${WS_URL}/ws/table/${tableId}?token=${token}`)
  wsRef.current = ws
  return () => ws.close()
}, [tableId])
```

---

## usePokerTable — stato ritornato (dopo completamento)

```js
const {
  // Stato tavolo
  tableState,       // { seats[9], pot, community, phase, acting_seat, timer_seconds, hand_number }
  tableConfig,      // { name, table_type, min_players, max_seats, speed, small_blind, big_blind, ... }
  myCards,          // ['A♠','K♥'] o []
  mySeat,           // numero posto o null
  connected,        // bool
  reconnecting,     // bool

  // Risultati
  showdownResults,  // array o null (auto-azzera dopo 3s)
  handEndResult,    // { winner_seat, pot_won, hand_description } o null
  waitingForPlayers, // int o null
  lastError,        // string o null (auto-azzera dopo 4s)
  handLog,          // array stringhe log azioni

  // Torneo (solo Sit&Go)
  isTournament,
  tournament,       // { id, name, current_blind_level, blind_schedule, speed }
  blindLevelEndsAt, // Date o null
  eliminatedPlayers, // array
  tournamentEnded,  // { winner_username, position_results } o null

  // Azioni
  sendAction,       // (action: string, amount?: number) => void
  sendChat,         // (message: string) => void
  joinSeat,         // (seat: number, buyin: number) => void
  leaveSeat,        // () => void
} = usePokerTable(tableId)
```

---

## Messaggi WebSocket — riferimento rapido

### Server → Client (broadcast)
```js
{ type: "table_state", seats, pot, community, phase, acting_seat, timer_seconds, hand_number }
{ type: "player_action", seat, action, amount }
{ type: "showdown", results: [{seat, hand_description, cards, won, amount}] }
{ type: "hand_end", winner_seat, pot_won, hand_description }
{ type: "waiting_players", needed: 2 }
{ type: "player_joined", seat, username, stack }
{ type: "player_left", seat, username }
{ type: "blind_level_up", level, small_blind, big_blind, next_level_in }
{ type: "player_eliminated", seat, position, username }
{ type: "tournament_ended", winner_username, position_results }
{ type: "chat", from, message, ts }
{ type: "error", message }
```

### Server → Client (privato, solo al destinatario)
```js
{ type: "welcome", table: {...}, state: {...}, tournament?: {...} }
{ type: "hole_cards", cards: ["A♠","K♥"] }
```

### Client → Server
```js
{ type: "join_seat", seat: 3, buyin: 1000 }
{ type: "leave_seat" }
{ type: "action", action: "fold"|"check"|"call"|"raise"|"allin", amount: 0 }
{ type: "chat", message: "gg" }
{ type: "ping" }
```

---

## CreateTableModal — campi form
```
Nome tavolo: text (3-50 chars)
Tipo: toggle "Cash Game" / "Sit & Go"
Min giocatori: select 2-9 (Sit&Go: 2-8)
Max posti: select min_giocatori..9 (Sit&Go: max 8)
Velocità: toggle "Lenta" (30s) / "Normale" (20s) / "Veloce" (10s)
--- se Cash Game ---
Blind piccolo: number
Blind grande: readonly = piccolo * 2
Buy-in minimo: number (>= grande * 10)
Buy-in massimo: number opzionale (null = no limite)
--- se Sit & Go ---
Chips di partenza: number (>= 1000)
```

---

## Testo UI
L'app è in **italiano**. Tutti i testi visibili all'utente, messaggi di errore,
label e placeholder sono in italiano. I nomi di variabili e funzioni sono in inglese.
