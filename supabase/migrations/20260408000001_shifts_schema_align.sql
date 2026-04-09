-- ============================================================
-- Align shifts table to Phase 2 spec
-- ============================================================
-- The original schema used marketplace semantics (open→claimed→confirmed).
-- Phase 2 uses coordinator-assigned semantics (scheduled→in_progress→completed).
-- This migration renames columns, adds missing columns, updates the status enum,
-- tightens RLS to coordinator-only writes, and adds a GiST exclusion constraint
-- to prevent double-booking at the database level.
-- ============================================================

-- ── 1. Column renames ─────────────────────────────────────────────────────────
ALTER TABLE shifts RENAME COLUMN assigned_to  TO assignee_user_id;
ALTER TABLE shifts RENAME COLUMN starts_at    TO start_at;
ALTER TABLE shifts RENAME COLUMN ends_at      TO end_at;

-- ── 2. New columns ────────────────────────────────────────────────────────────
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS notes text CHECK (char_length(notes) <= 2000);

-- ── 3. Extend shift_status enum with Phase 2 values ──────────────────────────
-- Existing values (open, claimed, confirmed, missed) are retained but unused
-- by Phase 2 flows. New values are added non-destructively.
ALTER TYPE shift_status ADD VALUE IF NOT EXISTS 'scheduled';
ALTER TYPE shift_status ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE shift_status ADD VALUE IF NOT EXISTS 'cancelled';

-- Change default to 'scheduled' for coordinator-assigned shifts
ALTER TABLE shifts ALTER COLUMN status SET DEFAULT 'scheduled';

-- ── 4. Update indexes to use renamed columns ──────────────────────────────────
DROP INDEX IF EXISTS idx_shifts_recipient_time;
DROP INDEX IF EXISTS idx_shifts_status;

CREATE INDEX idx_shifts_recipient_time ON shifts (recipient_id, start_at);
CREATE INDEX idx_shifts_status         ON shifts (status, start_at)
  WHERE status IN ('scheduled', 'in_progress');

-- ── 5. GiST exclusion constraint — prevents double-booking at the DB level ────
-- Requires btree_gist extension (available in Supabase Postgres 15+).
-- Ensures no two non-cancelled shifts for the same assignee overlap in time.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE shifts ADD CONSTRAINT shifts_no_overlap
  EXCLUDE USING gist (
    assignee_user_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  ) WHERE (status <> 'cancelled');

-- ── 6. Tighten RLS — coordinator-only INSERT and UPDATE ───────────────────────
-- Previous policies allowed any team member to write. Phase 2 requires
-- coordinator authorization. The tRPC layer also enforces this, but defense
-- in depth means the DB should reject non-coordinator writes independently.

DROP POLICY IF EXISTS "shifts writable by team"  ON shifts;
DROP POLICY IF EXISTS "shifts updatable by team" ON shifts;

-- Only coordinators in the org may insert shifts
CREATE POLICY "shifts insertable by coordinator"
  ON shifts FOR INSERT
  WITH CHECK (user_is_org_coordinator(org_id));

-- Only coordinators in the org may update shifts
CREATE POLICY "shifts updatable by coordinator"
  ON shifts FOR UPDATE
  USING (user_is_org_coordinator(org_id));
