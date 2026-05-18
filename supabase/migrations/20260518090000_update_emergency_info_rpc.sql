-- TD-179: collapse update_emergency_info into one atomic RPC.
--
-- Prior implementation at apps/web/server/repositories/identityRepository.ts
-- (updateEmergencyInfo) did read-merge-write in JS:
--   1. SELECT contact_info
--   2. JS merge with patch
--   3. UPDATE with full merged blob
--
-- Under concurrent writers (~ms window), writer A's merge could see the pre-B
-- state and silently overwrite B's field on UPDATE. Not a 409 — a silent
-- revert. This RPC replaces the 3-step JS dance with a single atomic UPDATE
-- whose merge runs server-side via jsonb operator (||).
--
-- SQLSTATE codes (LOCKED — JS branches on error.code, not on error.message):
--   P0002 (no_data_found)    → recipient_not_found
--   45IDF (user-defined 45*) → identity_not_found
-- P0003 is NOT free — Postgres reserves it for too_many_rows.

CREATE OR REPLACE FUNCTION public.update_emergency_info(
  p_org_id        uuid,
  p_recipient_id  uuid,
  p_patch         jsonb
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
DECLARE
  v_token  uuid;
  v_result jsonb;
BEGIN
  -- 1. Resolve identity_token via care_recipients (enforces org boundary).
  SELECT identity_token INTO v_token
  FROM   care_recipients
  WHERE  id = p_recipient_id AND org_id = p_org_id;

  IF v_token IS NULL THEN
    RAISE EXCEPTION 'recipient_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- 2. Atomic merge: shallow top-level || then strip nulls.
  -- jsonb_strip_nulls implements the "patch null/empty → clear key" semantics
  -- the prior JS impl carried (identityRepository.ts:131-149 pre-refactor).
  UPDATE identity_vault
  SET    contact_info = jsonb_strip_nulls(
           COALESCE(contact_info, '{}'::jsonb) || p_patch
         )
  WHERE  token = v_token AND org_id = p_org_id
  RETURNING contact_info INTO v_result;

  IF v_result IS NULL THEN
    -- Vault row missing for a recipient that resolved a token. Distinct from
    -- recipient_not_found so the JS layer can disambiguate without string
    -- matching the message.
    RAISE EXCEPTION 'identity_not_found' USING ERRCODE = '45IDF';
  END IF;

  RETURN v_result;
END;
$$;

-- Lock down: identity_vault is the PHI boundary. Service role only (matches
-- supabaseAdmin caller chain at apps/web/server/supabaseAdmin.server.ts).
REVOKE ALL ON FUNCTION public.update_emergency_info(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.update_emergency_info(uuid, uuid, jsonb) TO service_role;

COMMENT ON FUNCTION public.update_emergency_info IS
  'Atomic shallow top-level merge (||) of emergency info patch into identity_vault.contact_info. '
  'Nested objects are replaced wholesale, NOT deep-merged (matches prior JS impl semantics). '
  'jsonb_strip_nulls implements null-as-clear-key semantics. '
  'Eliminates read-merge-write race. SECURITY DEFINER + org_id check + service_role-only.';
