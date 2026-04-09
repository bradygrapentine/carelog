-- Extends shift_status enum with Phase 2 coordinator-assigned values.
-- Must be a separate migration from any DDL that *uses* these new values,
-- because Postgres requires the ADD VALUE transaction to commit before the
-- new label is visible in the same session.
ALTER TYPE shift_status ADD VALUE IF NOT EXISTS 'scheduled';
ALTER TYPE shift_status ADD VALUE IF NOT EXISTS 'in_progress';
ALTER TYPE shift_status ADD VALUE IF NOT EXISTS 'cancelled';
