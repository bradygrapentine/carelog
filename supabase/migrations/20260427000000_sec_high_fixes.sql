-- Security High-severity fixes — 2026-04-27
-- H1: Tighten outer_circle_claims RLS WITH CHECK + make claim_outer_circle_slot SECURITY DEFINER
-- H2: Enforce care_briefs.expires_at NOT NULL with 30-day default
-- H4: Tighten care_event_comments RLS to require accepted_at IS NOT NULL

-- ============================================================
-- H1a: Replace permissive INSERT policy on outer_circle_claims
--      Old: WITH CHECK (true) — allowed anon to bypass active/slot checks
--      New: Only callable via SECURITY DEFINER function (no direct INSERT policy)
--           The claim_outer_circle_slot function enforces all business rules.
--           We remove the open INSERT policy entirely — callers must use the function.
-- ============================================================

DROP POLICY IF EXISTS "outer claims open insert" ON outer_circle_claims;

-- No direct INSERT policy — all inserts must go through claim_outer_circle_slot()
-- which performs the active + slots_total gate atomically.

-- ============================================================
-- H1b: Wrap claim_outer_circle_slot in SECURITY DEFINER
--      so it can bypass RLS on outer_circle_requests/outer_circle_claims
--      while still enforcing business logic (active check, slot cap).
-- ============================================================

CREATE OR REPLACE FUNCTION claim_outer_circle_slot(
  p_request_id  uuid,
  p_name        text,
  p_email       text,
  p_date        timestamptz DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  claim_id uuid;
BEGIN
  UPDATE outer_circle_requests
  SET    slots_filled = slots_filled + 1
  WHERE  id           = p_request_id
    AND  active       = true
    AND  slots_filled < slots_total;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'slot_unavailable';
  END IF;

  INSERT INTO outer_circle_claims (request_id, claimer_name, claimer_email, slot_date)
  VALUES (p_request_id, p_name, p_email, p_date)
  RETURNING id INTO claim_id;

  RETURN claim_id;
END;
$$;

-- ============================================================
-- H2: Make care_briefs.expires_at NOT NULL
--     Default: NOW() + 30 days (product intent: monthly expiry on PHI share links)
--     Backfill any existing NULL rows before applying the constraint.
-- ============================================================

UPDATE care_briefs
SET expires_at = now() + interval '30 days'
WHERE expires_at IS NULL;

ALTER TABLE care_briefs
  ALTER COLUMN expires_at SET NOT NULL,
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '30 days');

-- ============================================================
-- H4: Tighten care_event_comments SELECT policy
--     Old: any membership row (including pending invites)
--     New: require accepted_at IS NOT NULL so pre-acceptance members
--          cannot read PHI comments.
-- ============================================================

DROP POLICY IF EXISTS "care_event_comments_member_select" ON care_event_comments;

CREATE POLICY "care_event_comments_member_select"
  ON care_event_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id    = care_event_comments.org_id
        AND m.user_id   = auth.uid()
        AND m.accepted_at IS NOT NULL
    )
  );

-- Also tighten INSERT policy to require accepted_at IS NOT NULL
DROP POLICY IF EXISTS "care_event_comments_member_insert" ON care_event_comments;

CREATE POLICY "care_event_comments_member_insert"
  ON care_event_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id      = care_event_comments.org_id
        AND m.user_id     = auth.uid()
        AND m.accepted_at IS NOT NULL
    )
    AND EXISTS (
      SELECT 1 FROM care_events ce
      WHERE ce.id     = care_event_comments.care_event_id
        AND ce.org_id = care_event_comments.org_id
    )
  );
