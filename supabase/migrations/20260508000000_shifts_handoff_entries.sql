-- UX-101a — narrative handoff entries on shifts.
--
-- Design decision (per docs/plans/wave-9-shifts-data.md Step 3a):
-- Column-on-shifts approach (1:1) chosen over a separate `shift_handoffs`
-- table because (a) the prototype models one handoff per shift,
-- (b) <NarrativeHandoff> view mode is overwrite-then-edit (no amendment
-- history surfaced in current UI), (c) reversible — promotion to a
-- table is itself a tracked story if amendments become a product
-- requirement.
--
-- Shape: `handoff_entries` is a jsonb array of `{kind, text}` objects.
-- The application layer enforces the inner shape; the column-level
-- constraint only enforces "must be a JSON array".
--
-- Default value `'[]'::jsonb` keeps the column NOT NULL safe for
-- backfill — existing rows get an empty array, new rows the same.
--
-- RLS: existing `shifts` policies apply unchanged. Writes to
-- `handoff_entries` are gated by the existing "shifts updatable by
-- coordinator" policy. A separate caregiver-write path is added in
-- the application layer (UX-101b tRPC `shifts.upsertHandoff`) using
-- supabaseAdmin with an explicit ownership check.

ALTER TABLE shifts
  ADD COLUMN handoff_entries jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE shifts
  ADD CONSTRAINT shifts_handoff_entries_is_array
  CHECK (jsonb_typeof(handoff_entries) = 'array');

COMMENT ON COLUMN shifts.handoff_entries IS
  'UX-101: array of {kind, text} handoff narrative entries written by the off-going caregiver. v1: 1 entry per shift, overwrite-on-edit. Application enforces inner shape.';
