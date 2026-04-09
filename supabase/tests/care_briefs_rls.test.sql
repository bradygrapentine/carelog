BEGIN;
SELECT plan(5);

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

-- 1. Authenticated user can read brief by share_token where revoked = false
--    Policy: "briefs open read" — USING (true) — any authenticated user can SELECT
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"cccc0003-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM care_briefs WHERE share_token = 'brieftoken001' AND revoked = false$$,
  ARRAY[1]::int[],
  'authenticated user can read care_brief by share_token where revoked = false'
);

-- 2. Revoked brief is not visible when filtering revoked = false
--    Update to revoked=true as postgres, then re-query as authenticated user
SET LOCAL ROLE postgres;
UPDATE care_briefs SET revoked = true WHERE id = '50000000-0000-0000-0000-000000000001';

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"cccc0003-0000-0000-0000-000000000003","role":"authenticated"}';

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

-- 5. Org member (caregiver) can also read brief by share_token
--    Policy is open read (USING true), so org membership is not required for SELECT.
--    This confirms the open read policy applies to all authenticated users.
SET LOCAL "request.jwt.claims" TO '{"sub":"bbbb0002-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM care_briefs WHERE share_token = 'brieftoken001' AND revoked = false$$,
  ARRAY[1]::int[],
  'org member can read care_brief by share_token'
);

SELECT * FROM finish();
ROLLBACK;
