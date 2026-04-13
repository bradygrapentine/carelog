-- R2-006 / F-004: replace the permissive `USING (true)` SELECT policy on
-- outer_circle_requests with a team-scoped policy. The previous policy let any
-- anon-key client enumerate every request across every org via PostgREST; the
-- share-token share surface is served through an API route that uses
-- supabaseAdmin (bypassing RLS), so RLS does not need to allow anon reads.
--
-- New policy: SELECT is limited to users with an accepted membership in the
-- org that owns the request, matching the team-scoped model used across the
-- rest of the PHI-bearing tables.

DROP POLICY IF EXISTS "outer requests open read" ON outer_circle_requests;

CREATE POLICY "outer requests team read"
  ON outer_circle_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = outer_circle_requests.org_id
        AND m.user_id = auth.uid()
        AND m.accepted_at IS NOT NULL
    )
  );
