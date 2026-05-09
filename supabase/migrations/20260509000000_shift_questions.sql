-- UX-102a: Open questions for the shift handoff "Questions" tab.
-- Caregivers raise questions during/after a shift; any team member can resolve.
-- See docs/plans/wave-9-shifts-data.md Step 4a for design rationale.
--
-- Security model (per rls-reviewer findings):
--   SELECT — team member of the recipient (user_can_access_recipient)
--   INSERT — accepted org member; raised_by must equal auth.uid();
--            recipient_id must belong to the row's org_id (no cross-org leak)
--   UPDATE — accepted org member of the row's org_id (USING + WITH CHECK)
--   DELETE — no policy (append-only / soft-resolve via resolved_at/by)
--
-- A trigger pins org_id, recipient_id, raised_by, raised_at, and body as
-- immutable so an UPDATE can only mutate the resolve-state columns. This
-- closes the "tampering within org" gap RLS cannot express directly.
--
-- PHI: body is free-form text — never log to analytics. Application
-- layer (UX-102b) enforces no-analytics rule.

CREATE TABLE shift_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  raised_by uuid NOT NULL REFERENCES auth.users(id),
  raised_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  CHECK ((resolved_at IS NULL) = (resolved_by IS NULL))
);

CREATE INDEX shift_questions_recipient_open_idx
  ON shift_questions (recipient_id, raised_at DESC)
  WHERE resolved_at IS NULL;

CREATE INDEX shift_questions_org_id_idx
  ON shift_questions (org_id);

ALTER TABLE shift_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shift_questions readable by team"
  ON shift_questions FOR SELECT
  USING (user_can_access_recipient(recipient_id));

CREATE POLICY "shift_questions insertable by team member"
  ON shift_questions FOR INSERT
  WITH CHECK (
    user_is_org_member(org_id)
    AND raised_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM care_recipients cr
      WHERE cr.id = recipient_id
        AND cr.org_id = shift_questions.org_id
    )
  );

CREATE POLICY "shift_questions updatable by team member"
  ON shift_questions FOR UPDATE
  USING (user_is_org_member(org_id))
  WITH CHECK (user_is_org_member(org_id));

CREATE FUNCTION shift_questions_immutable_cols()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION 'shift_questions.org_id is immutable';
  END IF;
  IF NEW.recipient_id IS DISTINCT FROM OLD.recipient_id THEN
    RAISE EXCEPTION 'shift_questions.recipient_id is immutable';
  END IF;
  IF NEW.raised_by IS DISTINCT FROM OLD.raised_by THEN
    RAISE EXCEPTION 'shift_questions.raised_by is immutable';
  END IF;
  IF NEW.raised_at IS DISTINCT FROM OLD.raised_at THEN
    RAISE EXCEPTION 'shift_questions.raised_at is immutable';
  END IF;
  IF NEW.body IS DISTINCT FROM OLD.body THEN
    RAISE EXCEPTION 'shift_questions.body is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER shift_questions_immutable_cols_trg
  BEFORE UPDATE ON shift_questions
  FOR EACH ROW EXECUTE FUNCTION shift_questions_immutable_cols();
