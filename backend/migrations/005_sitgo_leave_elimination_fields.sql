-- =============================================================================
-- Migration 005 — Sit&Go leave/elimination tracking
-- =============================================================================

ALTER TABLE sitgo_registrations
    ADD COLUMN IF NOT EXISTS player_status VARCHAR(20) NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS elimination_reason VARCHAR(30),
    ADD COLUMN IF NOT EXISTS eliminated_at TIMESTAMPTZ;

ALTER TABLE sitgo_registrations
    DROP CONSTRAINT IF EXISTS chk_sitgo_registration_player_status,
    DROP CONSTRAINT IF EXISTS chk_sitgo_registration_elimination_reason;

ALTER TABLE sitgo_registrations
    ADD CONSTRAINT chk_sitgo_registration_player_status
        CHECK (player_status IN ('active', 'eliminated', 'left')),
    ADD CONSTRAINT chk_sitgo_registration_elimination_reason
        CHECK (elimination_reason IS NULL OR elimination_reason IN ('busted', 'left', 'disconnect_timeout'));

UPDATE sitgo_registrations
SET player_status = CASE
    WHEN final_position IS NULL THEN 'active'
    ELSE 'eliminated'
END
WHERE player_status IS NULL OR player_status NOT IN ('active', 'eliminated', 'left');

UPDATE sitgo_registrations
SET eliminated_at = COALESCE(eliminated_at, payout_awarded_at, refunded_at, registered_at)
WHERE final_position IS NOT NULL
  AND eliminated_at IS NULL;
