BEGIN;
SELECT plan(7);

-- ─── fixtures ────────────────────────────────────────────────────────────────

SET LOCAL ROLE postgres;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('aa110001-1000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'coord@expense-rls.com', now(), now(), now(), '{}', '{}', false),
  ('bb220002-1000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'caregiver@expense-rls.com', now(), now(), now(), '{}', '{}', false),
  ('cc330003-1000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'supporter@expense-rls.com', now(), now(), now(), '{}', '{}', false),
  ('dd440004-1000-0000-0000-000000000004', 'authenticated', 'authenticated',
   'outsider@expense-rls.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, org_type)
VALUES ('11100000-1000-0000-0000-000000000001', 'Expense RLS Org', 'family')
ON CONFLICT DO NOTHING;

INSERT INTO identity_vault (org_id, full_name)
VALUES ('11100000-1000-0000-0000-000000000001', 'Expense Test Recipient')
ON CONFLICT DO NOTHING;

INSERT INTO care_recipients (id, org_id, identity_token)
SELECT '21100000-1000-0000-0000-000000000001', '11100000-1000-0000-0000-000000000001', token
FROM identity_vault WHERE org_id = '11100000-1000-0000-0000-000000000001' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO memberships (org_id, user_id, role, accepted_at, recipient_id)
VALUES
  ('11100000-1000-0000-0000-000000000001', 'aa110001-1000-0000-0000-000000000001', 'coordinator', now(), null),
  ('11100000-1000-0000-0000-000000000001', 'bb220002-1000-0000-0000-000000000002', 'caregiver',   now(), '21100000-1000-0000-0000-000000000001'),
  ('11100000-1000-0000-0000-000000000001', 'cc330003-1000-0000-0000-000000000003', 'supporter',   now(), null)
ON CONFLICT DO NOTHING;

-- Fixture expense — inserted as postgres to bypass RLS
INSERT INTO expenses (id, org_id, recipient_id, logged_by, amount, category, description)
VALUES (
  '31100000-1000-0000-0000-000000000001',
  '11100000-1000-0000-0000-000000000001',
  '21100000-1000-0000-0000-000000000001',
  'aa110001-1000-0000-0000-000000000001',
  42.50, 'medication', 'Aspirin refill'
) ON CONFLICT DO NOTHING;

-- ─── tests ───────────────────────────────────────────────────────────────────

-- 1. Coordinator can INSERT
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"aa110001-1000-0000-0000-000000000001","role":"authenticated"}';

SELECT lives_ok(
  $$INSERT INTO expenses (org_id, recipient_id, logged_by, amount, category, description)
    VALUES ('11100000-1000-0000-0000-000000000001','21100000-1000-0000-0000-000000000001',
            'aa110001-1000-0000-0000-000000000001', 10.00, 'supplies', 'Gauze')$$,
  'coordinator can insert an expense'
);

-- 2. Caregiver can INSERT
SET LOCAL "request.jwt.claims" TO '{"sub":"bb220002-1000-0000-0000-000000000002","role":"authenticated"}';

SELECT lives_ok(
  $$INSERT INTO expenses (org_id, recipient_id, logged_by, amount, category, description)
    VALUES ('11100000-1000-0000-0000-000000000001','21100000-1000-0000-0000-000000000001',
            'bb220002-1000-0000-0000-000000000002', 5.00, 'food', 'Groceries')$$,
  'caregiver can insert an expense'
);

-- 3. Supporter CANNOT INSERT
SET LOCAL "request.jwt.claims" TO '{"sub":"cc330003-1000-0000-0000-000000000003","role":"authenticated"}';

SELECT throws_ok(
  $$INSERT INTO expenses (org_id, recipient_id, logged_by, amount, category, description)
    VALUES ('11100000-1000-0000-0000-000000000001','21100000-1000-0000-0000-000000000001',
            'cc330003-1000-0000-0000-000000000003', 1.00, 'other', 'Flowers')$$,
  '42501', NULL,
  'supporter cannot insert an expense'
);

-- 4. Coordinator can SELECT
SET LOCAL "request.jwt.claims" TO '{"sub":"aa110001-1000-0000-0000-000000000001","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM expenses WHERE org_id = '11100000-1000-0000-0000-000000000001'$$,
  ARRAY[3]::int[],
  'coordinator can read expenses for their org'
);

-- 5. Supporter can SELECT (read-only access)
SET LOCAL "request.jwt.claims" TO '{"sub":"cc330003-1000-0000-0000-000000000003","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM expenses WHERE org_id = '11100000-1000-0000-0000-000000000001'$$,
  ARRAY[3]::int[],
  'supporter can read expenses for their org'
);

-- 6. Outsider sees 0 rows
SET LOCAL "request.jwt.claims" TO '{"sub":"dd440004-1000-0000-0000-000000000004","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM expenses WHERE org_id = '11100000-1000-0000-0000-000000000001'$$,
  ARRAY[0]::int[],
  'non-member cannot read expenses'
);

-- 7. Coordinator can DELETE
SET LOCAL "request.jwt.claims" TO '{"sub":"aa110001-1000-0000-0000-000000000001","role":"authenticated"}';

SELECT lives_ok(
  $$DELETE FROM expenses WHERE id = '31100000-1000-0000-0000-000000000001'$$,
  'coordinator can delete an expense'
);

SELECT * FROM finish();
ROLLBACK;
