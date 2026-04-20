"""
poker_engine.py — Motore Texas Hold'em No-Limit puro Python
Nessuna dipendenza esterna: solo standard library (random, itertools, enum, dataclasses)
"""

import random
import itertools
from enum import Enum, IntEnum
from dataclasses import dataclass, field
from typing import Optional
from collections import defaultdict


# ─────────────────────────────────────────────
# CARTE
# ─────────────────────────────────────────────

class Seme(Enum):
    PICCHE  = '♠'
    CUORI   = '♥'
    QUADRI  = '♦'
    FIORI   = '♣'


class Valore(IntEnum):
    DUE    = 2
    TRE    = 3
    QUATTRO= 4
    CINQUE = 5
    SEI    = 6
    SETTE  = 7
    OTTO   = 8
    NOVE   = 9
    DIECI  = 10
    JACK   = 11
    QUEEN  = 12
    KING   = 13
    ACE    = 14

    def simbolo(self) -> str:
        nomi = {2:'2', 3:'3', 4:'4', 5:'5', 6:'6', 7:'7',
                8:'8', 9:'9', 10:'T', 11:'J', 12:'Q', 13:'K', 14:'A'}
        return nomi[self.value]


@dataclass(frozen=True)
class Carta:
    valore: Valore
    seme: Seme

    def __str__(self) -> str:
        return f"{self.valore.simbolo()}{self.seme.value}"

    def __repr__(self) -> str:
        return str(self)


class Mazzo:
    """Mazzo di 52 carte, mescolabile."""

    def __init__(self):
        self.carte: list[Carta] = [
            Carta(v, s) for s in Seme for v in Valore
        ]
        self.shuffle()

    def shuffle(self):
        random.shuffle(self.carte)

    def deal(self, n: int = 1) -> list[Carta]:
        """Distribuisce n carte dalla cima del mazzo."""
        if len(self.carte) < n:
            raise ValueError("Carte esaurite nel mazzo")
        distribuite = self.carte[:n]
        self.carte = self.carte[n:]
        return distribuite

    def deal_one(self) -> Carta:
        return self.deal(1)[0]

    def __len__(self):
        return len(self.carte)


# ─────────────────────────────────────────────
# VALUTAZIONE MANO
# ─────────────────────────────────────────────

class RangoMano(IntEnum):
    CARTA_ALTA    = 1
    COPPIA        = 2
    DOPPIA_COPPIA = 3
    TRIS          = 4
    SCALA         = 5
    COLORE        = 6
    FULL          = 7
    POKER_MANO    = 8   # chiamato POKER_MANO per evitare conflitto col nome del gioco
    SCALA_COLORE  = 9
    SCALA_REALE   = 10


@dataclass
class RisultatoMano:
    rango: RangoMano
    tiebreakers: tuple          # valori per lo spareggio, dal più alto al più basso
    carte: list[Carta]          # le 5 carte migliori che formano la mano
    descrizione: str

    def __gt__(self, other: 'RisultatoMano') -> bool:
        return (self.rango, self.tiebreakers) > (other.rango, other.tiebreakers)

    def __eq__(self, other: 'RisultatoMano') -> bool:
        return (self.rango, self.tiebreakers) == (other.rango, other.tiebreakers)

    def __lt__(self, other: 'RisultatoMano') -> bool:
        return (self.rango, self.tiebreakers) < (other.rango, other.tiebreakers)

    def __ge__(self, other: 'RisultatoMano') -> bool:
        return not self.__lt__(other)

    def __le__(self, other: 'RisultatoMano') -> bool:
        return not self.__gt__(other)


class ValutatoreRisultato:
    """Valuta la migliore mano di 5 carte da un set di 5–7 carte."""

    @staticmethod
    def valuta(carte: list[Carta]) -> RisultatoMano:
        if len(carte) < 5:
            raise ValueError("Servono almeno 5 carte")
        # Prova tutte le combinazioni di 5 carte e restituisce la migliore
        migliore = None
        for combo in itertools.combinations(carte, 5):
            risultato = ValutatoreRisultato._valuta_cinque(list(combo))
            if migliore is None or risultato > migliore:
                migliore = risultato
        return migliore

    @staticmethod
    def _valuta_cinque(carte: list[Carta]) -> RisultatoMano:
        """Valuta esattamente 5 carte."""
        assert len(carte) == 5

        valori = sorted([c.valore for c in carte], reverse=True)
        semi   = [c.seme for c in carte]
        conta  = defaultdict(int)
        for v in valori:
            conta[v] += 1

        è_colore  = len(set(semi)) == 1
        è_scala   = ValutatoreRisultato._controlla_scala(valori)
        è_scala_a_bassa = ValutatoreRisultato._controlla_scala_asso_basso(valori)

        # Ordina per frequenza (desc) poi per valore (desc)
        gruppi = sorted(conta.items(), key=lambda x: (x[1], x[0]), reverse=True)
        frequenze = [g[1] for g in gruppi]
        val_ordinati = [g[0] for g in gruppi]

        # Scala reale
        if è_colore and è_scala and valori[0] == Valore.ACE and valori[1] == Valore.KING:
            return RisultatoMano(
                RangoMano.SCALA_REALE,
                tuple(valori),
                carte,
                "Scala Reale"
            )

        # Scala colore (inclusa A-bassa: A-2-3-4-5)
        if è_colore and (è_scala or è_scala_a_bassa):
            if è_scala_a_bassa:
                # In A-2-3-4-5 la carta alta per tiebreaker è il 5
                tb = (Valore.CINQUE,)
            else:
                tb = (valori[0],)
            return RisultatoMano(
                RangoMano.SCALA_COLORE,
                tb,
                carte,
                f"Scala Colore ({tb[0].simbolo()} alta)"
            )

        # Poker
        if frequenze[0] == 4:
            quattro = val_ordinati[0]
            kicker  = val_ordinati[1]
            return RisultatoMano(
                RangoMano.POKER_MANO,
                (quattro, kicker),
                carte,
                f"Poker di {quattro.simbolo()}"
            )

        # Full house
        if frequenze[0] == 3 and frequenze[1] == 2:
            tris   = val_ordinati[0]
            coppia = val_ordinati[1]
            return RisultatoMano(
                RangoMano.FULL,
                (tris, coppia),
                carte,
                f"Full {tris.simbolo()} su {coppia.simbolo()}"
            )

        # Colore
        if è_colore:
            return RisultatoMano(
                RangoMano.COLORE,
                tuple(valori),
                carte,
                f"Colore {semi[0].value} ({valori[0].simbolo()} alta)"
            )

        # Scala (inclusa A-bassa)
        if è_scala or è_scala_a_bassa:
            if è_scala_a_bassa:
                tb = (Valore.CINQUE,)
            else:
                tb = (valori[0],)
            return RisultatoMano(
                RangoMano.SCALA,
                tb,
                carte,
                f"Scala ({tb[0].simbolo()} alta)"
            )

        # Tris
        if frequenze[0] == 3:
            tris    = val_ordinati[0]
            kickers = val_ordinati[1:]
            return RisultatoMano(
                RangoMano.TRIS,
                (tris, *kickers),
                carte,
                f"Tris di {tris.simbolo()}"
            )

        # Doppia coppia
        if frequenze[0] == 2 and frequenze[1] == 2:
            coppia_alta = val_ordinati[0]
            coppia_bassa = val_ordinati[1]
            kicker = val_ordinati[2]
            return RisultatoMano(
                RangoMano.DOPPIA_COPPIA,
                (coppia_alta, coppia_bassa, kicker),
                carte,
                f"Doppia Coppia {coppia_alta.simbolo()}-{coppia_bassa.simbolo()}"
            )

        # Coppia
        if frequenze[0] == 2:
            coppia  = val_ordinati[0]
            kickers = val_ordinati[1:]
            return RisultatoMano(
                RangoMano.COPPIA,
                (coppia, *kickers),
                carte,
                f"Coppia di {coppia.simbolo()}"
            )

        # Carta alta
        return RisultatoMano(
            RangoMano.CARTA_ALTA,
            tuple(valori),
            carte,
            f"Carta alta {valori[0].simbolo()}"
        )

    @staticmethod
    def _controlla_scala(valori_desc: list[Valore]) -> bool:
        """Verifica scala con valori già ordinati discendente."""
        for i in range(4):
            if valori_desc[i].value - valori_desc[i+1].value != 1:
                return False
        return True

    @staticmethod
    def _controlla_scala_asso_basso(valori_desc: list[Valore]) -> bool:
        """Verifica la scala speciale A-2-3-4-5 (ruota)."""
        return set(v.value for v in valori_desc) == {14, 2, 3, 4, 5}


# ─────────────────────────────────────────────
# STATO DEL GIOCO
# ─────────────────────────────────────────────

class FaseGioco(Enum):
    IN_ATTESA   = "in_attesa"    # prima che inizi la mano
    PREFLOP     = "preflop"
    FLOP        = "flop"
    TURN        = "turn"
    RIVER       = "river"
    SHOWDOWN    = "showdown"
    FINE_MANO   = "fine_mano"


class StatoSeat(Enum):
    ATTIVO      = "attivo"       # ancora in gioco
    FOLD        = "fold"
    ALL_IN      = "all_in"
    SEDUTO_OUT  = "seduto_out"   # assente temporaneamente
    VUOTO       = "vuoto"


class AzioneGioco(Enum):
    FOLD    = "fold"
    CHECK   = "check"
    CALL    = "call"
    RAISE   = "raise"
    ALL_IN  = "all_in"


@dataclass
class PiattoParziale:
    """Rappresenta un piatto secondario per gli all-in."""
    importo: int
    giocatori_idonei: set[str]   # player_id dei giocatori che possono vincerlo


@dataclass
class Seat:
    player_id: str
    nome: str
    stack: int
    stato: StatoSeat = StatoSeat.ATTIVO
    carte: list[Carta] = field(default_factory=list)
    puntata_corrente: int = 0    # quanto ha puntato nel giro corrente
    puntata_totale_mano: int = 0 # quanto ha puntato in tutta la mano (per calcolo side-pot)
    è_dealer: bool = False
    è_small_blind: bool = False
    è_big_blind: bool = False

    def può_agire(self) -> bool:
        return self.stato == StatoSeat.ATTIVO

    def ha_carte(self) -> bool:
        return self.stato in (StatoSeat.ATTIVO, StatoSeat.ALL_IN)


# ─────────────────────────────────────────────
# GIOCO PRINCIPALE
# ─────────────────────────────────────────────

class GiocoPoker:
    """
    State machine del Texas Hold'em No-Limit.

    Utilizzo tipico:
        g = GiocoPoker(small_blind=10, big_blind=20)
        g.aggiungi_giocatore("p1", "Alice", 1000)
        g.aggiungi_giocatore("p2", "Bob",   1000)
        g.inizia_mano()
        while g.fase != FaseGioco.FINE_MANO:
            stato = g.get_stato_per(g.turno_attivo)
            g.applica_azione(g.turno_attivo, AzioneGioco.CALL)
    """

    def __init__(self, small_blind: int = 10, big_blind: int = 20):
        self.small_blind  = small_blind
        self.big_blind    = big_blind
        self.seats: dict[str, Seat] = {}       # player_id → Seat
        self.ordine: list[str] = []             # ordine dei giocatori al tavolo
        self.fase: FaseGioco = FaseGioco.IN_ATTESA
        self.mazzo: Optional[Mazzo] = None
        self.board: list[Carta] = []            # carte comuni
        self.piatto: int = 0
        self.piatti_parziali: list[PiattoParziale] = []
        self.dealer_idx: int = 0               # indice in self.ordine
        self.turno_attivo: Optional[str] = None
        self.puntata_max_corrente: int = 0     # la puntata più alta nel giro
        self.da_agire: set[str] = set()        # giocatori che devono ancora agire nel giro corrente
        self.num_mano: int = 0
        self.log: list[str] = []               # log degli eventi
        self.risultato_mano: Optional[dict] = None

    # ── Gestione giocatori ──────────────────────────────────────

    def aggiungi_giocatore(self, player_id: str, nome: str, stack: int) -> bool:
        """Aggiunge un giocatore al tavolo. Restituisce True se riuscito."""
        if player_id in self.seats:
            return False
        # Permetti di unirsi anche tra una mano e l'altra (FINE_MANO)
        if self.fase not in (FaseGioco.IN_ATTESA, FaseGioco.FINE_MANO):
            return False
        # Tra mani il giocatore attende la prossima (sit-out fino a inizia_mano)
        stato_iniziale = StatoSeat.SEDUTO_OUT if self.fase == FaseGioco.FINE_MANO else StatoSeat.ATTIVO
        self.seats[player_id] = Seat(player_id=player_id, nome=nome, stack=stack, stato=stato_iniziale)
        self.ordine.append(player_id)
        return True

    def rimuovi_giocatore(self, player_id: str) -> bool:
        """Rimuove un giocatore (solo tra una mano e l'altra)."""
        if self.fase not in (FaseGioco.IN_ATTESA, FaseGioco.FINE_MANO):
            return False
        if player_id not in self.seats:
            return False
        del self.seats[player_id]
        self.ordine.remove(player_id)
        # Se rimane 0 o 1 giocatore, resetta allo stato iniziale:
        # - 0 giocatori: tavolo vuoto
        # - 1 giocatore: non abbastanza per giocare → il nuovo arrivato deve entrare
        #   come ATTIVO (non SEDUTO_OUT), altrimenti la partita non parte mai
        if len(self.ordine) <= 1:
            self.fase = FaseGioco.IN_ATTESA
            self.board = []
            self.piatto = 0
            self.piatti_parziali = []
            self.turno_attivo = None
            self.da_agire = set()
            self.mazzo = None
            # Anche il giocatore rimasto (se c'è) si azzera lo stato
            # per essere pronto per la prossima mano
            for seat in self.seats.values():
                seat.carte = []
                seat.puntata_corrente = 0
                seat.puntata_totale_mano = 0
                seat.stato = StatoSeat.ATTIVO if seat.stack > 0 else StatoSeat.SEDUTO_OUT
                seat.è_dealer = False
                seat.è_small_blind = False
                seat.è_big_blind = False
        return True

    def sit_out_player(self, player_id: str):
        """
        Mette un giocatore in sitting-out mid-hand.
        Se è il suo turno → fold automatico.
        Se la mano non è in corso → setta SEDUTO_OUT.
        """
        if player_id not in self.seats:
            return
        seat = self.seats[player_id]
        if self.fase in (FaseGioco.PREFLOP, FaseGioco.FLOP, FaseGioco.TURN, FaseGioco.RIVER):
            if self.turno_attivo == player_id and seat.può_agire():
                # Fold automatico
                seat.stato = StatoSeat.FOLD
                self.da_agire.discard(player_id)
                self.log.append(f"{seat.nome}: FOLD (disconnesso)")
                self._prossimo_turno()
            elif seat.stato == StatoSeat.ATTIVO:
                seat.stato = StatoSeat.SEDUTO_OUT
                self.da_agire.discard(player_id)
        else:
            seat.stato = StatoSeat.SEDUTO_OUT

    def players_active_count(self) -> int:
        """Numero di giocatori con stack > 0 (non seduto_out, non vuoto)."""
        return sum(
            1 for s in self.seats.values()
            if s.stato not in (StatoSeat.SEDUTO_OUT, StatoSeat.VUOTO) and s.stack > 0
        )

    def hand_in_progress(self) -> bool:
        """True se c'è una mano in corso."""
        return self.fase not in (FaseGioco.IN_ATTESA, FaseGioco.FINE_MANO)

    def hole_cards_for(self, player_id: str) -> list[str]:
        """Restituisce le hole cards del giocatore come lista di stringhe."""
        if player_id not in self.seats:
            return []
        return [str(c) for c in self.seats[player_id].carte]

    @property
    def vincite_mano(self) -> dict[str, int]:
        """
        Dopo FINE_MANO: restituisce {player_id: importo_vinto} solo per i vincitori.
        Calcolato dal log (forma: "Nome vince NNN").
        Usato dal GameManager per aggiornare il DB.
        Nota: il valore accurato è nei log; per il DB usiamo get_public_state()
        che include gli stack aggiornati nei seats.
        """
        # Ricostruiamo dal log le vincite — pattern "Nome vince N"
        import re
        result: dict[str, int] = {}
        nome_to_pid = {s.nome: pid for pid, s in self.seats.items()}
        for riga in self.log:
            m = re.match(r"^(.+) vince (\d+)", riga)
            if m:
                nome, importo = m.group(1), int(m.group(2))
                pid = nome_to_pid.get(nome)
                if pid:
                    result[pid] = result.get(pid, 0) + importo
        return result

    def può_iniziare(self) -> bool:
        """Almeno 2 giocatori con stack > 0."""
        attivi = [p for p in self.ordine if self.seats[p].stack > 0]
        return len(attivi) >= 2

    # ── Avvio mano ──────────────────────────────────────────────

    def inizia_mano(self) -> bool:
        """Inizializza una nuova mano."""
        if not self.può_iniziare():
            return False

        self.num_mano += 1
        self.log.clear()
        self.log.append(f"=== Mano #{self.num_mano} ===")

        # Reset stato seats
        for seat in self.seats.values():
            seat.stato = StatoSeat.ATTIVO if seat.stack > 0 else StatoSeat.SEDUTO_OUT
            seat.carte = []
            seat.puntata_corrente = 0
            seat.puntata_totale_mano = 0
            seat.è_dealer = False
            seat.è_small_blind = False
            seat.è_big_blind = False

        # Giocatori attivi in ordine
        attivi = [pid for pid in self.ordine if self.seats[pid].stato == StatoSeat.ATTIVO]

        # Avanza dealer
        self.dealer_idx = (self.dealer_idx + 1) % len(attivi)
        dealer_pid = attivi[self.dealer_idx]
        self.seats[dealer_pid].è_dealer = True

        # Posizioni blind
        n = len(attivi)
        if n == 2:
            # Heads-up: dealer = SB
            sb_pid = attivi[self.dealer_idx]
            bb_pid = attivi[(self.dealer_idx + 1) % n]
        else:
            sb_pid = attivi[(self.dealer_idx + 1) % n]
            bb_pid = attivi[(self.dealer_idx + 2) % n]

        self.seats[sb_pid].è_small_blind = True
        self.seats[bb_pid].è_big_blind   = True

        # Reset piatto
        self.piatto = 0
        self.piatti_parziali = []
        self.board = []

        # Mazzo e distribuzione
        self.mazzo = Mazzo()
        for pid in attivi:
            self.seats[pid].carte = self.mazzo.deal(2)

        # Riscuoti blind
        self._forza_puntata(sb_pid, self.small_blind)
        self._forza_puntata(bb_pid, self.big_blind)
        self.puntata_max_corrente = self.big_blind

        # Fase preflop
        self.fase = FaseGioco.PREFLOP

        # Tutti i giocatori attivi devono agire, BB inclusa (ha l'opzione)
        self.da_agire = set(pid for pid in attivi if self.seats[pid].stato == StatoSeat.ATTIVO)

        # Primo a parlare preflop: UTG (dopo BB)
        if n == 2:
            primo = sb_pid  # in heads-up il dealer/SB agisce per primo preflop
        else:
            primo = attivi[(self.dealer_idx + 3) % n]
        self.turno_attivo = primo

        self.log.append(f"Dealer: {self.seats[dealer_pid].nome}")
        self.log.append(f"SB: {self.seats[sb_pid].nome} ({self.small_blind})")
        self.log.append(f"BB: {self.seats[bb_pid].nome} ({self.big_blind})")
        return True

    # ── Azioni ──────────────────────────────────────────────────

    def azioni_valide(self, player_id: str) -> list[dict]:
        """Restituisce le azioni valide con i relativi importi."""
        if player_id != self.turno_attivo:
            return []
        seat = self.seats[player_id]
        if not seat.può_agire():
            return []

        azioni = []
        da_chiamare = self.puntata_max_corrente - seat.puntata_corrente
        da_chiamare = min(da_chiamare, seat.stack)

        # FOLD sempre disponibile (tranne se si può checkare gratis)
        azioni.append({"azione": AzioneGioco.FOLD, "importo": 0})

        if da_chiamare == 0:
            # CHECK disponibile
            azioni.append({"azione": AzioneGioco.CHECK, "importo": 0})
        else:
            if seat.stack <= da_chiamare:
                # Solo all-in
                azioni.append({"azione": AzioneGioco.ALL_IN, "importo": seat.stack})
            else:
                azioni.append({"azione": AzioneGioco.CALL, "importo": da_chiamare})

        # RAISE disponibile se si ha abbastanza stack
        importo_min_raise = self.puntata_max_corrente + self.big_blind
        chips_necessarie_raise = importo_min_raise - seat.puntata_corrente
        if seat.stack > da_chiamare and seat.stack >= chips_necessarie_raise:
            azioni.append({
                "azione": AzioneGioco.RAISE,
                "importo_min": chips_necessarie_raise,
                "importo_max": seat.stack,
            })

        # ALL_IN sempre come opzione separata se si hanno chips
        if seat.stack > 0 and not any(a["azione"] == AzioneGioco.ALL_IN for a in azioni):
            azioni.append({"azione": AzioneGioco.ALL_IN, "importo": seat.stack})

        return azioni

    def applica_azione(self, player_id: str, azione: AzioneGioco,
                       importo: int = 0) -> bool:
        """
        Applica un'azione del giocatore.
        Per RAISE, importo = numero di chips AGGIUNTIVE rispetto alla puntata corrente.
        Restituisce True se l'azione è stata accettata.
        """
        if player_id != self.turno_attivo:
            return False
        seat = self.seats[player_id]
        if not seat.può_agire():
            return False
        if self.fase in (FaseGioco.IN_ATTESA, FaseGioco.SHOWDOWN, FaseGioco.FINE_MANO):
            return False

        da_chiamare = self.puntata_max_corrente - seat.puntata_corrente

        if azione == AzioneGioco.FOLD:
            seat.stato = StatoSeat.FOLD
            self.da_agire.discard(player_id)
            self.log.append(f"{seat.nome}: FOLD")

        elif azione == AzioneGioco.CHECK:
            if da_chiamare != 0:
                return False
            self.da_agire.discard(player_id)
            self.log.append(f"{seat.nome}: CHECK")

        elif azione == AzioneGioco.CALL:
            chips = min(da_chiamare, seat.stack)
            if chips <= 0:
                return False
            self._punta(player_id, chips)
            self.da_agire.discard(player_id)
            if seat.stack == 0:
                seat.stato = StatoSeat.ALL_IN
                self.log.append(f"{seat.nome}: CALL {chips} (ALL-IN)")
            else:
                self.log.append(f"{seat.nome}: CALL {chips}")

        elif azione == AzioneGioco.RAISE:
            # importo = chips totali da aggiungere (>= min raise)
            totale_da_aggiungere = importo
            nuova_puntata_totale = seat.puntata_corrente + totale_da_aggiungere
            if nuova_puntata_totale <= self.puntata_max_corrente:
                return False
            if totale_da_aggiungere > seat.stack:
                return False
            self._punta(player_id, totale_da_aggiungere)
            self.puntata_max_corrente = seat.puntata_corrente
            # Dopo un raise, tutti gli altri giocatori attivi devono agire di nuovo
            self.da_agire = set(
                pid for pid in self.ordine
                if self.seats[pid].stato == StatoSeat.ATTIVO and pid != player_id
            )
            if seat.stack == 0:
                seat.stato = StatoSeat.ALL_IN
                self.da_agire.discard(player_id)
                self.log.append(f"{seat.nome}: RAISE a {seat.puntata_corrente} (ALL-IN)")
            else:
                self.log.append(f"{seat.nome}: RAISE a {seat.puntata_corrente}")

        elif azione == AzioneGioco.ALL_IN:
            chips = seat.stack
            if chips <= 0:
                return False
            self._punta(player_id, chips)
            era_raise = seat.puntata_corrente > self.puntata_max_corrente
            if era_raise:
                self.puntata_max_corrente = seat.puntata_corrente
                # Re-apre l'azione per tutti gli altri
                self.da_agire = set(
                    pid for pid in self.ordine
                    if self.seats[pid].stato == StatoSeat.ATTIVO and pid != player_id
                )
            else:
                self.da_agire.discard(player_id)
            seat.stato = StatoSeat.ALL_IN
            self.log.append(f"{seat.nome}: ALL-IN ({seat.puntata_corrente})")

        else:
            return False

        # Avanza il turno
        self._prossimo_turno()
        return True

    # ── Stato pubblico e privato ─────────────────────────────────

    def get_stato_per(self, player_id: str) -> dict:
        """Stato completo visibile dal giocatore player_id (include sue carte)."""
        stato = self.get_stato_pubblico()
        if player_id in self.seats:
            seat = self.seats[player_id]
            stato["mia_mano"] = [str(c) for c in seat.carte]
            stato["mio_stack"] = seat.stack
            stato["mia_puntata_corrente"] = seat.puntata_corrente
            stato["sono_di_turno"] = self.turno_attivo == player_id
            stato["azioni_valide"] = [
                {**a, "azione": a["azione"].value}
                for a in self.azioni_valide(player_id)
            ]
        return stato

    def get_stato_pubblico(self) -> dict:
        """Stato visibile a tutti (senza carte private)."""
        giocatori = []
        for pid in self.ordine:
            s = self.seats[pid]
            giocatori.append({
                "player_id": pid,
                "nome": s.nome,
                "stack": s.stack,
                "stato": s.stato.value,
                "puntata_corrente": s.puntata_corrente,
                "è_dealer": s.è_dealer,
                "è_small_blind": s.è_small_blind,
                "è_big_blind": s.è_big_blind,
            })
        return {
            "fase": self.fase.value,
            "board": [str(c) for c in self.board],
            "piatto": self.piatto,
            "piatti_parziali": [
                {"importo": pp.importo, "idonei": list(pp.giocatori_idonei)}
                for pp in self.piatti_parziali
            ],
            "puntata_max": self.puntata_max_corrente,
            "turno_attivo": self.turno_attivo,
            "num_mano": self.num_mano,
            "giocatori": giocatori,
        }

    # ── Metodi interni ───────────────────────────────────────────

    def _forza_puntata(self, player_id: str, importo: int):
        """Riscuote un blind forzato."""
        seat = self.seats[player_id]
        effettivo = min(importo, seat.stack)
        seat.stack -= effettivo
        seat.puntata_corrente += effettivo
        seat.puntata_totale_mano += effettivo
        self.piatto += effettivo
        if seat.stack == 0:
            seat.stato = StatoSeat.ALL_IN

    def _punta(self, player_id: str, importo: int):
        """Aggiunge chips al piatto."""
        seat = self.seats[player_id]
        effettivo = min(importo, seat.stack)
        seat.stack -= effettivo
        seat.puntata_corrente += effettivo
        seat.puntata_totale_mano += effettivo
        self.piatto += effettivo

    def _giocatori_attivi_in_ordine(self) -> list[str]:
        """Giocatori che non hanno fatto fold, in ordine dal dealer."""
        return [
            pid for pid in self.ordine
            if self.seats[pid].stato in (StatoSeat.ATTIVO, StatoSeat.ALL_IN)
        ]

    def _giocatori_che_possono_agire(self) -> list[str]:
        return [
            pid for pid in self.ordine
            if self.seats[pid].stato == StatoSeat.ATTIVO
        ]

    def _giro_terminato(self) -> bool:
        """
        Il giro è terminato quando da_agire è vuoto o nessuno può agire.
        da_agire viene gestito in applica_azione: ogni azione rimuove il giocatore,
        un raise lo re-popola con tutti gli altri attivi.
        """
        can_act = self._giocatori_che_possono_agire()
        if len(can_act) == 0:
            return True
        # Rimuovi da da_agire eventuali giocatori che nel frattempo hanno fatto fold/all-in
        self.da_agire = {pid for pid in self.da_agire if self.seats[pid].stato == StatoSeat.ATTIVO}
        return len(self.da_agire) == 0

    def _prossimo_turno(self):
        """Calcola chi gioca dopo, o avanza alla fase successiva."""
        # Se un solo giocatore ha non-fold, vince automaticamente
        non_fold = [
            pid for pid in self.ordine
            if self.seats[pid].stato in (StatoSeat.ATTIVO, StatoSeat.ALL_IN)
        ]
        if len(non_fold) == 1:
            self._assegna_piatto_vincitore_unico(non_fold[0])
            return

        if self._giro_terminato():
            self._avanza_fase()
            return

        # Trova il prossimo in da_agire, rispettando l'ordine del tavolo
        idx_corrente = self.ordine.index(self.turno_attivo)
        n = len(self.ordine)
        for i in range(1, n + 1):
            candidato = self.ordine[(idx_corrente + i) % n]
            if candidato in self.da_agire and self.seats[candidato].stato == StatoSeat.ATTIVO:
                self.turno_attivo = candidato
                return

        # Nessuno in da_agire: fine giro
        self._avanza_fase()

    def _avanza_fase(self):
        """Passa alla fase successiva (flop → turn → river → showdown)."""
        # Reset puntate del giro
        for seat in self.seats.values():
            seat.puntata_corrente = 0
        self.puntata_max_corrente = 0
        # Tutti i giocatori attivi devono agire nel nuovo giro
        self.da_agire = set(self._giocatori_che_possono_agire())

        if self.fase == FaseGioco.PREFLOP:
            self.fase = FaseGioco.FLOP
            self.board += self.mazzo.deal(3)
            self.log.append(f"FLOP: {' '.join(str(c) for c in self.board)}")

        elif self.fase == FaseGioco.FLOP:
            self.fase = FaseGioco.TURN
            self.board += self.mazzo.deal(1)
            self.log.append(f"TURN: {self.board[-1]}")

        elif self.fase == FaseGioco.TURN:
            self.fase = FaseGioco.RIVER
            self.board += self.mazzo.deal(1)
            self.log.append(f"RIVER: {self.board[-1]}")

        elif self.fase == FaseGioco.RIVER:
            self._showdown()
            return

        elif self.fase == FaseGioco.SHOWDOWN:
            return

        # Primo a parlare nei giri post-flop: il primo giocatore attivo a sinistra del dealer
        can_act = self._giocatori_che_possono_agire()
        if len(can_act) == 0:
            # Tutti all-in: non ricorrere — ws_router rivela le carte una street alla volta con delay
            self.turno_attivo = None
            return

        # Trova primo attivo dopo il dealer
        dealer_pid = next(
            (pid for pid in self.ordine if self.seats[pid].è_dealer), self.ordine[0]
        )
        dealer_idx = self.ordine.index(dealer_pid)
        n = len(self.ordine)
        for i in range(1, n + 1):
            candidato = self.ordine[(dealer_idx + i) % n]
            if self.seats[candidato].stato == StatoSeat.ATTIVO:
                self.turno_attivo = candidato
                return

    def _assegna_piatto_vincitore_unico(self, winner_id: str):
        """Un solo giocatore rimasto: vince tutto il piatto."""
        vincitore = self.seats[winner_id]
        vincitore.stack += self.piatto
        self.log.append(f"{vincitore.nome} vince {self.piatto} (tutti hanno foldato)")
        self.piatto = 0
        self.fase = FaseGioco.FINE_MANO
        self.turno_attivo = None

    def _showdown(self):
        """Showdown: valuta le mani e distribuisce i piatti."""
        self.fase = FaseGioco.SHOWDOWN
        self.log.append("=== SHOWDOWN ===")

        # Giocatori che arrivano allo showdown (non fold)
        candidati = [
            pid for pid in self.ordine
            if self.seats[pid].stato in (StatoSeat.ATTIVO, StatoSeat.ALL_IN)
        ]

        # Mostra le carte
        for pid in candidati:
            seat = self.seats[pid]
            carte_str = ' '.join(str(c) for c in seat.carte)
            self.log.append(f"{seat.nome}: {carte_str}")

        # Calcola i piatti (side pots)
        vincite = self._calcola_side_pots(candidati)

        # Distribuzione
        for pid, importo in vincite.items():
            self.seats[pid].stack += importo
            if importo > 0:
                self.log.append(f"{self.seats[pid].nome} vince {importo}")

        self.piatto = 0
        self.fase = FaseGioco.FINE_MANO
        self.turno_attivo = None

    def _calcola_side_pots(self, candidati: list[str]) -> dict[str, int]:
        """
        Calcola e distribuisce i piatti considerando gli all-in.
        Restituisce un dizionario {player_id: importo_vinto}.
        """
        vincite: dict[str, int] = defaultdict(int)

        # Contributi totali di ogni giocatore in questa mano
        tutti_i_giocatori = [pid for pid in self.ordine if self.seats[pid].puntata_totale_mano > 0]
        contributi = {pid: self.seats[pid].puntata_totale_mano for pid in tutti_i_giocatori}

        # Ordina i candidati (all-in) per contributo totale crescente
        livelli_all_in = sorted(
            set(contributi[pid] for pid in candidati),
        )

        piatto_residuo = self.piatto
        già_prelevato = {pid: 0 for pid in tutti_i_giocatori}

        for livello in livelli_all_in:
            # Quanto ogni giocatore contribuisce a questo sotto-piatto
            sotto_piatto = 0
            idonei = []
            for pid in candidati:
                contributo_livello = min(contributi[pid], livello) - già_prelevato.get(pid, 0)
                contributo_livello = max(0, contributo_livello)
                # Aggiungi anche i contributi dei giocatori fold fino a questo livello
                for fid in tutti_i_giocatori:
                    if fid not in [pid for pid in candidati]:
                        pass

            # Ricalcola il sotto-piatto per questo livello
            sotto_piatto = 0
            for pid in tutti_i_giocatori:
                quota = min(contributi[pid], livello) - già_prelevato.get(pid, 0)
                quota = max(0, quota)
                sotto_piatto += quota
                già_prelevato[pid] = min(contributi[pid], livello)

            # Chi è idoneo a vincere questo sotto-piatto (candidati con contributo >= livello)
            idonei = [pid for pid in candidati if contributi[pid] >= livello]

            if sotto_piatto <= 0 or not idonei:
                continue

            # Valuta le mani degli idonei
            migliore_mano = None
            vincitori_livello = []
            for pid in idonei:
                seat = self.seats[pid]
                sette_carte = seat.carte + self.board
                mano = ValutatoreRisultato.valuta(sette_carte)
                self.log.append(f"  {seat.nome}: {mano.descrizione}")
                if migliore_mano is None or mano > migliore_mano:
                    migliore_mano = mano
                    vincitori_livello = [pid]
                elif mano == migliore_mano:
                    vincitori_livello.append(pid)

            # Distribuisci il sotto-piatto equamente tra i vincitori
            quota_per_vincitore = sotto_piatto // len(vincitori_livello)
            resto = sotto_piatto % len(vincitori_livello)
            for pid in vincitori_livello:
                vincite[pid] += quota_per_vincitore
            # Il resto va al primo vincitore (regola standard)
            if resto > 0 and vincitori_livello:
                vincite[vincitori_livello[0]] += resto

            piatto_residuo -= sotto_piatto

        # Eventuali resti (arrotondamenti) al piatto principale
        if piatto_residuo > 0 and candidati:
            # Valuta chi ha la mano migliore tra tutti i candidati
            migliore_mano = None
            vincitori_finali = []
            for pid in candidati:
                seat = self.seats[pid]
                sette_carte = seat.carte + self.board
                mano = ValutatoreRisultato.valuta(sette_carte)
                if migliore_mano is None or mano > migliore_mano:
                    migliore_mano = mano
                    vincitori_finali = [pid]
                elif mano == migliore_mano:
                    vincitori_finali.append(pid)
            quota = piatto_residuo // len(vincitori_finali)
            for pid in vincitori_finali:
                vincite[pid] += quota

        return vincite


# ─────────────────────────────────────────────
# TEST RAPIDO
# ─────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("TEST MOTORE POKER - Texas Hold'em No-Limit")
    print("=" * 60)

    # ── Test 1: Valutazione mani ─────────────────────────────────
    print("\n--- Test valutazione mani ---")

    def crea_mano(descr: str) -> list[Carta]:
        """Helper: '♠A ♠K ♠Q ♠J ♠T' → lista di Carte."""
        parti = descr.strip().split()
        mappa_semi = {'♠': Seme.PICCHE, '♥': Seme.CUORI, '♦': Seme.QUADRI, '♣': Seme.FIORI}
        mappa_val  = {'2': Valore.DUE, '3': Valore.TRE, '4': Valore.QUATTRO,
                      '5': Valore.CINQUE, '6': Valore.SEI, '7': Valore.SETTE,
                      '8': Valore.OTTO, '9': Valore.NOVE, 'T': Valore.DIECI,
                      'J': Valore.JACK, 'Q': Valore.QUEEN, 'K': Valore.KING, 'A': Valore.ACE}
        carte = []
        for p in parti:
            seme  = mappa_semi[p[0]]
            valore = mappa_val[p[1:]]
            carte.append(Carta(valore, seme))
        return carte

    casi = [
        ("♠A ♠K ♠Q ♠J ♠T",           "Scala Reale"),
        ("♠9 ♠8 ♠7 ♠6 ♠5",           "Scala Colore"),
        ("♠A ♥A ♦A ♣A ♠K",           "Poker"),
        ("♠A ♥A ♦A ♣K ♠K",           "Full"),
        ("♠2 ♠5 ♠9 ♠J ♠A",           "Colore"),
        ("♠9 ♥8 ♦7 ♣6 ♠5",           "Scala"),
        ("♠A ♥2 ♣3 ♦4 ♠5",           "Scala A-bassa"),
        ("♠A ♥A ♦A ♣K ♠Q",           "Tris"),
        ("♠A ♥A ♦K ♣K ♠Q",           "Doppia Coppia"),
        ("♠A ♥A ♦K ♣Q ♠J",           "Coppia"),
        ("♠A ♥K ♦Q ♣J ♠9",           "Carta Alta"),
    ]

    for carte_str, atteso in casi:
        carte = crea_mano(carte_str)
        risultato = ValutatoreRisultato.valuta(carte)
        ok = "OK" if atteso in risultato.descrizione else "??"
        print(f"  {ok}  {carte_str:30s} -> {risultato.descrizione}")

    # ── Test 2: Partita 3 giocatori ──────────────────────────────
    print("\n--- Test partita 3 giocatori ---")

    gioco = GiocoPoker(small_blind=10, big_blind=20)
    gioco.aggiungi_giocatore("alice", "Alice", 500)
    gioco.aggiungi_giocatore("bob",   "Bob",   300)
    gioco.aggiungi_giocatore("carlo", "Carlo", 200)

    print(f"Può iniziare: {gioco.può_iniziare()}")
    gioco.inizia_mano()

    print(f"Fase: {gioco.fase.value}")
    print(f"Board: {gioco.board}")
    print(f"Piatto: {gioco.piatto}")
    print(f"Turno: {gioco.turno_attivo}")

    # Simula un giro completo: tutti chiamano / check fino alla fine
    max_iter = 50
    i = 0
    while gioco.fase not in (FaseGioco.FINE_MANO, FaseGioco.SHOWDOWN) and i < max_iter:
        pid = gioco.turno_attivo
        if pid is None:
            break
        azioni = gioco.azioni_valide(pid)
        if not azioni:
            break
        # Strategia semplice: chiama se possibile, altrimenti check, altrimenti fold
        az = None
        for a in azioni:
            if a["azione"] == AzioneGioco.CALL:
                az = (AzioneGioco.CALL, a["importo"])
                break
        if az is None:
            for a in azioni:
                if a["azione"] == AzioneGioco.CHECK:
                    az = (AzioneGioco.CHECK, 0)
                    break
        if az is None:
            az = (AzioneGioco.FOLD, 0)
        gioco.applica_azione(pid, az[0], az[1])
        i += 1

    print(f"\nFase finale: {gioco.fase.value}")
    print("\nLog mano:")
    for riga in gioco.log:
        print(f"  {riga}")

    print("\nStack finali:")
    for pid in gioco.ordine:
        s = gioco.seats[pid]
        print(f"  {s.nome}: {s.stack}")

    print("\nTest completato.")
