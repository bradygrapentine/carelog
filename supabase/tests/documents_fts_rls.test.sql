BEGIN;
SELECT plan(4);

-- ─── fixtures ────────────────────────────────────────────────────────────────

SET LOCAL ROLE postgres;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('aa111111-1111-4000-0000-000000000001', 'authenticated', 'authenticated',
   'coord_a@fts-rls.com', now(), now(), now(), '{}', '{}', false),
  ('bb222222-2222-4000-0000-000000000002', 'authenticated', 'authenticated',
   'coord_b@fts-rls.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

-- Org A
INSERT INTO organizations (id, name, org_type)
VALUES ('aaaaaaaa-0000-4000-0000-000000000001', 'FTS Org A', 'family')
ON CONFLICT DO NOTHING;

INSERT INTO identity_vault (org_id, full_name)
VALUES ('aaaaaaaa-0000-4000-0000-000000000001', 'FTS Recipient A')
ON CONFLICT DO NOTHING;

INSERT INTO care_recipients (id, org_id, identity_token)
SELECT 'aaaaaaaa-1111-4000-0000-000000000001', 'aaaaaaaa-0000-4000-0000-000000000001', token
FROM identity_vault WHERE org_id = 'aaaaaaaa-0000-4000-0000-000000000001' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO memberships (org_id, user_id, role, accepted_at)
VALUES ('aaaaaaaa-0000-4000-0000-000000000001', 'aa111111-1111-4000-0000-000000000001', 'coordinator', now())
ON CONFLICT DO NOTHING;

-- Org B
INSERT INTO organizations (id, name, org_type)
VALUES ('bbbbbbbb-0000-4000-0000-000000000002', 'FTS Org B', 'family')
ON CONFLICT DO NOTHING;

INSERT INTO identity_vault (org_id, full_name)
VALUES ('bbbbbbbb-0000-4000-0000-000000000002', 'FTS Recipient B')
ON CONFLICT DO NOTHING;

INSERT INTO care_recipients (id, org_id, identity_token)
SELECT 'bbbbbbbb-1111-4000-0000-000000000002', 'bbbbbbbb-0000-4000-0000-000000000002', token
FROM identity_vault WHERE org_id = 'bbbbbbbb-0000-4000-0000-000000000002' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO memberships (org_id, user_id, role, accepted_at)
VALUES ('bbbbbbbb-0000-4000-0000-000000000002', 'bb222222-2222-4000-0000-000000000002', 'coordinator', now())
ON CONFLICT DO NOTHING;

-- Doc A: contains text about "Dr. Chen"
INSERT INTO documents (id, org_id, recipient_id, uploaded_by, display_name, doc_type, storage_path, extracted_text)
VALUES (
  'dddddddd-aaaa-4000-0000-000000000001',
  'aaaaaaaa-0000-4000-0000-000000000001',
  'aaaaaaaa-1111-4000-0000-000000000001',
  'aa111111-1111-4000-0000-000000000001',
  'POA for Mom',
  'power_of_attorney',
  'aaaaaaaa-0000-4000-0000-000000000001/doc-a.pdf',
  'This power of attorney was signed in front of Dr. Chen on January 1st.'
) ON CONFLICT DO NOTHING;

-- Doc B (different org): also mentions "Dr. Chen" — Org A coordinator must NOT see this
INSERT INTO documents (id, org_id, recipient_id, uploaded_by, display_name, doc_type, storage_path, extracted_text)
VALUES (
  'dddddddd-bbbb-4000-0000-000000000002',
  'bbbbbbbb-0000-4000-0000-000000000002',
  'bbbbbbbb-1111-4000-0000-000000000002',
  'bb222222-2222-4000-0000-000000000002',
  'Advance Directive',
  'advance_directive',
  'bbbbbbbb-0000-4000-0000-000000000002/doc-b.pdf',
  'Reviewed by Dr. Chen at City Hospital.'
) ON CONFLICT DO NOTHING;

-- ─── tests ───────────────────────────────────────────────────────────────────

-- 1. Coordinator in Org A searching "Chen" sees only Org A doc in their org scope
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"aa111111-1111-4000-0000-000000000001","role":"authenticated"}';

SELECT results_eq(
  $$SELECT count(*)::int
    FROM documents
    WHERE org_id = 'aaaaaaaa-0000-4000-0000-000000000001'
    AND extracted_text_tsv @@ websearch_to_tsquery('english', 'Chen')$$,
  ARRAY[1]::int[],
  'coordinator in Org A finds exactly one FTS match in their own org'
);

-- 2. Coordinator in Org A cannot read Org B documents at all (RLS)
SELECT results_eq(
  $$SELECT count(*)::int FROM documents WHERE org_id = 'bbbbbbbb-0000-4000-0000-000000000002'$$,
  ARRAY[0]::int[],
  'coordinator in Org A cannot see Org B documents'
);

-- 3. Global FTS for "Chen" returns only Org A doc (RLS scopes the result)
SELECT results_eq(
  $$SELECT count(*)::int
    FROM documents
    WHERE extracted_text_tsv @@ websearch_to_tsquery('english', 'Chen')$$,
  ARRAY[1]::int[],
  'global FTS for Chen is scoped to org A only for Org A coordinator'
);

-- 4. Unauthenticated (anon role) cannot read documents
SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" TO '{}';

SELECT results_eq(
  $$SELECT count(*)::int FROM documents$$,
  ARRAY[0]::int[],
  'anon cannot read any documents'
);

SELECT * FROM finish();
ROLLBACK;
