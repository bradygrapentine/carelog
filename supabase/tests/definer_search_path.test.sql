-- TD-217 + TD-207 (widened): search_path-pinning hardening for SECURITY DEFINER fns.
-- Fixture UUID prefix: 20260521-... to avoid collisions in the shared test session.
--
-- Coverage:
--   1. All 10 target functions have search_path = public, pg_temp pinned (proconfig),
--      keyed by full signature (regprocedure) + pronamespace=public so an accidental
--      overload or a same-named fn in another schema is NOT mistaken for the target.
--   2. No accidental overloads: exactly one pg_proc row per target name in public.
--   3. accept_invite is NOT EXECUTE-able by anon/authenticated (TD-129 regression
--      guard — CREATE OR REPLACE re-grants via Supabase default privileges).
--   4. The RLS-helper predicates REMAIN EXECUTE-able by authenticated (FIND-005's
--      proposed REVOKE was incorrect — RLS USING evaluates as the querying role,
--      so the caller needs EXECUTE; revoking crashes gated SELECTs).
--   5. Positive owner-context: a thread member can still SELECT their thread
--      (is_thread_member policy works for a normal authenticated user).

BEGIN;
SELECT plan(16);

-- ============================================================
-- 1. proconfig pinned on all 10 (signature-keyed, public-scoped)
-- ============================================================
SELECT ok((SELECT 'search_path=public, pg_temp' = ANY(proconfig) FROM pg_proc
  WHERE oid = 'public.user_can_access_recipient(uuid)'::regprocedure),
  'user_can_access_recipient pinned');
SELECT ok((SELECT 'search_path=public, pg_temp' = ANY(proconfig) FROM pg_proc
  WHERE oid = 'public.user_is_coordinator_for(uuid)'::regprocedure),
  'user_is_coordinator_for pinned');
SELECT ok((SELECT 'search_path=public, pg_temp' = ANY(proconfig) FROM pg_proc
  WHERE oid = 'public.user_in_org(uuid)'::regprocedure),
  'user_in_org pinned');
SELECT ok((SELECT 'search_path=public, pg_temp' = ANY(proconfig) FROM pg_proc
  WHERE oid = 'public.user_is_org_coordinator(uuid)'::regprocedure),
  'user_is_org_coordinator pinned');
SELECT ok((SELECT 'search_path=public, pg_temp' = ANY(proconfig) FROM pg_proc
  WHERE oid = 'public.user_is_org_member(uuid)'::regprocedure),
  'user_is_org_member pinned');
SELECT ok((SELECT 'search_path=public, pg_temp' = ANY(proconfig) FROM pg_proc
  WHERE oid = 'public.is_thread_member(uuid)'::regprocedure),
  'is_thread_member pinned');
SELECT ok((SELECT 'search_path=public, pg_temp' = ANY(proconfig) FROM pg_proc
  WHERE oid = 'public.find_dm_thread(uuid,uuid,uuid)'::regprocedure),
  'find_dm_thread pinned');
SELECT ok((SELECT 'search_path=public, pg_temp' = ANY(proconfig) FROM pg_proc
  WHERE oid = 'public.claim_outer_circle_slot(uuid,text,text,timestamptz)'::regprocedure),
  'claim_outer_circle_slot pinned (public, pg_temp — was public only)');
SELECT ok((SELECT 'search_path=public, pg_temp' = ANY(proconfig) FROM pg_proc
  WHERE oid = 'public.accept_invite(text,uuid,text)'::regprocedure),
  'accept_invite pinned (public, pg_temp — was public only)');
SELECT ok((SELECT 'search_path=public, pg_temp' = ANY(proconfig) FROM pg_proc
  WHERE oid = 'public.shift_questions_immutable_cols()'::regprocedure),
  'shift_questions_immutable_cols pinned');

-- ============================================================
-- 2. No accidental overloads — exactly one row per target name in public
-- ============================================================
SELECT is(
  (SELECT count(*)::int FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN (
       'user_can_access_recipient','user_is_coordinator_for','user_in_org',
       'user_is_org_coordinator','user_is_org_member','is_thread_member',
       'find_dm_thread','claim_outer_circle_slot','accept_invite',
       'shift_questions_immutable_cols')),
  10,
  'exactly 10 target functions in public — no CREATE OR REPLACE created an overload'
);

-- ============================================================
-- 3. accept_invite: TD-129 regression guard (CREATE OR REPLACE re-granted via
--    Supabase default privileges; the re-issued REVOKE must hold). Service-role
--    only — safe to revoke because it's invoked server-side, not in RLS.
-- ============================================================
SELECT is(has_function_privilege('anon', 'public.accept_invite(text,uuid,text)', 'EXECUTE'), false,
  'anon cannot EXECUTE accept_invite (TD-129 preserved)');
SELECT is(has_function_privilege('authenticated', 'public.accept_invite(text,uuid,text)', 'EXECUTE'), false,
  'authenticated cannot EXECUTE accept_invite (TD-129 preserved)');

-- ============================================================
-- 4. RLS-helper predicates MUST remain caller-executable (FIND-005 reversal).
--    RLS USING evaluates as the querying role; revoking would break gated SELECTs.
-- ============================================================
SELECT is(has_function_privilege('authenticated', 'public.is_thread_member(uuid)', 'EXECUTE'), true,
  'authenticated CAN EXECUTE is_thread_member (required for RLS policy eval)');
SELECT is(has_function_privilege('authenticated', 'public.user_is_org_member(uuid)', 'EXECUTE'), true,
  'authenticated CAN EXECUTE user_is_org_member (required for RLS policy eval)');

-- ============================================================
-- 4. Positive owner-context: REVOKE does not break RLS policy evaluation.
--    Policy "thread members can select" on message_threads calls the now-REVOKEd
--    public.is_thread_member(id). A member must still see their thread.
-- ============================================================
SET LOCAL ROLE postgres;
INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin) VALUES
  ('20260521-1001-0000-0000-000000000001', 'authenticated', 'authenticated',
   'member@td217.test', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;
INSERT INTO organizations (id, name, org_type) VALUES
  ('20260521-1000-0000-0000-000000000001', 'TD-217 Org', 'family') ON CONFLICT DO NOTHING;
INSERT INTO memberships (org_id, user_id, role, accepted_at) VALUES
  ('20260521-1000-0000-0000-000000000001', '20260521-1001-0000-0000-000000000001', 'coordinator', now())
ON CONFLICT DO NOTHING;
INSERT INTO public.message_threads (id, org_id, thread_type, created_by) VALUES
  ('20260521-1ee0-0000-0000-000000000001', '20260521-1000-0000-0000-000000000001', 'dm',
   '20260521-1001-0000-0000-000000000001') ON CONFLICT DO NOTHING;
INSERT INTO public.message_thread_members (thread_id, user_id) VALUES
  ('20260521-1ee0-0000-0000-000000000001', '20260521-1001-0000-0000-000000000001') ON CONFLICT DO NOTHING;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"20260521-1001-0000-0000-000000000001","role":"authenticated"}';
SELECT is(
  (SELECT count(*)::int FROM public.message_threads
   WHERE id = '20260521-1ee0-0000-0000-000000000001'),
  1,
  'thread member still SELECTs their thread — REVOKEd is_thread_member evaluates as owner (RLS unbroken)'
);

SET LOCAL ROLE postgres;
ROLLBACK;
