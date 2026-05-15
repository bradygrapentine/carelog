-- TD-129: explicitly REVOKE EXECUTE on accept_invite from anon + authenticated.
--
-- The original migration `20260407000000_atomic_invite_accept.sql` declared:
--   REVOKE EXECUTE ON FUNCTION accept_invite(text, uuid, text) FROM PUBLIC;
--   GRANT  EXECUTE ON FUNCTION accept_invite(text, uuid, text) TO service_role;
--
-- That intent ("only service_role can call this") is NOT actually enforced
-- because Supabase's default privileges (set by `supabase_admin` via
-- `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO
-- anon, authenticated`) automatically grant EXECUTE to those two roles on
-- every function created in the `public` schema. REVOKE FROM PUBLIC doesn't
-- touch role-explicit grants.
--
-- Pre-fix ACL observed in local DB:
--   {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
--
-- Surfaced by pgTAP case 8 in `supabase/tests/invite_tokens_rls.test.sql`
-- which expected `authenticated` to raise 42501 but caught no exception.
--
-- Risk profile: the SQL function is not currently invoked from app code
-- (`acceptInvite` in `membershipsRepository.ts:157` does direct table
-- writes via supabaseAdmin), but `anon` could craft a PostgREST RPC call
-- to it directly. The function's own SECURITY DEFINER business logic
-- (email match, token validation, expiry check) blocks completion, but
-- the rate-limit / DoS surface is open. This migration closes that.

REVOKE EXECUTE ON FUNCTION accept_invite(text, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION accept_invite(text, uuid, text) FROM authenticated;
