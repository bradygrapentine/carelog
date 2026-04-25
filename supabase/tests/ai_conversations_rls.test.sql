BEGIN;
SELECT plan(5);

-- ─── fixtures ────────────────────────────────────────────────────────────────

SET LOCAL ROLE postgres;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('aa220001-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'alice@ai-rls.com', now(), now(), now(), '{}', '{}', false),
  ('bb220002-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'bob@ai-rls.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, org_type)
VALUES ('cc220000-0000-0000-0000-000000000001', 'AI Org', 'family')
ON CONFLICT DO NOTHING;

INSERT INTO memberships (org_id, user_id, role, accepted_at)
VALUES ('cc220000-0000-0000-0000-000000000001', 'aa220001-0000-0000-0000-000000000001', 'coordinator', now())
ON CONFLICT DO NOTHING;

-- Insert a conversation for Alice (bypass RLS as postgres)
INSERT INTO ai_conversations (user_id, org_id, messages)
VALUES (
  'aa220001-0000-0000-0000-000000000001',
  'cc220000-0000-0000-0000-000000000001',
  '{}')
ON CONFLICT DO NOTHING;

-- ─── tests ───────────────────────────────────────────────────────────────────

-- 1. Alice reads own conversations
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"aa220001-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int FROM ai_conversations WHERE org_id = 'cc220000-0000-0000-0000-000000000001'$$,
  ARRAY[1]::int[],
  'alice reads own conversation'
);

-- 2. Bob cannot read Alice's conversations
SET LOCAL "request.jwt.claims" TO '{"sub":"bb220002-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT is_empty(
  $$SELECT * FROM ai_conversations$$,
  'bob cannot read alice conversations'
);

-- 3. Anon blocked
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" TO '{"role":"anon"}';

SELECT is_empty(
  $$SELECT * FROM ai_conversations$$,
  'anon blocked from ai_conversations'
);

-- 4. Bob cannot insert for Alice's org
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"bb220002-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT throws_ok(
  $$INSERT INTO ai_conversations (user_id, org_id, messages)
    VALUES ('aa220001-0000-0000-0000-000000000001', 'cc220000-0000-0000-0000-000000000001', '{}')$$,
  '42501',
  NULL,
  'bob cannot insert as alice'
);

-- 5. ai_assistant_enabled defaults to false
SET LOCAL "request.jwt.claims" TO '{"sub":"aa220001-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT results_eq(
  $$SELECT ai_assistant_enabled FROM user_profiles WHERE id = 'aa220001-0000-0000-0000-000000000001'$$,
  ARRAY[false]::boolean[],
  'ai_assistant_enabled defaults to false'
);

SELECT * FROM finish();
ROLLBACK;
