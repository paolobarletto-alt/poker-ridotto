# Handoff: Poker Table Animations (Dramatic variant)

## Overview

Pacchetto di riferimento per implementare le animazioni di **distribuzione carte** e **gestione chips (bet/win)** nel tavolo No-Limit Hold'em esistente. Il tavolo è già sviluppato (feltro verde ovale, 9 posti, pot centrale, cronologia/chat a destra) — questo handoff fornisce solo le animazioni da integrare.

La variante scelta è **Dramatic**: timing cinematico (~1.35× base), showdown con pausa, glow dorato sul piatto in vincita.

## About the Design Files

I file in `reference/` sono **design reference in HTML/JSX** — prototipi che mostrano il look e il comportamento previsti, **non codice di produzione da copiare direttamente**. Il task è **ricreare queste animazioni nel codebase target** usando i pattern e le librerie già stabilite (React/Vue/vanilla — qualunque sia lo stack del sito esistente). Il layout del tavolo, i seats, il pot, il mazzo, le carte community **esistono già**: vanno **aggiunte solo le animazioni** su quegli elementi.

## Fidelity

**High-fidelity**: timing, easing, offset, dimensioni chip, colori, struttura delle carte sono definiti puntualmente. Vanno replicati fedelmente.

---

## Variante scelta: Dramatic

Costanti da replicare:

```js
const BASE = 500 * 1.35; // 675ms — unità base di timing
const VARIANT = {
  speedMul: 1.35,
  glow: true,   // glow dorato sul piatto in fase WIN
  label: 'Dramatic',
};
```

Tutti i tempi sotto sono espressi come multipli di `BASE`.

---

## Scenes / Fasi della mano

Ordine deterministico eseguito in loop (tutta una mano):

1. **IDLE** (0.5 × BASE)
2. **DEAL** — 2 carte a testa, una alla volta, dal mazzo
3. **PREFLOP** — small blind + big blind + giro puntate
4. **Collect bets → pot**
5. **FLOP** — 3 carte community
6. **FLOP-BET** — giro puntate + collect
7. **TURN** — 1 carta + bet + collect
8. **RIVER** — 1 carta + bet + collect
9. **SHOWDOWN** — flip carte coperte dei non-foldati
10. **WIN** — glow pot + pila intera che scivola al vincitore
11. **COLLECT** — carte ritornano al mazzo, dealer button avanza
12. Loop

---

## Animazione 1 · Distribuzione carte (DEAL)

**Trigger**: inizio nuova mano dopo IDLE.

**Comportamento**:
- Le carte partono dal mazzo in posizione `DECK_POS` (accanto al dealer, alto-destra del tavolo).
- Una carta per volta, in ordine: `(dealer + 1) → (dealer + 2) → … → dealer` (primo giro), poi secondo giro uguale.
- Ogni carta inizia a `DECK_POS`, poi in un tick (`20–30ms`) viene assegnata la posizione di destinazione (`holeCardPos(seat, cardIdx)`), con la transizione CSS che la fa volare.

**Posizioni hole card** (ogni seat ha 2 slot):
```js
function holeCardPos(seat, idx) {
  const dx = CENTER_X - seat.x, dy = CENTER_Y - seat.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;   // unit verso centro
  const px = -uy, py = ux;              // perpendicolare
  const inward = 58;
  const offset = idx === 0 ? -16 : 16;
  return {
    x: seat.x + ux * inward + px * offset,
    y: seat.y + uy * inward + py * offset,
    rot: Math.atan2(uy, ux) * 180 / Math.PI - 90,
  };
}
```

**Timing per carta**:
- Delay tra spawn e target update: `20–30ms`
- Durata volo (CSS transition): `500 × 1.35 = 675ms`
- Attesa prima della carta successiva: `max(180, BASE × 0.36) = ~243ms`

**CSS della carta in volo**:
```css
.pk-card-wrap {
  position: absolute;
  width: 52px; height: 74px;
  transform-style: preserve-3d;
  transition:
    left 675ms cubic-bezier(.4, 1.3, .5, 1),
    top  675ms cubic-bezier(.4, 1.3, .5, 1),
    transform 675ms cubic-bezier(.34, 1.56, .64, 1);
}
```

Le carte partono **coperte** (`rotateY(0deg)`). La rotazione finale matcha l'orientamento del seat.

---

## Animazione 2 · Flip carte scoperte (bounce)

**Trigger**: (a) carte community appena piazzate, (b) showdown per i giocatori non-foldati.

**Tecnica**: 3D flip su asse Y con cubic-bezier a rimbalzo.

- Wrap con `transform-style: preserve-3d`
- Due facce con `backface-visibility: hidden`
  - Back: retro rosso con pattern 45° + bordo dorato
  - Front: `transform: rotateY(180deg)` di default
- Per flippare: toggle classe → `transform: rotateY(180deg)` sul wrap

**Easing**: `cubic-bezier(.34, 1.56, .64, 1)` — bounce leggero
**Durata**: ~675ms

**Community**: flip **una carta alla volta** dopo averla piazzata (wait `BASE × 0.45 = ~304ms` dopo arrivo, poi flip, poi `BASE × 0.3 = ~203ms` prima della successiva).

**Showdown**: flip **simultaneo** di tutte le hole card dei non-foldati; attesa `BASE × 1.1 = ~743ms` prima della fase WIN.

---

## Animazione 3 · Bet chips (arco parabolico, NO rotazione)

**Trigger**: quando un giocatore call/raise/blind.

**Comportamento**:
- Ogni bet si scompone in chip singole tramite `chipBreakdown(amount)` (greedy su denominazioni 1000/500/100/25/5/1, max 12 chip visibili).
- Ogni chip viaggia dal **seat stack** (`seatStackPos(seat)`) al **bet spot** del giocatore (`seatBetPos(seat)`), **non** al pot direttamente.
- Traiettoria: arco quadratico Bézier.
- **NESSUNA rotazione** durante il volo (solo translate lungo offset-path).
- Stagger tra chip: `40ms` (quick mode `25ms` per le blind).

**Implementazione arco (CSS offset-path)**:
```js
const dx = x1 - x0, dy = y1 - y0;
const dist = Math.hypot(dx, dy);
const cx = (x0 + x1) / 2;
const cy = (y0 + y1) / 2 - Math.max(60, dist * 0.35); // altezza arco
const path = `path('M ${x0} ${y0} Q ${cx} ${cy} ${x1} ${y1}')`;
el.style.offsetPath = path;
el.style.animation = `chip-flight 675ms cubic-bezier(.4,0,.3,1) ${delay}ms forwards`;
```

```css
@keyframes chip-flight {
  0%   { offset-distance: 0%;   transform: scale(1); }
  100% { offset-distance: 100%; transform: scale(1); }
}
```

**Jitter**: start/end ±4px casuali per ogni chip, per evitare sovrapposizione perfetta.

**Seat positions**:
- `seatStackPos(seat)` — 108px verso centro dal seat (dove risiede lo stack del giocatore)
- `seatBetPos(seat)` — 168px verso centro dal seat (bet spot, tra stack e pot)

**Dopo il volo**: il chip singolo si dissolve; la pila di bet davanti al giocatore viene renderizzata come `<ChipStack>` statica con `amount = player.bet`.

**Chip visivi** — denominazioni con gradiente radiale e bordo tratteggiato:
```js
const CHIP_DENOMS = [
  { v: 1000, base: '#1b1b1b', accent: '#f2d58c', label: 'K' },
  { v: 500,  base: '#5c2a8a', accent: '#ead9ff', label: '500' },
  { v: 100,  base: '#1c1c1c', accent: '#ffffff', label: '100' },
  { v: 25,   base: '#1f6b3a', accent: '#e9f5ec', label: '25' },
  { v: 5,    base: '#b22828', accent: '#ffe2dc', label: '5' },
  { v: 1,    base: '#e6e3d8', accent: '#3a3a3a', label: '1' },
];
```

Ogni chip: 22×22px, `border-radius: 50%`, gradiente `radial-gradient(circle at 35% 30%, <accent>22, <base> 60%)`, bordo interno dashed in `<accent>` al 60% opacity.

---

## Animazione 4 · Collect bets → pot

**Trigger**: fine di ogni giro di puntate.

**Comportamento**:
- Per ogni giocatore con `bet > 0`, fly delle chip dalla posizione bet al `POT_POS` (centro-basso del tavolo).
- Stesso arco parabolico, stagger `20ms`.
- Attesa `BASE × 0.6 = ~405ms`, poi reset `player.bet = 0` e `pot += totale`.

---

## Animazione 5 · Win (pila intera che scivola)

**Trigger**: fase WIN, dopo showdown.

**Comportamento**:
1. Scelta vincitore (random tra non-foldati nel demo; nel prodotto vero: risultato reale della mano).
2. Glow dorato sotto il pot (radial-gradient, opacity transition 400ms).
   ```css
   .pk-pot-glow {
     position: absolute;
     width: 120px; height: 120px;
     border-radius: 50%;
     background: radial-gradient(circle, rgba(232,200,122,0.25) 0%, transparent 65%);
     transform: translate(-50%, -50%);
     opacity: 0;
     transition: opacity 400ms;
   }
   .pk-pot-glow.on { opacity: 1; }
   ```
3. Halo pulsante sull'avatar del vincitore (ring dorato):
   ```css
   @keyframes pk-pulse { 0%,100% { opacity: 0.35 } 50% { opacity: 1 } }
   ```
4. Attesa `BASE × 0.7 = ~473ms`.
5. **La pila intera del piatto** scivola al seat stack del vincitore. Non si esplode in chip singole — è un singolo elemento `<ChipStack>` che cambia coordinate via transizione CSS:
   ```css
   .pk-chip-stack {
     transition:
       left 600ms cubic-bezier(.4, 0, .2, 1),
       top  600ms cubic-bezier(.4, 0, .2, 1),
       opacity 250ms;
   }
   ```
6. Attesa `BASE × 1.1 = ~743ms` (il tempo della slide + margine).
7. `player.stack += pot`, `pot = 0`, glow off.

---

## Animazione 6 · Dealer button (sposta)

**Trigger**: fine mano, prima del loop.

**Comportamento**: la "D" dorata (22×22, gradiente bianco→beige, bordo oro scuro) è posizionata relativa all'avatar del dealer corrente. Al cambio dealer, le sue coordinate `left/top` cambiano con transizione:
```css
transition: left 600ms cubic-bezier(.4,0,.2,1), top 600ms cubic-bezier(.4,0,.2,1);
```

---

## Animazione 7 · Turn timer (ring)

**Trigger**: durante ogni giro di puntate, per il seat attivo.

**Comportamento**: ring SVG dorato intorno all'avatar che si scarica (tipo cronometro). `strokeDashoffset` animato in senso antiorario su intervallo di ~50ms fino a completare la durata del turno (`BASE × 0.5 = ~338ms`).

```jsx
<circle
  r={(size + 6) / 2}
  stroke="#f5dc9a" strokeWidth="2.5"
  strokeDasharray={`${Math.PI * (size + 6)}`}
  strokeDashoffset={`${Math.PI * (size + 6) * (1 - timerPct)}`}
  transform={`rotate(-90 cx cy)`}
  style={{ transition: 'stroke-dashoffset 120ms linear' }}
/>
```

Durante il turno: glow dorato sull'avatar (`box-shadow: 0 0 18px rgba(232,200,122,0.4)`), bordo `#e8c87a` pieno anziché al 55%.

---

## Animazione 8 · Fold (carte verso mazzo)

**Trigger**: giocatore che fa fold.

**Comportamento**: le due hole card del giocatore che folda cambiano target `→ DECK_POS` con jitter ±15px su x, stessa transizione delle carte in volo, `faceUp = false`. Dopo `BASE × 0.5 = ~338ms` vengono rimosse dall'array. Avatar del giocatore passa a `opacity: 0.45`, bordo avatar a `rgba(150,130,90,0.25)`.

---

## Design Tokens

### Colori
| Token | Valore | Uso |
|---|---|---|
| `--felt-outer` | `#0e3a20` | feltro, ombra esterna |
| `--felt-mid` | `#1e5430` | feltro gradiente |
| `--felt-inner` | `#2b6b3d` | feltro centro |
| `--wood-top` | `#8a5a2a` | bordo legno top |
| `--wood-bot` | `#4a2d14` | bordo legno bottom |
| `--gold` | `#e8c87a` | accenti, bordi attivi, testi titolo |
| `--gold-dim` | `#c9b685` | testi secondari |
| `--gold-darker` | `#8a7b5a` | label |
| `--card-back` | `#7a1616` / pattern `#8b1a1a` / `#6e1212` | retro carta |
| `--card-front` | gradiente `#fefcf6 → #f5f0e2` | fronte carta |
| `--suit-red` | `#b3261e` | cuori, quadri |
| `--suit-black` | `#1a1a1a` | picche, fiori |
| `--bg` | `#0a0a08` | sfondo pagina |

### Dimensioni
- Carta: 52×74px, scala 1.15× per community
- Chip: 22×22px
- Avatar seat: 64×64px
- Dealer button: 22×22px
- Tavolo (area giocabile): 1040×580, ellisse felt 920×460

### Typography
- Titoli/watermark: **Cormorant Garamond** (italic per watermark "Ridotto")
- UI: **Inter** (400/500/600), letter-spacing elevato su label (1.5–2) uppercase

### Easing curves
- Volo carta: `cubic-bezier(.4, 1.3, .5, 1)` (pos) + `cubic-bezier(.34, 1.56, .64, 1)` (flip bounce)
- Volo chip: `cubic-bezier(.4, 0, .3, 1)` (standard ease-in-out leggero)
- Pot slide: `cubic-bezier(.4, 0, .2, 1)`
- Pulse vincitore: `ease-in-out` 1.2s infinite alternate

---

## State management necessario

Minimo set di variabili per orchestrare le animazioni:

```ts
type Phase = 'idle'|'deal'|'preflop'|'flop'|'flop-bet'|'turn'|'turn-bet'
           | 'river'|'river-bet'|'showdown'|'win'|'collect';

state = {
  phase: Phase,
  dealerSeat: number,
  activeSeat: number,        // per turn timer ring
  timerPct: number,          // 0..1
  winnerSeat: number | null,
  pot: number,
  players: Array<{
    name: string,
    stack: number,
    bet: number,              // scorre in real-time come chip escono dallo stack
    folded: boolean,
    holeCards: [Card, Card],
    revealed: boolean,
  }>,
  flyingCards: Array<{ id, rank, suit, color, x, y, rot, faceUp, z }>,
  communityCards: Array<{ id, rank, suit, color, x, y, faceUp }>,
  chipFlights: Array<{ id, denom, x0, y0, x1, y1, delay, durationMs }>,
  potSlideTarget: { x, y } | null,  // quando ≠ null, pot stack scivola lì
  potGlowOn: boolean,
};
```

---

## Integrazione nel sito esistente

1. I seat, il pot, il mazzo, il layout del tavolo **esistono già**: usa i loro DOM/coordinate reali. Le funzioni `seatPositions / holeCardPos / seatStackPos / seatBetPos / communityPos` sono solo riferimenti matematici — adattale alle coordinate reali del tuo layout.
2. Aggiungi un layer assoluto sopra il tavolo per le **carte in volo** e le **chip in flight** (non toccare il DOM dei seat).
3. Collega gli **eventi del gioco reale** alle fasi: quando il server emette `DEAL`, triggera la sequenza deal; quando `ACTION { type: 'call', amount }`, triggera `flyChips` dal seat al bet spot; ecc.
4. Il demo usa timing fissi e giocatori random — in produzione, ogni animazione deve **attendere la conferma di completamento** prima di permettere l'azione successiva, oppure essere messa in coda se arrivano eventi troppo ravvicinati.

---

## Files in reference/

- `Poker Table.html` — entry, mostra le 3 varianti in un design canvas. **Guarda la variante C · Dramatic**.
- `cards.jsx` — componente Card (flip bounce) + buildDeck/chip breakdown util
- `chips.jsx` — Chip, ChipStack, ChipInFlight (arco parabolico, no rotazione)
- `table.jsx` — Felt SVG, Seat, Deck, utility posizioni
- `hand-loop.jsx` — state machine completa della mano, orchestrazione di tutte le fasi

---

## Assets

Nessun asset esterno richiesto. Tutto generato via CSS/SVG.

Font: Cormorant Garamond + Inter da Google Fonts (già caricati se il sito li usa).
