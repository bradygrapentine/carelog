-- TD-208 — accept_invite: guard the membership-activation UPDATE with a
-- ROW_COUNT check so a missing/stale membership row can no longer return a
-- phantom success=true.
--
-- Before: the token-consume UPDATE was ROW_COUNT-guarded, but the subsequent
-- `UPDATE memberships … WHERE id = v_invite.membership_id` set success:=true
-- unconditionally. If that row were absent the caller was told the membership
-- activated when it had not. Low severity (membership_id is FK-derived from the
-- invite) but a real defensive gap.
--
-- Body is byte-identical to the canonical definition in
-- 20260521000000_pin_search_path_definer_fns.sql EXCEPT the new ROW_COUNT guard
-- after the memberships UPDATE. SECURITY DEFINER + `SET search_path =
-- public, pg_temp` preserved (CVE-2018-1058 hardening, TD-217). The two REVOKEs
-- below re-assert the TD-129 lockdown that CREATE OR REPLACE re-grants via
-- Supabase default privileges (service_role keeps execute via its own grant in
-- 20260516000000). See supabase/CLAUDE.md §SECURITY DEFINER + RLS.

CREATE OR REPLACE FUNCTION accept_invite(
  p_token   text,
  p_user_id uuid,
  p_email   text
) RETURNS invite_accept_result
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
DECLARE
  v_invite        invite_tokens%ROWTYPE;
  v_rows_consumed integer;
  v_result        invite_accept_result;
BEGIN
  -- Fetch the invite. Include consumed tokens so we can distinguish
  -- "not found / expired" from "already used".
  SELECT * INTO v_invite
  FROM   invite_tokens
  WHERE  token = p_token
    AND  expires_at > now()
  LIMIT  1;

  IF NOT FOUND THEN
    v_result.success := false;
    v_result.error   := 'not_found';
    RETURN v_result;
  END IF;

  -- Check email match before touching anything.
  IF lower(trim(v_invite.email)) <> lower(trim(p_email)) THEN
    v_result.success := false;
    v_result.error   := 'email_mismatch';
    RETURN v_result;
  END IF;

  -- Atomically claim the token. If another request already consumed it,
  -- no rows are updated and we return already_used.
  UPDATE invite_tokens
  SET    consumed_at = now()
  WHERE  id          = v_invite.id
    AND  consumed_at IS NULL;

  GET DIAGNOSTICS v_rows_consumed = ROW_COUNT;

  IF v_rows_consumed = 0 THEN
    v_result.success := false;
    v_result.error   := 'already_used';
    RETURN v_result;
  END IF;

  -- Token claimed — activate the membership.
  UPDATE memberships
  SET    user_id     = p_user_id,
         accepted_at = now()
  WHERE  id = v_invite.membership_id;

  -- TD-208 guard: if the membership row is missing/stale the UPDATE matches 0
  -- rows. Fail closed rather than report a phantom activation. Reuses
  -- v_rows_consumed (reassigned after the token-consume branch).
  GET DIAGNOSTICS v_rows_consumed = ROW_COUNT;

  IF v_rows_consumed = 0 THEN
    v_result.success := false;
    v_result.error   := 'membership_not_found';
    RETURN v_result;
  END IF;

  v_result.success := true;
  v_result.error   := null;
  RETURN v_result;
END;
$$;

-- Preserve TD-129 lockdown: the CREATE OR REPLACE above re-granted EXECUTE to
-- anon+authenticated via Supabase default privileges. Re-revoke (service_role
-- retains execute via its own grant in 20260516000000).
REVOKE EXECUTE ON FUNCTION accept_invite(text, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION accept_invite(text, uuid, text) FROM authenticated;
