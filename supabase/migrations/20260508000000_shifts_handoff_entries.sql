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
-- coordinator" policy.
--
-- TD-213: WHY the caregiver-write path bypasses RLS. The off-going
-- caregiver is NOT necessarily the coordinator, so the coordinator-only
-- UPDATE policy above would reject their handoff write. Rather than
-- widen the RLS policy (which would also unlock every other shift
-- column to any caregiver), the narrower caregiver-write path lives in
-- the application layer (UX-101b tRPC `shifts.upsertHandoff`) using
-- supabaseAdmin (service-role, RLS-bypassing) with an explicit
-- own-shift ownership check. Authz moves to the app layer precisely
-- because it can scope to "this caregiver, this shift, this column"
-- in a way the table-level RLS grant cannot express.

ALTER TABLE shifts
  ADD COLUMN handoff_entries jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE shifts
  ADD CONSTRAINT shifts_handoff_entries_is_array
  CHECK (jsonb_typeof(handoff_entries) = 'array');

COMMENT ON COLUMN shifts.handoff_entries IS
  'UX-101: array of {kind, text} handoff narrative entries written by the off-going caregiver. v1: 1 entry per shift, overwrite-on-edit. Application enforces inner shape.';
