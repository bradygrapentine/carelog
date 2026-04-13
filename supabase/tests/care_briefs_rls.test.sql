BEGIN;
SELECT plan(7);

-- ─── fixtures ────────────────────────────────────────────────────────────────

SET LOCAL ROLE postgres;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('aaaa0001-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'coord@briefs-rls.com', now(), now(), now(), '{}', '{}', false),
  ('bbbb0002-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'caregiver@briefs-rls.com', now(), now(), now(), '{}', '{}', false),
  ('cccc0003-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'outsider@briefs-rls.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, org_type)
VALUES ('10000000-0000-0000-0000-000000000001', 'Briefs RLS Org', 'family')
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

-- Fixture brief — inserted as postgres to bypass RLS
INSERT INTO care_briefs (id, org_id, recipient_id, share_token, content, includes, created_by)
VALUES (
  '50000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'brieftoken001',
  '{"recipient_name": "Jane", "medications": [], "recent_entries": []}'::jsonb,
  ARRAY['medications', 'journal'],
  'aaaa0001-0000-0000-0000-000000000001'
) ON CONFLICT DO NOTHING;

-- ─── tests ───────────────────────────────────────────────────────────────────

-- 1. F-003 regression: outsider (no membership) CANNOT read care_briefs via RLS.
--    The old `USING (true)` policy let any anon/authenticated user dump PHI; the
--    new "briefs readable by team" policy scopes SELECT to org members.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"cccc0003-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM care_briefs WHERE share_token = 'brieftoken001' AND revoked = false$$,
  ARRAY[0]::int[],
  'outsider without membership cannot SELECT care_briefs (F-003 regression)'
);

-- 2. Revoked brief is not visible to team members when filtering revoked = false
SET LOCAL ROLE postgres;
UPDATE care_briefs SET revoked = true WHERE id = '50000000-0000-0000-0000-000000000001';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"aaaa0001-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM care_briefs WHERE share_token = 'brieftoken001' AND revoked = false$$,
  ARRAY[0]::int[],
  'revoked brief is not returned when filtering revoked = false'
);

-- Restore revoked = false for remaining tests
SET LOCAL ROLE postgres;
UPDATE care_briefs SET revoked = false WHERE id = '50000000-0000-0000-0000-000000000001';

-- 3. Outsider cannot INSERT a care_brief — INSERT policy requires
--    created_by = auth.uid() AND user_can_access_recipient(recipient_id).
--    Outsider has no membership so user_can_access_recipient returns false.
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"cccc0003-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT throws_ok(
  $$INSERT INTO care_briefs (org_id, recipient_id, share_token, content, includes, created_by)
    VALUES (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'brieftoken002',
      '{"recipient_name": "Jane", "medications": [], "recent_entries": []}'::jsonb,
      ARRAY['medications'],
      'cccc0003-0000-0000-0000-000000000003'
    )$$,
  '42501', NULL,
  'outsider cannot insert care_brief'
);

-- 4. Coordinator can INSERT a care_brief
--    Coordinator is an accepted member, so user_can_access_recipient returns true,
--    and created_by = auth.uid() is satisfied.
SET LOCAL "request.jwt.claims" TO '{"sub":"aaaa0001-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT lives_ok(
  $$INSERT INTO care_briefs (org_id, recipient_id, share_token, content, includes, created_by)
    VALUES (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'brieftoken003',
      '{"recipient_name": "Jane", "medications": [], "recent_entries": []}'::jsonb,
      ARRAY['medications', 'journal'],
      'aaaa0001-0000-0000-0000-000000000001'
    )$$,
  'coordinator can insert care_brief'
);

-- 5. Org member (caregiver) assigned to this recipient CAN read the brief —
--    user_can_access_recipient returns true for their accepted membership.
SET LOCAL "request.jwt.claims" TO '{"sub":"bbbb0002-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM care_briefs WHERE share_token = 'brieftoken001' AND revoked = false$$,
  ARRAY[1]::int[],
  'org member can read care_brief by share_token'
);

-- 6. R2-005 regression: anon role (unauthenticated) sees ZERO rows from care_briefs.
--    Guards against any future migration that accidentally re-adds a `USING (true)`
--    policy which would expose PHI to any holder of the public anon key.
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" TO '{"role":"anon"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM care_briefs$$,
  ARRAY[0]::int[],
  'anon role sees zero rows in care_briefs (R2-005 regression)'
);

-- 7. R2-005 regression: anon INSERT is denied (write side of the same check).
SELECT throws_ok(
  $$INSERT INTO care_briefs (org_id, recipient_id, share_token, content, includes, created_by)
    VALUES (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'anon-should-fail',
      '{}'::jsonb,
      ARRAY['medications'],
      'aaaa0001-0000-0000-0000-000000000001'
    )$$,
  '42501', NULL,
  'anon role cannot INSERT into care_briefs'
);

SELECT * FROM finish();
ROLLBACK;
