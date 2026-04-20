-- =============================================================================
-- Migration 002 — poker_tables, table_seats, game_hands, hand_actions,
--                 sitgo_tournaments, sitgo_registrations
-- Esegui su Supabase: SQL Editor → incolla → Run
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. POKER TABLES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS poker_tables (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name        VARCHAR(50)  NOT NULL,
    table_type  VARCHAR(20)  NOT NULL,   -- 'cash' | 'sitgo'
    min_players INTEGER      NOT NULL,
    max_seats   INTEGER      NOT NULL,
    speed       VARCHAR(20)  NOT NULL DEFAULT 'normal',  -- 'slow'|'normal'|'fast'

    small_blind BIGINT       NOT NULL,
    big_blind   BIGINT       NOT NULL,
    min_buyin   BIGINT       NOT NULL,
    max_buyin   BIGINT,                  -- nullable: max per cash / starting per sitgo

    status      VARCHAR(20)  NOT NULL DEFAULT 'waiting', -- 'waiting'|'running'|'paused'|'closed'
    is_private  BOOLEAN      NOT NULL DEFAULT FALSE,

    created_by  UUID         NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT chk_table_type  CHECK (table_type IN ('cash', 'sitgo')),
    CONSTRAINT chk_speed       CHECK (speed       IN ('slow', 'normal', 'fast')),
    CONSTRAINT chk_status      CHECK (status      IN ('waiting', 'running', 'paused', 'closed')),
    CONSTRAINT chk_seats_range CHECK (max_seats BETWEEN 2 AND 9),
    CONSTRAINT chk_min_players CHECK (min_players BETWEEN 2 AND 9),
    CONSTRAINT chk_min_le_max  CHECK (min_players <= max_seats)
);

CREATE INDEX IF NOT EXISTS idx_poker_tables_status     ON poker_tables (status);
CREATE INDEX IF NOT EXISTS idx_poker_tables_table_type ON poker_tables (table_type);
CREATE INDEX IF NOT EXISTS idx_poker_tables_created_by ON poker_tables (created_by);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. TABLE SEATS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS table_seats (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    table_id    UUID    NOT NULL REFERENCES poker_tables(id) ON DELETE CASCADE,
    user_id     UUID    NOT NULL REFERENCES users(id),
    seat_number INTEGER NOT NULL,   -- 0-8
    stack       BIGINT  NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'active',  -- 'active'|'sitting_out'|'away'
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_table_seat    UNIQUE (table_id, seat_number),
    CONSTRAINT uq_table_user    UNIQUE (table_id, user_id),
    CONSTRAINT chk_seat_number  CHECK  (seat_number BETWEEN 0 AND 8),
    CONSTRAINT chk_seat_status  CHECK  (status IN ('active', 'sitting_out', 'away'))
);

CREATE INDEX IF NOT EXISTS idx_table_seats_table_id ON table_seats (table_id);
CREATE INDEX IF NOT EXISTS idx_table_seats_user_id  ON table_seats (user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. GAME HANDS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS game_hands (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    table_id                  UUID    NOT NULL REFERENCES poker_tables(id) ON DELETE CASCADE,
    hand_number               INTEGER NOT NULL,
    dealer_seat               INTEGER NOT NULL,
    small_blind_seat          INTEGER NOT NULL,
    big_blind_seat            INTEGER NOT NULL,
    community_cards           JSONB   NOT NULL DEFAULT '[]',   -- ["A♠","K♥","Q♦","J♣","T♠"]
    pot                       BIGINT  NOT NULL DEFAULT 0,
    winner_seat               INTEGER,
    winning_hand_description  VARCHAR(50),

    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_game_hands_table_id   ON game_hands (table_id);
CREATE INDEX IF NOT EXISTS idx_game_hands_started_at ON game_hands (started_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. HAND ACTIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hand_actions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    hand_id      UUID    NOT NULL REFERENCES game_hands(id) ON DELETE CASCADE,
    user_id      UUID    NOT NULL REFERENCES users(id),
    seat_number  INTEGER NOT NULL,
    phase        VARCHAR(20) NOT NULL,   -- 'preflop'|'flop'|'turn'|'river'
    action       VARCHAR(20) NOT NULL,   -- 'fold'|'check'|'call'|'raise'|'allin'
    amount       BIGINT  NOT NULL DEFAULT 0,
    stack_before BIGINT  NOT NULL,
    stack_after  BIGINT  NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_phase  CHECK (phase  IN ('preflop', 'flop', 'turn', 'river')),
    CONSTRAINT chk_action CHECK (action IN ('fold', 'check', 'call', 'raise', 'allin'))
);

CREATE INDEX IF NOT EXISTS idx_hand_actions_hand_id    ON hand_actions (hand_id);
CREATE INDEX IF NOT EXISTS idx_hand_actions_user_id    ON hand_actions (user_id);
CREATE INDEX IF NOT EXISTS idx_hand_actions_created_at ON hand_actions (created_at);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. SIT & GO TOURNAMENTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sitgo_tournaments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name                VARCHAR(100) NOT NULL,
    min_players         INTEGER      NOT NULL,
    max_seats           INTEGER      NOT NULL,
    starting_chips      BIGINT       NOT NULL,
    speed               VARCHAR(20)  NOT NULL DEFAULT 'normal',
    status              VARCHAR(20)  NOT NULL DEFAULT 'registering',

    -- lista di {level, small_blind, big_blind, duration_seconds}
    -- popolata dall'applicazione in base alla speed
    blind_schedule      JSONB        NOT NULL DEFAULT '[]',
    current_blind_level INTEGER      NOT NULL DEFAULT 1,
    level_started_at    TIMESTAMPTZ,

    -- tavolo fisico collegato (creato quando il torneo parte)
    table_id            UUID REFERENCES poker_tables(id),

    created_by          UUID         NOT NULL REFERENCES users(id),
    started_at          TIMESTAMPTZ,
    finished_at         TIMESTAMPTZ,

    CONSTRAINT chk_sitgo_speed   CHECK (speed   IN ('slow', 'normal', 'fast')),
    CONSTRAINT chk_sitgo_status  CHECK (status  IN ('registering', 'running', 'finished')),
    CONSTRAINT chk_sitgo_seats   CHECK (max_seats  BETWEEN 2 AND 9),
    CONSTRAINT chk_sitgo_players CHECK (min_players BETWEEN 2 AND 9),
    CONSTRAINT chk_sitgo_min_le  CHECK (min_players <= max_seats)
);

CREATE INDEX IF NOT EXISTS idx_sitgo_status     ON sitgo_tournaments (status);
CREATE INDEX IF NOT EXISTS idx_sitgo_created_by ON sitgo_tournaments (created_by);


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. SIT & GO REGISTRATIONS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sitgo_registrations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tournament_id   UUID    NOT NULL REFERENCES sitgo_tournaments(id) ON DELETE CASCADE,
    user_id         UUID    NOT NULL REFERENCES users(id),
    final_position  INTEGER,    -- 1 = vincitore; NULL = ancora in gioco / torneo non finito
    chips_at_end    BIGINT,
    registered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_sitgo_registration UNIQUE (tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_sitgo_reg_tournament ON sitgo_registrations (tournament_id);
CREATE INDEX IF NOT EXISTS idx_sitgo_reg_user       ON sitgo_registrations (user_id);


-- =============================================================================
-- Fine migration 002
-- =============================================================================
