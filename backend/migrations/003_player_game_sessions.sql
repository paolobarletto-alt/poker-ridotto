-- =============================================================================
-- Migration 003 — player_game_sessions
-- Traccia ogni sessione di gioco: ogni volta che un utente si siede a un tavolo
-- =============================================================================

CREATE TABLE IF NOT EXISTS player_game_sessions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID        NOT NULL REFERENCES users(id),
    table_id         UUID        NOT NULL REFERENCES poker_tables(id) ON DELETE CASCADE,
    table_name       VARCHAR(50) NOT NULL,
    table_type       VARCHAR(20) NOT NULL,
    seat_number      INTEGER     NOT NULL,
    total_buyin      BIGINT      NOT NULL DEFAULT 0,
    current_stack    BIGINT      NOT NULL DEFAULT 0,
    cashout          BIGINT,
    result_chips     BIGINT      NOT NULL DEFAULT 0,
    hands_played     INTEGER     NOT NULL DEFAULT 0,
    status           VARCHAR(20) NOT NULL DEFAULT 'open',
    close_reason     VARCHAR(30),
    started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at         TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_pgs_table_type CHECK (table_type IN ('cash', 'sitgo')),
    CONSTRAINT chk_pgs_status CHECK (status IN ('open', 'closed'))
);

CREATE INDEX IF NOT EXISTS idx_pgs_user_started
    ON player_game_sessions (user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_pgs_table_status
    ON player_game_sessions (table_id, status);

CREATE INDEX IF NOT EXISTS idx_pgs_started_at
    ON player_game_sessions (started_at DESC);
