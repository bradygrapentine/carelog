-- F-003: Remove anonymous open SELECT on care_briefs.
--
-- Original policy was `USING (true)` which allowed any client using the
-- public anon key (e.g. supabase-js in the browser) to dump every brief
-- row — bypassing the share-token check enforced in the /api/brief/[token]
-- route. PHI (recipient name, DOB, medications, journal entries) was
-- readable by anyone who could talk to PostgREST directly.
--
-- All legitimate reads happen via the API route, which uses the service
-- role key (bypasses RLS). Dropping the anon-accessible policy and
-- replacing it with a coordinator-scoped policy leaves the API path
-- unchanged but closes the public hole.

DROP POLICY IF EXISTS "briefs open read" ON care_briefs;

-- Allow authenticated users who can access the recipient to read their
-- own briefs directly (e.g. coordinator reviewing previously-created
-- briefs from the app shell). Public/share-token access flows through
-- the API route using the service role and does not require this policy.
CREATE POLICY "briefs readable by team"
  ON care_briefs FOR SELECT
  USING (user_can_access_recipient(recipient_id));
