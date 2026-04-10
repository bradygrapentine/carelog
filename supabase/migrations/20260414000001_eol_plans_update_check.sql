-- P5-04 security fix: add WITH CHECK to coordinator UPDATE policy
-- Prevents coordinators from updating org_id/recipient_id to point to another org.

DROP POLICY IF EXISTS "coordinator can update eol_plans" ON eol_plans;

CREATE POLICY "coordinator can update eol_plans"
  ON eol_plans FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM   memberships
      WHERE  org_id       = eol_plans.org_id
      AND    user_id      = auth.uid()
      AND    role         = 'coordinator'
      AND    accepted_at  IS NOT NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   memberships
      WHERE  org_id       = eol_plans.org_id
      AND    user_id      = auth.uid()
      AND    role         = 'coordinator'
      AND    accepted_at  IS NOT NULL
    )
  );
