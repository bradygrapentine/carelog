-- supabase/tests/superuser_plan_rls.test.sql
--
-- Verifies that the organizations table RLS correctly gates the plan column
-- (including the 'professional' plan set by 20260416000000_superuser_plan.sql):
--   - Coordinator can SELECT their org including plan field
--   - Outsider CANNOT SELECT the org
--   - Regular user cannot directly UPDATE plan (service role only)
--   - postgres/service role CAN update plan

BEGIN;
SELECT plan(4);

-- ─── fixtures ────────────────────────────────────────────────────────────────

SET LOCAL ROLE postgres;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('cc030001-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'coord@sup-plan-rls.com', now(), now(), now(), '{}', '{}', false),
  ('dd040002-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'outsider@sup-plan-rls.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, org_type, plan)
VALUES ('20000000-0000-0000-0000-000000000001', 'SuperPlan Org', 'family', 'professional')
ON CONFLICT DO NOTHING;

INSERT INTO memberships (org_id, user_id, role, accepted_at)
VALUES (
  '20000000-0000-0000-0000-000000000001',
  'cc030001-0000-0000-0000-000000000001',
  'coordinator', now()
) ON CONFLICT DO NOTHING;

-- ─── tests ───────────────────────────────────────────────────────────────────

-- 1. Coordinator can SELECT their own org including plan column
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"cc030001-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT results_eq(
  $$SELECT plan::text FROM organizations WHERE id = '20000000-0000-0000-0000-000000000001'$$,
  ARRAY['professional'],
  'coordinator can SELECT org plan column'
);

-- 2. Outsider CANNOT SELECT the org (RLS: user must be a member)
SET LOCAL "request.jwt.claims" TO '{"sub":"dd040002-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM organizations WHERE id = '20000000-0000-0000-0000-000000000001'$$,
  ARRAY[0]::int[],
  'outsider cannot SELECT org via RLS'
);

-- 3. Coordinator CANNOT directly UPDATE the plan column (silently blocked by RLS)
SET LOCAL "request.jwt.claims" TO '{"sub":"cc030001-0000-0000-0000-000000000001","role":"authenticated"}';

UPDATE organizations SET plan = 'free' WHERE id = '20000000-0000-0000-0000-000000000001';

SET LOCAL ROLE postgres;

SELECT results_eq(
  $$SELECT plan::text FROM organizations WHERE id = '20000000-0000-0000-0000-000000000001'$$,
  ARRAY['professional'],
  'coordinator cannot directly UPDATE plan column (service role only)'
);

-- 4. Service role (postgres) CAN update plan — the migration pattern works
UPDATE organizations SET plan = 'free' WHERE id = '20000000-0000-0000-0000-000000000001';

SELECT results_eq(
  $$SELECT plan::text FROM organizations WHERE id = '20000000-0000-0000-0000-000000000001'$$,
  ARRAY['free'],
  'postgres/service role can UPDATE plan column'
);

SELECT * FROM finish();
ROLLBACK;
