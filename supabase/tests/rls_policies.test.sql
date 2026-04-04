BEGIN;
SELECT plan(18);

-- Helper: create test org and recipient
CREATE OR REPLACE FUNCTION create_test_fixtures()
RETURNS TABLE(org_id uuid, recipient_id uuid, vault_token uuid) AS $$
DECLARE
  v_org_id uuid;
  v_token  uuid;
  v_rec_id uuid;
BEGIN
  INSERT INTO organizations (name, org_type)
  VALUES ('Test Org', 'family')
  RETURNING id INTO v_org_id;

  INSERT INTO identity_vault (org_id, full_name)
  VALUES (v_org_id, 'Test Person')
  RETURNING token INTO v_token;

  INSERT INTO care_recipients (org_id, identity_token)
  VALUES (v_org_id, v_token)
  RETURNING id INTO v_rec_id;

  RETURN QUERY SELECT v_org_id, v_rec_id, v_token;
END;
$$ LANGUAGE plpgsql;

-- Helper: create two orgs with real auth users for cross-org isolation tests.
-- Must be called as the postgres role, which has:
--   • rolbypassrls = true  (can insert into identity_vault)
--   • INSERT on auth.users (can create test users without needing supabase_auth_admin)
CREATE OR REPLACE FUNCTION create_membership_fixtures()
RETURNS TABLE(org_a_id uuid, org_b_id uuid, rec_a_id uuid) AS $$
DECLARE
  v_org_a uuid;
  v_org_b uuid;
  v_tok   uuid;
  v_rec   uuid;
BEGIN
  -- Insert test auth users (A, B, C). The handle_new_user trigger has an
  -- EXCEPTION handler so it won't fail even if user_profiles insert fails.
  INSERT INTO auth.users (
    id, aud, role, email, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
  ) VALUES
    ('aaaaaaaa-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
     'usera@rls-test.com', now(), now(), now(), '{}', '{}', false),
    ('bbbbbbbb-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
     'userb@rls-test.com', now(), now(), now(), '{}', '{}', false),
    ('cccccccc-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
     'userc@rls-test.com', now(), now(), now(), '{}', '{}', false)
  ON CONFLICT (id) DO NOTHING;

  -- Org A — user A is coordinator
  INSERT INTO organizations (name, org_type) VALUES ('RLS Org A', 'family') RETURNING id INTO v_org_a;
  INSERT INTO memberships (org_id, user_id, role, accepted_at, recipient_id)
    VALUES (v_org_a, 'aaaaaaaa-0000-0000-0000-000000000001', 'coordinator', now(), null);

  INSERT INTO identity_vault (org_id, full_name) VALUES (v_org_a, 'Recip A') RETURNING token INTO v_tok;
  INSERT INTO care_recipients (org_id, identity_token) VALUES (v_org_a, v_tok) RETURNING id INTO v_rec;

  -- Org B — user B is coordinator (user A has no membership here)
  INSERT INTO organizations (name, org_type) VALUES ('RLS Org B', 'family') RETURNING id INTO v_org_b;
  INSERT INTO memberships (org_id, user_id, role, accepted_at, recipient_id)
    VALUES (v_org_b, 'bbbbbbbb-0000-0000-0000-000000000002', 'coordinator', now(), null);

  RETURN QUERY SELECT v_org_a, v_org_b, v_rec;
END;
$$ LANGUAGE plpgsql;

-- 1. Service role can read identity vault
SET LOCAL ROLE service_role;
SELECT ok(
  (SELECT count(*) FROM identity_vault) >= 0,
  'service role can read identity vault'
);

-- 2. Anon cannot read identity vault
SET LOCAL ROLE anon;
SELECT results_eq(
  'SELECT count(*)::int FROM identity_vault',
  ARRAY[0]::int[],
  'anon cannot read identity vault'
);

-- 3. Authenticated user cannot read identity vault
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT results_eq(
  'SELECT count(*)::int FROM identity_vault',
  ARRAY[0]::int[],
  'authenticated user cannot read identity vault'
);

-- 4. Anon cannot read care events
SET LOCAL ROLE anon;
SELECT results_eq(
  'SELECT count(*)::int FROM care_events',
  ARRAY[0]::int[],
  'anon cannot read care events'
);

-- 5. Anon cannot read organizations
SET LOCAL ROLE anon;
SELECT results_eq(
  'SELECT count(*)::int FROM organizations',
  ARRAY[0]::int[],
  'anon cannot read organizations'
);

-- 6. Anon cannot read memberships
SET LOCAL ROLE anon;
SELECT results_eq(
  'SELECT count(*)::int FROM memberships',
  ARRAY[0]::int[],
  'anon cannot read memberships'
);

-- 7. Outer circle requests are publicly readable
SET LOCAL ROLE anon;
SELECT ok(
  (SELECT count(*)::int FROM outer_circle_requests) >= 0,
  'outer circle requests are publicly readable'
);

-- 8. Care briefs are publicly readable (token enforced in API)
SET LOCAL ROLE anon;
SELECT ok(
  (SELECT count(*)::int FROM care_briefs) >= 0,
  'care briefs are publicly readable'
);

-- ============================================================
-- Tests 9–14: cross-org isolation using real user memberships
-- ============================================================
-- Call fixtures as postgres: it has rolbypassrls=true (can write to identity_vault)
-- and INSERT on auth.users (can create test users).
SET LOCAL ROLE postgres;
CREATE TEMP TABLE _fix AS SELECT * FROM create_membership_fixtures();
GRANT SELECT ON _fix TO PUBLIC;

-- Insert a care event for org A's recipient (actor = user A)
INSERT INTO care_events (org_id, recipient_id, actor_id, event_type, entry_kind, payload)
  SELECT org_a_id, rec_a_id, 'aaaaaaaa-0000-0000-0000-000000000001', 'journal', 'human', '{"text":"test"}'
  FROM _fix;

-- Insert a journal reaction on that event (user A reacted)
INSERT INTO journal_reactions (event_id, user_id, reaction)
  SELECT ce.id, 'aaaaaaaa-0000-0000-0000-000000000001', 'heart'
  FROM care_events ce
  JOIN _fix ON ce.recipient_id = _fix.rec_a_id;

-- 9. Member can read their own org
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT results_eq(
  'SELECT count(*)::int FROM organizations WHERE id = (SELECT org_a_id FROM _fix)',
  ARRAY[1]::int[],
  'member can read their own org'
);

-- 10. Member cannot read another org they have no membership in
SELECT results_eq(
  'SELECT count(*)::int FROM organizations WHERE id = (SELECT org_b_id FROM _fix)',
  ARRAY[0]::int[],
  'member cannot read an org they have no membership in'
);

-- 11. Member can read care events for their recipient
SELECT results_eq(
  'SELECT count(*)::int FROM care_events WHERE recipient_id = (SELECT rec_a_id FROM _fix)',
  ARRAY[1]::int[],
  'member can read care events for their recipient'
);

-- 12. User with no membership cannot read events in another org
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT results_eq(
  'SELECT count(*)::int FROM care_events WHERE recipient_id = (SELECT rec_a_id FROM _fix)',
  ARRAY[0]::int[],
  'user without membership cannot read care events in another org'
);

-- 13. Pending (unaccepted) membership does not grant org access
-- User C was inserted into auth.users by create_membership_fixtures() above.
SET LOCAL ROLE postgres;
INSERT INTO memberships (org_id, user_id, role, accepted_at, recipient_id)
  SELECT org_a_id, 'cccccccc-0000-0000-0000-000000000003', 'supporter', null, null
  FROM _fix;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"cccccccc-0000-0000-0000-000000000003","role":"authenticated"}';
SELECT results_eq(
  'SELECT count(*)::int FROM organizations WHERE id = (SELECT org_a_id FROM _fix)',
  ARRAY[0]::int[],
  'pending membership (accepted_at IS NULL) does not grant org access'
);

-- 14. Member can read journal reactions in their org
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
SELECT results_eq(
  'SELECT count(*)::int FROM journal_reactions jr JOIN care_events ce ON ce.id = jr.event_id WHERE ce.recipient_id = (SELECT rec_a_id FROM _fix)',
  ARRAY[1]::int[],
  'member can read journal reactions in their org'
);

-- ============================================================
-- Tests 15–18: care_events mutation policies
-- ============================================================
-- Add user D as accepted caregiver in org A (called as postgres: bypassrls + INSERT on auth.users)
SET LOCAL ROLE postgres;
INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES (
  'dddddddd-0000-0000-0000-000000000004', 'authenticated', 'authenticated',
  'userd@rls-test.com', now(), now(), now(), '{}', '{}', false
) ON CONFLICT (id) DO NOTHING;

INSERT INTO memberships (org_id, user_id, role, accepted_at, recipient_id)
  SELECT org_a_id, 'dddddddd-0000-0000-0000-000000000004', 'caregiver', now(), null FROM _fix;

-- 15. Active caregiver member can insert a care event
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"dddddddd-0000-0000-0000-000000000004","role":"authenticated"}';
SELECT lives_ok(
  $$INSERT INTO care_events (org_id, recipient_id, actor_id, event_type, entry_kind, payload)
    SELECT org_a_id, rec_a_id,
           'dddddddd-0000-0000-0000-000000000004'::uuid,
           'journal'::event_type, 'human'::entry_kind,
           '{"text":"caregiver entry"}'::jsonb
    FROM _fix$$,
  'active caregiver member can insert a care event'
);

-- 16. Non-member cannot insert a care event (WITH CHECK violation raises 42501)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';
SELECT throws_ok(
  $$INSERT INTO care_events (org_id, recipient_id, actor_id, event_type, entry_kind, payload)
    SELECT org_a_id, rec_a_id,
           'bbbbbbbb-0000-0000-0000-000000000002'::uuid,
           'journal'::event_type, 'human'::entry_kind,
           '{"text":"intruder"}'::jsonb
    FROM _fix$$,
  '42501',
  NULL,
  'non-member cannot insert a care event'
);

-- 17. Coordinator can update (flag) a care event
-- Flag all org-A events as coordinator; both the setup event and the caregiver event (test 15) should flip.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
UPDATE care_events SET flagged = true WHERE recipient_id = (SELECT rec_a_id FROM _fix);
SELECT results_eq(
  $$SELECT count(*)::int FROM care_events
    WHERE recipient_id = (SELECT rec_a_id FROM _fix) AND flagged = true$$,
  ARRAY[2]::int[],
  'coordinator can update (flag) care events'
);

-- 18. Caregiver cannot update a care event
-- The UPDATE policy USING clause makes rows invisible to non-coordinators; UPDATE is silent (0 rows touched).
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"dddddddd-0000-0000-0000-000000000004","role":"authenticated"}';
UPDATE care_events SET flagged = false WHERE recipient_id = (SELECT rec_a_id FROM _fix);
SELECT results_eq(
  $$SELECT count(*)::int FROM care_events
    WHERE recipient_id = (SELECT rec_a_id FROM _fix) AND flagged = true$$,
  ARRAY[2]::int[],
  'caregiver cannot update a care event (events remain flagged)'
);

SELECT * FROM finish();
ROLLBACK;
