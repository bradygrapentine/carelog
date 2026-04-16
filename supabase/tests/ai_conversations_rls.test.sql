BEGIN;
SELECT plan(5);

SELECT tests.create_supabase_user('alice@example.com', 'password123');
SELECT tests.create_supabase_user('bob@example.com', 'password123');

INSERT INTO organizations (id, name) VALUES ('org-ai-1', 'AI Org');
INSERT INTO memberships (org_id, user_id, role, accepted_at)
  VALUES ('org-ai-1', (SELECT id FROM auth.users WHERE email = 'alice@example.com'), 'coordinator', now());

-- Alice inserts a conversation
SELECT tests.authenticate_as('alice@example.com');
INSERT INTO ai_conversations (user_id, org_id, messages)
  VALUES ((SELECT id FROM auth.users WHERE email = 'alice@example.com'), 'org-ai-1', '{}');

-- 1. Alice reads own conversations
SELECT results_eq(
  $$ SELECT count(*)::int FROM ai_conversations WHERE org_id = 'org-ai-1' $$,
  $$ VALUES (1) $$,
  'alice reads own conversation'
);

-- 2. Bob cannot read Alice's conversations
SELECT tests.authenticate_as('bob@example.com');
SELECT is_empty(
  $$ SELECT * FROM ai_conversations $$,
  'bob cannot read alice conversations'
);

-- 3. Anon blocked
SELECT tests.clear_authentication();
SELECT is_empty(
  $$ SELECT * FROM ai_conversations $$,
  'anon blocked from ai_conversations'
);

-- 4. Bob cannot insert for Alice's org
SELECT tests.authenticate_as('bob@example.com');
SELECT throws_ok(
  $$ INSERT INTO ai_conversations (user_id, org_id) VALUES
     ((SELECT id FROM auth.users WHERE email = 'alice@example.com'), 'org-ai-1') $$,
  '42501',
  NULL,
  'bob cannot insert as alice'
);

-- 5. ai_assistant_enabled defaults to false
SELECT tests.authenticate_as('alice@example.com');
SELECT results_eq(
  $$ SELECT ai_assistant_enabled FROM user_profiles
     WHERE id = (SELECT id FROM auth.users WHERE email = 'alice@example.com') $$,
  $$ VALUES (false) $$,
  'ai_assistant_enabled defaults to false'
);

SELECT * FROM finish();
ROLLBACK;
