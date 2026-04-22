-- =============================================================================
-- Migration 004 — Sit&Go payout, buy-in tracking e limiti 2..8
-- =============================================================================

ALTER TABLE sitgo_tournaments
    ADD COLUMN IF NOT EXISTS buy_in BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS prize_pool BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS payout_structure JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS payout_awarded BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE sitgo_tournaments
    ALTER COLUMN status SET DEFAULT 'waiting';

ALTER TABLE sitgo_tournaments
    DROP CONSTRAINT IF EXISTS chk_sitgo_status,
    DROP CONSTRAINT IF EXISTS chk_sitgo_seats,
    DROP CONSTRAINT IF EXISTS chk_sitgo_players;

ALTER TABLE sitgo_tournaments
    ADD CONSTRAINT chk_sitgo_status CHECK (status IN ('waiting', 'running', 'finished')),
    ADD CONSTRAINT chk_sitgo_seats CHECK (max_seats BETWEEN 2 AND 8),
    ADD CONSTRAINT chk_sitgo_players CHECK (min_players BETWEEN 2 AND 8);

UPDATE sitgo_tournaments
SET status = 'waiting'
WHERE status = 'registering';

ALTER TABLE sitgo_registrations
    ADD COLUMN IF NOT EXISTS buy_in_amount BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS payout_awarded BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS payout_awarded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

