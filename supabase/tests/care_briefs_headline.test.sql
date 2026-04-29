BEGIN;
SELECT plan(4);

-- Setup: org, user, recipient, brief.
INSERT INTO organizations (id, name, org_type) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Test Org', 'family');

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES (
  '00000000-0000-0000-0000-000000000010', 'authenticated', 'authenticated',
  'inviter@example.com', now(), now(), now(), '{}', '{}', false
);

-- care_recipients FKs identity_vault for the recipient's name.
INSERT INTO identity_vault (token, org_id, full_name) VALUES
  ('00000000-0000-0000-0000-000000000030',
   '00000000-0000-0000-0000-000000000001',
   'Eleanor');

INSERT INTO care_recipients (id, org_id, identity_token) VALUES
  ('00000000-0000-0000-0000-000000000020',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000030');

-- Test 1: headline column exists.
SELECT has_column(
  'public', 'care_briefs', 'headline',
  'care_briefs has headline column'
);

-- Test 2: insert with structured headline succeeds.
INSERT INTO care_briefs (
  org_id, recipient_id, content, created_by, headline
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000020',
  '{"recent_entries": []}'::jsonb,
  '00000000-0000-0000-0000-000000000010',
  '[{"text": "Mom slept "}, {"text": "poorly", "em": true}, {"text": "."}]'::jsonb
);

SELECT results_eq(
  $$ SELECT jsonb_array_length(headline) FROM care_briefs LIMIT 1 $$,
  ARRAY[3]::int[],
  'headline persists as a 3-span array'
);

SELECT results_eq(
  $$ SELECT (headline -> 1 ->> 'text') FROM care_briefs LIMIT 1 $$,
  ARRAY['poorly'],
  'second span text round-trips'
);

-- Test 3: NULL is allowed for legacy briefs.
INSERT INTO care_briefs (
  org_id, recipient_id, content, created_by
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000020',
  '{"recent_entries": []}'::jsonb,
  '00000000-0000-0000-0000-000000000010'
);

SELECT is(
  (SELECT count(*)::int FROM care_briefs WHERE headline IS NULL),
  1,
  'headline accepts NULL for legacy rows'
);

SELECT * FROM finish();
ROLLBACK;
