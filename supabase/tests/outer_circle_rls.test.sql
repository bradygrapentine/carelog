BEGIN;
SELECT plan(8);

-- ─── fixtures ────────────────────────────────────────────────────────────────

SET LOCAL ROLE postgres;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('aaaa0001-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'coord@outer-rls.com', now(), now(), now(), '{}', '{}', false),
  ('bbbb0002-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'caregiver@outer-rls.com', now(), now(), now(), '{}', '{}', false),
  ('cccc0003-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'outsider@outer-rls.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, org_type)
VALUES ('10000000-0000-0000-0000-000000000001', 'Outer Circle RLS Org', 'family')
ON CONFLICT DO NOTHING;

INSERT INTO identity_vault (org_id, full_name)
VALUES ('10000000-0000-0000-0000-000000000001', 'Test Recipient')
ON CONFLICT DO NOTHING;

INSERT INTO care_recipients (id, org_id, identity_token)
SELECT '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', token
FROM identity_vault WHERE org_id = '10000000-0000-0000-0000-000000000001' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO memberships (org_id, user_id, role, accepted_at, recipient_id)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  'aaaa0001-0000-0000-0000-000000000001',
  'coordinator', now(), null
) ON CONFLICT DO NOTHING;

INSERT INTO memberships (org_id, user_id, role, accepted_at, recipient_id)
VALUES (
  '10000000-0000-0000-0000-000000000001',
  'bbbb0002-0000-0000-0000-000000000002',
  'caregiver', now(), '20000000-0000-0000-0000-000000000001'
) ON CONFLICT DO NOTHING;

-- Fixture request — inserted as postgres to bypass RLS
INSERT INTO outer_circle_requests (id, org_id, recipient_id, share_token, title, request_type, slots_total, created_by)
VALUES (
  '40000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'testhex0001', 'Meals needed', 'meal', 3,
  'aaaa0001-0000-0000-0000-000000000001'
) ON CONFLICT DO NOTHING;

-- ─── tests ───────────────────────────────────────────────────────────────────

-- 1. R2-006 regression: outsider (authenticated non-member) CANNOT read
--    outer_circle_requests. Old USING (true) policy allowed cross-org enumeration;
--    new team-scoped policy restricts SELECT to accepted org members.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"cccc0003-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM outer_circle_requests WHERE id = '40000000-0000-0000-0000-000000000001'$$,
  ARRAY[0]::int[],
  'outsider cannot read outer_circle_requests (R2-006 team-scoped)'
);

-- 2. Outsider cannot INSERT a request — policy requires created_by = auth.uid() AND
--    there is an implicit check that the row is being inserted by the authenticated user,
--    but more importantly the outsider can technically satisfy created_by = auth.uid().
--    The actual guard is that any authenticated user can insert as themselves.
--    Test: outsider tries to insert with created_by = coordinator's id → should fail (42501)
SELECT throws_ok(
  $$INSERT INTO outer_circle_requests (org_id, recipient_id, share_token, title, request_type, slots_total, created_by)
    VALUES (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'testhex0002', 'Rides needed', 'transport', 2,
      'aaaa0001-0000-0000-0000-000000000001'
    )$$,
  '42501', NULL,
  'outsider cannot insert request attributed to another user'
);

-- 3. Coordinator can INSERT a request (created_by = auth.uid() matches)
SET LOCAL "request.jwt.claims" TO '{"sub":"aaaa0001-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT lives_ok(
  $$INSERT INTO outer_circle_requests (org_id, recipient_id, share_token, title, request_type, slots_total, created_by)
    VALUES (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'testhex0003', 'Grocery run', 'errand', 1,
      'aaaa0001-0000-0000-0000-000000000001'
    )$$,
  'coordinator can insert outer_circle_request'
);

-- 4. H1 (sec-review): Direct INSERT into outer_circle_claims is now blocked for all roles.
--    The open "WITH CHECK (true)" INSERT policy was removed in sec_high_fixes migration.
--    An authenticated outsider direct-INSERTing must get 42501.
SET LOCAL "request.jwt.claims" TO '{"sub":"cccc0003-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT throws_ok(
  $$INSERT INTO outer_circle_claims (request_id, claimer_name, claimer_email)
    VALUES (
      '40000000-0000-0000-0000-000000000001',
      'Jane Helper',
      'jane@example.com'
    )$$,
  '42501', NULL,
  'H1: direct INSERT into outer_circle_claims is blocked (no open insert policy)'
);

-- 4b. H1: claim_outer_circle_slot() SECURITY DEFINER function succeeds for active request.
--     Run as postgres to call the RPC directly (function runs under table-owner security).
SET LOCAL ROLE postgres;

SELECT lives_ok(
  $$SELECT claim_outer_circle_slot(
      '40000000-0000-0000-0000-000000000001'::uuid,
      'Jane Helper',
      'jane@example.com',
      NULL
  )$$,
  'H1: claim_outer_circle_slot() SECURITY DEFINER succeeds for active request'
);

SET LOCAL ROLE authenticated;

-- 5. Coordinator (request creator) can read claims for their requests
--    Policy: SELECT USING (EXISTS (SELECT 1 FROM outer_circle_requests r WHERE r.id = request_id AND r.created_by = auth.uid()))
SET LOCAL "request.jwt.claims" TO '{"sub":"aaaa0001-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM outer_circle_claims WHERE request_id = '40000000-0000-0000-0000-000000000001'$$,
  ARRAY[1]::int[],
  'coordinator can read claims for their org requests'
);

-- 6. R2-006 regression: team member (caregiver) CAN read their org's requests.
SET LOCAL "request.jwt.claims" TO '{"sub":"bbbb0002-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM outer_circle_requests WHERE id = '40000000-0000-0000-0000-000000000001'$$,
  ARRAY[1]::int[],
  'team member can read their org outer_circle_requests'
);

-- 7. R2-006 regression: anon role sees ZERO rows in outer_circle_requests.
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" TO '{"role":"anon"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM outer_circle_requests$$,
  ARRAY[0]::int[],
  'anon role sees zero rows in outer_circle_requests (R2-006 regression)'
);

SELECT * FROM finish();
ROLLBACK;
