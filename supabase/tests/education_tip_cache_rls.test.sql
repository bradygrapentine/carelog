BEGIN;
SELECT plan(5);

-- Setup
SELECT tests.create_supabase_user('member@example.com', 'password123');
SELECT tests.create_supabase_user('outsider@example.com', 'password123');

-- Seed
INSERT INTO organizations (id, name) VALUES ('org-edu-1', 'Edu Org');
INSERT INTO memberships (org_id, user_id, role, accepted_at)
  VALUES ('org-edu-1',
          (SELECT id FROM auth.users WHERE email = 'member@example.com'),
          'caregiver', now());
INSERT INTO education_tip_cache (org_id, guide_slug)
  VALUES ('org-edu-1', 'sundowning');

-- 1. Member can read own org tip
SELECT tests.authenticate_as('member@example.com');
SELECT results_eq(
  $$ SELECT guide_slug FROM education_tip_cache WHERE org_id = 'org-edu-1' $$,
  $$ VALUES ('sundowning'::text) $$,
  'member can read own org tip'
);

-- 2. Outsider cannot read
SELECT tests.authenticate_as('outsider@example.com');
SELECT is_empty(
  $$ SELECT * FROM education_tip_cache WHERE org_id = 'org-edu-1' $$,
  'outsider cannot read another org tip'
);

-- 3. Anon cannot read
SELECT tests.clear_authentication();
SELECT is_empty(
  $$ SELECT * FROM education_tip_cache $$,
  'anon cannot read education_tip_cache'
);

-- 4. Member cannot insert (service role only)
SELECT tests.authenticate_as('member@example.com');
SELECT throws_ok(
  $$ INSERT INTO education_tip_cache (org_id, guide_slug) VALUES ('org-edu-1', 'wandering') $$,
  '42501',
  NULL,
  'member cannot insert into education_tip_cache'
);

-- 5. Member cannot update
SELECT throws_ok(
  $$ UPDATE education_tip_cache SET guide_slug = 'wandering' WHERE org_id = 'org-edu-1' $$,
  '42501',
  NULL,
  'member cannot update education_tip_cache'
);

SELECT * FROM finish();
ROLLBACK;
