BEGIN;
SELECT plan(3);

-- ─── fixtures ────────────────────────────────────────────────────────────────
-- Reuse same UUIDs as ai_conversations_rls.test.sql to avoid re-seeding.

SET LOCAL ROLE postgres;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('aa220001-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'alice@ai-rls.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, org_type)
VALUES ('cc220000-0000-0000-0000-000000000001', 'AI Org', 'family')
ON CONFLICT DO NOTHING;

INSERT INTO memberships (org_id, user_id, role, accepted_at)
VALUES ('cc220000-0000-0000-0000-000000000001', 'aa220001-0000-0000-0000-000000000001', 'coordinator', now())
ON CONFLICT DO NOTHING;

-- ─── tests ───────────────────────────────────────────────────────────────────

SET LOCAL ROLE service_role;

-- 1. Exactly 50 messages should succeed
SELECT lives_ok(
  $$INSERT INTO ai_conversations (user_id, org_id, messages)
    VALUES (
      'aa220001-0000-0000-0000-000000000001',
      'cc220000-0000-0000-0000-000000000001',
      ARRAY(SELECT to_jsonb(i) FROM generate_series(1, 50) i)::jsonb[]
    )$$,
  'insert with exactly 50 messages succeeds (TD-132)'
);

-- 2. 51 messages must raise check_violation (23514)
SELECT throws_ok(
  $$INSERT INTO ai_conversations (user_id, org_id, messages)
    VALUES (
      'aa220001-0000-0000-0000-000000000001',
      'cc220000-0000-0000-0000-000000000001',
      ARRAY(SELECT to_jsonb(i) FROM generate_series(1, 51) i)::jsonb[]
    )$$,
  '23514',
  NULL,
  'insert with 51 messages violates ai_conversations_messages_cap (TD-132)'
);

-- 3. Empty array (NULL length) is allowed — default initial state
SELECT lives_ok(
  $$INSERT INTO ai_conversations (user_id, org_id, messages)
    VALUES (
      'aa220001-0000-0000-0000-000000000001',
      'cc220000-0000-0000-0000-000000000001',
      '{}'::jsonb[]
    )$$,
  'empty messages array allowed (array_length IS NULL path, TD-132)'
);

SELECT * FROM finish();
ROLLBACK;
