-- supabase/migrations/20260514120000_harden_journal_reactions_rls.sql
-- OOP-002: Harden journal_reactions INSERT policy to require team access;
--          add missing UPDATE policy (previously a silent DENY).
--
-- Gap: the original INSERT policy (core_schema.sql:462-464) only checked
-- user_id = auth.uid(), allowing any authenticated user to react on ANY
-- care_event regardless of org membership.
-- Fix: require the actor to have team access to the event's recipient
-- (same check pattern used by "reactions readable by team" SELECT policy).

-- Drop and re-create the INSERT policy with the team-access check.
DROP POLICY IF EXISTS "reactions insertable by members" ON journal_reactions;

CREATE POLICY "reactions insertable by members"
  ON journal_reactions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM care_events ce
      WHERE ce.id = journal_reactions.event_id
        AND user_can_access_recipient(ce.recipient_id)
    )
  );

-- Add the missing UPDATE policy (was silently denying all updates).
CREATE POLICY "reactions updatable by owner"
  ON journal_reactions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM care_events ce
      WHERE ce.id = journal_reactions.event_id
        AND user_can_access_recipient(ce.recipient_id)
    )
  );
