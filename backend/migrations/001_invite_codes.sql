-- Migration 001: invite codes + is_admin column
-- Run against your Supabase / PostgreSQL database.
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS guards).

-- 1. Add is_admin to users
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Create invite_codes table
CREATE TABLE IF NOT EXISTS invite_codes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(12)  NOT NULL UNIQUE,
    created_by  UUID         NOT NULL REFERENCES users(id),
    used_by     UUID         REFERENCES users(id),
    used_at     TIMESTAMPTZ,
    expires_at  TIMESTAMPTZ,
    max_uses    INTEGER      NOT NULL DEFAULT 1,
    use_count   INTEGER      NOT NULL DEFAULT 0,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_invite_codes_code ON invite_codes (code);

-- 3. (Optional) Promote the first user to admin so you can call POST /admin/invites
-- Replace 'your@email.com' with your actual email before running.
-- UPDATE users SET is_admin = TRUE WHERE email = 'your@email.com';
