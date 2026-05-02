import unittest

from poker_engine import Carta, FaseGioco, GiocoPoker, Seme, StatoSeat, Valore


def card(valore: Valore, seme: Seme) -> Carta:
    return Carta(valore=valore, seme=seme)


class SplitPotTests(unittest.TestCase):
    def _setup_board_tie(self, game: GiocoPoker) -> None:
        game.board = [
            card(Valore.ACE, Seme.PICCHE),
            card(Valore.KING, Seme.CUORI),
            card(Valore.QUEEN, Seme.QUADRI),
            card(Valore.JACK, Seme.FIORI),
            card(Valore.DIECI, Seme.PICCHE),
        ]

    def test_split_pot_even_tie(self):
        game = GiocoPoker()
        game.aggiungi_giocatore("p1", "Alice", 0)
        game.aggiungi_giocatore("p2", "Bob", 0)
        game.fase = FaseGioco.RIVER

        self._setup_board_tie(game)
        game.seats["p1"].carte = [card(Valore.DUE, Seme.CUORI), card(Valore.TRE, Seme.FIORI)]
        game.seats["p2"].carte = [card(Valore.QUATTRO, Seme.CUORI), card(Valore.CINQUE, Seme.FIORI)]
        game.seats["p1"].stato = StatoSeat.ATTIVO
        game.seats["p2"].stato = StatoSeat.ATTIVO
        game.seats["p1"].puntata_totale_mano = 50
        game.seats["p2"].puntata_totale_mano = 50
        game.piatto = 100

        game._showdown()

        self.assertEqual(game.seats["p1"].stack, 50)
        self.assertEqual(game.seats["p2"].stack, 50)
        self.assertEqual(game.piatto, 0)
        self.assertEqual(game.fase, FaseGioco.FINE_MANO)

    def test_split_pot_odd_chip_goes_to_first_winner(self):
        game = GiocoPoker()
        game.aggiungi_giocatore("p1", "Alice", 0)
        game.aggiungi_giocatore("p2", "Bob", 0)
        game.aggiungi_giocatore("p3", "Carlo", 0)
        game.fase = FaseGioco.RIVER

        self._setup_board_tie(game)
        game.seats["p1"].carte = [card(Valore.DUE, Seme.CUORI), card(Valore.TRE, Seme.FIORI)]
        game.seats["p2"].carte = [card(Valore.QUATTRO, Seme.CUORI), card(Valore.CINQUE, Seme.FIORI)]
        game.seats["p3"].carte = [card(Valore.SETTE, Seme.CUORI), card(Valore.OTTO, Seme.FIORI)]
        game.seats["p1"].stato = StatoSeat.ATTIVO
        game.seats["p2"].stato = StatoSeat.ATTIVO
        game.seats["p3"].stato = StatoSeat.FOLD
        game.seats["p1"].puntata_totale_mano = 50
        game.seats["p2"].puntata_totale_mano = 50
        game.seats["p3"].puntata_totale_mano = 1
        game.piatto = 101

        game._showdown()

        self.assertEqual(game.seats["p1"].stack, 51)
        self.assertEqual(game.seats["p2"].stack, 50)
        self.assertEqual(game.seats["p3"].stack, 0)
        self.assertEqual(game.piatto, 0)


if __name__ == "__main__":
    unittest.main()
