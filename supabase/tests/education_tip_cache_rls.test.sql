BEGIN;
SELECT plan(9);

-- ─── fixtures ────────────────────────────────────────────────────────────────

SET LOCAL ROLE postgres;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('aa160001-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'member@edu-rls.com', now(), now(), now(), '{}', '{}', false),
  ('bb160002-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'outsider@edu-rls.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, org_type)
VALUES ('00000000-0000-0000-0000-000000000010', 'Edu Org', 'family')
ON CONFLICT DO NOTHING;

INSERT INTO memberships (org_id, user_id, role, accepted_at)
VALUES ('00000000-0000-0000-0000-000000000010', 'aa160001-0000-0000-0000-000000000001', 'caregiver', now())
ON CONFLICT DO NOTHING;

-- Seed tip as postgres (bypasses RLS; FORCE ROW LEVEL SECURITY applies to non-superuser postgres too,
-- but pgTAP runs as superuser so this works)
INSERT INTO education_tip_cache (org_id, guide_slug)
VALUES ('00000000-0000-0000-0000-000000000010', 'sundowning')
ON CONFLICT DO NOTHING;

-- ─── tests ───────────────────────────────────────────────────────────────────

-- 1. Member can read own org tip
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"aa160001-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT results_eq(
  $$SELECT guide_slug FROM education_tip_cache WHERE org_id = '00000000-0000-0000-0000-000000000010'$$,
  ARRAY['sundowning'::text],
  'member can read own org tip'
);

-- 2. Outsider cannot read
SET LOCAL "request.jwt.claims" TO '{"sub":"bb160002-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT is_empty(
  $$SELECT * FROM education_tip_cache WHERE org_id = '00000000-0000-0000-0000-000000000010'$$,
  'outsider cannot read another org tip'
);

-- 3. Anon cannot read
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" TO '{"role":"anon"}';

SELECT is_empty(
  $$SELECT * FROM education_tip_cache$$,
  'anon cannot read education_tip_cache'
);

-- 4. Member cannot insert (service role only — no permissive INSERT policy)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"aa160001-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT throws_ok(
  $$INSERT INTO education_tip_cache (org_id, guide_slug) VALUES ('00000000-0000-0000-0000-000000000010', 'wandering')$$,
  '42501',
  NULL,
  'member cannot insert into education_tip_cache'
);

-- 5. Member cannot delete (explicit deny policy USING (false) — RLS silently skips)
SELECT lives_ok(
  $$DELETE FROM education_tip_cache WHERE org_id = '00000000-0000-0000-0000-000000000010'$$,
  'member DELETE does not throw (deny policy silently skips)'
);

-- Verify the row still exists after the silently-skipped DELETE
SET LOCAL ROLE postgres;
SELECT results_eq(
  $$SELECT count(*)::int FROM education_tip_cache WHERE org_id = '00000000-0000-0000-0000-000000000010'$$,
  ARRAY[1]::int[],
  'education_tip_cache row still exists after member DELETE attempt'
);
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"aa160001-0000-0000-0000-000000000001","role":"authenticated"}';

-- 6. Member UPDATE silently no-ops (no permissive UPDATE policy = 0 rows affected, no throw)
SELECT lives_ok(
  $$UPDATE education_tip_cache SET guide_slug = 'wandering' WHERE org_id = '00000000-0000-0000-0000-000000000010'$$,
  'member UPDATE does not throw'
);

-- 7. Verify UPDATE did not change data (RLS silently skipped 0 rows)
-- Re-read as member (SELECT is allowed)
SELECT results_eq(
  $$SELECT guide_slug FROM education_tip_cache WHERE org_id = '00000000-0000-0000-0000-000000000010'$$,
  ARRAY['sundowning'::text],
  'member UPDATE did not change guide_slug'
);

-- 8. Outsider cannot update either
SET LOCAL "request.jwt.claims" TO '{"sub":"bb160002-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT lives_ok(
  $$UPDATE education_tip_cache SET guide_slug = 'wandering' WHERE org_id = '00000000-0000-0000-0000-000000000010'$$,
  'outsider UPDATE does not throw (RLS silently skips)'
);

SELECT * FROM finish();
ROLLBACK;
