BEGIN;
SELECT plan(8);

-- ─── fixtures ────────────────────────────────────────────────────────────────

SET LOCAL ROLE postgres;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('aaaa0001-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'coord@shift-rls.com', now(), now(), now(), '{}', '{}', false),
  ('bbbb0002-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'caregiver@shift-rls.com', now(), now(), now(), '{}', '{}', false),
  ('cccc0003-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'outsider@shift-rls.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, org_type)
VALUES ('10000000-0000-0000-0000-000000000001', 'Shift RLS Org', 'family')
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

INSERT INTO shifts (id, org_id, recipient_id, assignee_user_id, start_at, end_at, status, created_by)
VALUES (
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'bbbb0002-0000-0000-0000-000000000002',
  now() + interval '1 day',
  now() + interval '1 day' + interval '8 hours',
  'scheduled',
  'aaaa0001-0000-0000-0000-000000000001'
) ON CONFLICT DO NOTHING;

-- ─── tests ───────────────────────────────────────────────────────────────────

-- 1. Outsider cannot read shifts
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"cccc0003-0000-0000-0000-000000000003","role":"authenticated"}';

SELECT results_eq(
  'SELECT count(*)::int FROM shifts WHERE org_id = ''10000000-0000-0000-0000-000000000001''',
  ARRAY[0]::int[],
  'outsider cannot read shifts in org they do not belong to'
);

-- 2. Outsider INSERT raises 42501 (insufficient_privilege / RLS violation)
SELECT throws_ok(
  $$INSERT INTO shifts (org_id, recipient_id, assignee_user_id, start_at, end_at, status, created_by)
    VALUES (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'cccc0003-0000-0000-0000-000000000003',
      now() + interval '2 days',
      now() + interval '2 days' + interval '4 hours',
      'scheduled',
      'cccc0003-0000-0000-0000-000000000003'
    )$$,
  '42501', NULL,
  'outsider cannot insert shift'
);

-- 3. Caregiver can read shifts in their org
SET LOCAL "request.jwt.claims" TO '{"sub":"bbbb0002-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT results_eq(
  'SELECT count(*)::int FROM shifts WHERE org_id = ''10000000-0000-0000-0000-000000000001''',
  ARRAY[1]::int[],
  'caregiver can read shifts in their org'
);

-- 4. Caregiver INSERT raises 42501 (coordinator-only RLS policy)
SELECT throws_ok(
  $$INSERT INTO shifts (org_id, recipient_id, assignee_user_id, start_at, end_at, status, created_by)
    VALUES (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'bbbb0002-0000-0000-0000-000000000002',
      now() + interval '3 days',
      now() + interval '3 days' + interval '4 hours',
      'scheduled',
      'bbbb0002-0000-0000-0000-000000000002'
    )$$,
  '42501', NULL,
  'caregiver cannot insert shift'
);

-- 5. Caregiver UPDATE is silently filtered by RLS USING clause.
--    Postgres RLS USING on UPDATE makes non-matching rows invisible — no error thrown.
--    Run as a bare statement, then verify the column is unchanged.
UPDATE shifts SET notes = 'hacked' WHERE id = '30000000-0000-0000-0000-000000000001';

SET LOCAL ROLE postgres;
SELECT results_eq(
  $$SELECT notes FROM shifts WHERE id = '30000000-0000-0000-0000-000000000001'$$,
  $$VALUES (NULL::text)$$,
  'caregiver UPDATE is silently filtered — notes column unchanged'
);

-- 6. Coordinator can read all shifts in their org
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"aaaa0001-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT results_eq(
  'SELECT count(*)::int FROM shifts WHERE org_id = ''10000000-0000-0000-0000-000000000001''',
  ARRAY[1]::int[],
  'coordinator can read all shifts in their org'
);

-- 7. Coordinator can insert a shift
SELECT lives_ok(
  $$INSERT INTO shifts (org_id, recipient_id, assignee_user_id, start_at, end_at, status, created_by)
    VALUES (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'bbbb0002-0000-0000-0000-000000000002',
      now() + interval '4 days',
      now() + interval '4 days' + interval '8 hours',
      'scheduled',
      'aaaa0001-0000-0000-0000-000000000001'
    )$$,
  'coordinator can insert shift'
);

-- 8. GiST exclusion constraint raises 23P01 for overlapping shift on same assignee.
--    Run as postgres (service role) to isolate the constraint from RLS.
SET LOCAL ROLE postgres;

SELECT throws_ok(
  $$INSERT INTO shifts (org_id, recipient_id, assignee_user_id, start_at, end_at, status, created_by)
    VALUES (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'bbbb0002-0000-0000-0000-000000000002',
      now() + interval '1 day' + interval '2 hours',
      now() + interval '1 day' + interval '10 hours',
      'scheduled',
      'aaaa0001-0000-0000-0000-000000000001'
    )$$,
  '23P01', NULL,
  'exclusion constraint rejects overlapping shift for same assignee'
);

SELECT * FROM finish();
ROLLBACK;
