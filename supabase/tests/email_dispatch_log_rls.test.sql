-- ON-71 Phase 2: pgTAP coverage for email_dispatch_log default-deny RLS +
-- composite unique constraint. Mirrors the patterns in
-- supabase/tests/confirm_ocr_job.test.sql.

BEGIN;
SELECT plan(7);

-- ─── 1. Schema sanity ────────────────────────────────────────────────────────

SELECT has_table(
  'public',
  'email_dispatch_log',
  'email_dispatch_log table exists'
);

SELECT has_index(
  'public',
  'email_dispatch_log',
  'email_dispatch_log_kind_dedup_unique',
  ARRAY['kind', 'dedup_key'],
  'composite UNIQUE constraint on (kind, dedup_key) is enforced'
);

-- ─── 2. RLS is ENABLED (default-deny for non-bypass roles) ───────────────────

SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.email_dispatch_log'::regclass),
  true,
  'ROW LEVEL SECURITY is enabled on email_dispatch_log'
);

SELECT is(
  (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'email_dispatch_log'),
  0,
  'NO policies on email_dispatch_log (RLS-enabled + no policies = default-deny for anon and authenticated)'
);

-- ─── 3. Anon + authenticated cannot SELECT ──────────────────────────────────

SET LOCAL ROLE anon;
SELECT is_empty(
  $$ SELECT * FROM email_dispatch_log $$,
  'anon cannot SELECT from email_dispatch_log (default-deny under RLS)'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT is_empty(
  $$ SELECT * FROM email_dispatch_log $$,
  'authenticated cannot SELECT from email_dispatch_log (default-deny under RLS)'
);
RESET ROLE;

-- ─── 4. Composite unique constraint defeats duplicates ──────────────────────

INSERT INTO email_dispatch_log (org_id, recipient_id, kind, dedup_key)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'refill',
  'refill:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb:2026-W21'
);

SELECT throws_ok(
  $$
    INSERT INTO email_dispatch_log (org_id, recipient_id, kind, dedup_key)
    VALUES (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'refill',
      'refill:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb:2026-W21'
    );
  $$,
  '23505',
  NULL,
  'composite unique on (kind, dedup_key) raises 23505 on duplicate'
);

SELECT * FROM finish();
ROLLBACK;
