-- ON-78: on-call shift type.
-- Adds a shift *type* dimension orthogonal to the existing shift_status lifecycle
-- (open/claimed/confirmed/completed/missed). An on-call shift designates its
-- assigned_to caregiver as the routing target for task requests arriving during
-- [starts_at, ends_at) — consumed by ON-81 (notifications).
--
-- Additive + backward-compatible: NOT NULL DEFAULT 'standard' backfills every
-- existing row via the column default. No RLS change — the new column inherits
-- the existing `shifts` policies (verified by supabase/tests/shift_type.test.sql).

CREATE TYPE shift_type AS ENUM ('standard', 'on_call');

ALTER TABLE shifts
  ADD COLUMN shift_type shift_type NOT NULL DEFAULT 'standard';
