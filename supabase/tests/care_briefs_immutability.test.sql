-- OOP-008: care_briefs.recipient_id immutability trigger tests.
--
-- Test plan (6 assertions):
--   1. authenticated coordinator: UPDATE recipient_id raises P0001.
--   2. authenticated coordinator: UPDATE another column (revoked) lives_ok.
--   3. service_role: UPDATE recipient_id is blocked (trigger fires above RLS).
--   4. service_role: UPDATE another column (title) lives_ok.
--   5. postgres role: UPDATE recipient_id is blocked by trigger.
--   6. postgres role: UPDATE title lives_ok.
BEGIN;
SELECT plan(6);

-- ─── fixtures ────────────────────────────────────────────────────────────────

SET LOCAL ROLE postgres;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('cc001001-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'coord@briefs-immut.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, org_type)
VALUES ('dd000001-0000-0000-0000-000000000001', 'Briefs Immut Org', 'family')
ON CONFLICT DO NOTHING;

INSERT INTO identity_vault (token, org_id, full_name)
VALUES ('ff100001-0000-0000-0000-000000000001', 'dd000001-0000-0000-0000-000000000001', 'Immut Recipient A')
ON CONFLICT DO NOTHING;

INSERT INTO care_recipients (id, org_id, identity_token)
VALUES ('ee000001-0000-0000-0000-000000000001', 'dd000001-0000-0000-0000-000000000001', 'ff100001-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

INSERT INTO memberships (org_id, user_id, role, accepted_at, recipient_id)
VALUES (
  'dd000001-0000-0000-0000-000000000001',
  'cc001001-0000-0000-0000-000000000001',
  'coordinator', now(), null
) ON CONFLICT DO NOTHING;

INSERT INTO care_briefs (id, org_id, recipient_id, share_token, content, includes, created_by)
VALUES (
  'bf000001-0000-0000-0000-000000000001',
  'dd000001-0000-0000-0000-000000000001',
  'ee000001-0000-0000-0000-000000000001',
  'immut-brief-token-001',
  '{"recipient_name": "Immut A", "medications": [], "recent_entries": []}'::jsonb,
  ARRAY['medications'],
  'cc001001-0000-0000-0000-000000000001'
) ON CONFLICT DO NOTHING;

-- ─── tests ───────────────────────────────────────────────────────────────────
-- Note: The attempted new recipient_id below does not need to be a real row.
-- The BEFORE UPDATE trigger raises before FK constraints are checked.

-- 1. authenticated coordinator: UPDATE recipient_id → trigger blocks it (P0001).
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"cc001001-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT throws_ok(
  $$UPDATE care_briefs
    SET recipient_id = 'ee999999-0000-0000-0000-000000000099'
    WHERE id = 'bf000001-0000-0000-0000-000000000001'$$,
  'P0001', 'care_briefs.recipient_id is immutable',
  'authenticated coordinator: UPDATE recipient_id raises immutability exception'
);

-- 2. authenticated coordinator: UPDATE another column (revoked) passes through.
SELECT lives_ok(
  $$UPDATE care_briefs
    SET revoked = false
    WHERE id = 'bf000001-0000-0000-0000-000000000001'$$,
  'authenticated coordinator: UPDATE revoked (non-immutable column) is allowed'
);

-- 3. service_role: UPDATE recipient_id → trigger fires above RLS, blocks it.
--    Validates TD-129 lesson: even elevated roles cannot bypass the trigger.
SET LOCAL ROLE service_role;

SELECT throws_ok(
  $$UPDATE care_briefs
    SET recipient_id = 'ee999999-0000-0000-0000-000000000099'
    WHERE id = 'bf000001-0000-0000-0000-000000000001'$$,
  'P0001', 'care_briefs.recipient_id is immutable',
  'service_role: UPDATE recipient_id is still blocked by trigger (above RLS)'
);

-- 4. service_role: UPDATE another column (title) passes through.
SELECT lives_ok(
  $$UPDATE care_briefs
    SET title = 'service_role title update'
    WHERE id = 'bf000001-0000-0000-0000-000000000001'$$,
  'service_role: UPDATE title (non-immutable column) is allowed'
);

-- 5. postgres role: UPDATE recipient_id → trigger fires, blocks it.
SET LOCAL ROLE postgres;

SELECT throws_ok(
  $$UPDATE care_briefs
    SET recipient_id = 'ee999999-0000-0000-0000-000000000099'
    WHERE id = 'bf000001-0000-0000-0000-000000000001'$$,
  'P0001', 'care_briefs.recipient_id is immutable',
  'postgres role: UPDATE recipient_id is still blocked by trigger'
);

-- 6. postgres role: UPDATE another column (title) passes through.
SELECT lives_ok(
  $$UPDATE care_briefs
    SET title = 'postgres title update'
    WHERE id = 'bf000001-0000-0000-0000-000000000001'$$,
  'postgres role: UPDATE title (non-immutable column) is allowed'
);

SELECT * FROM finish();
ROLLBACK;
