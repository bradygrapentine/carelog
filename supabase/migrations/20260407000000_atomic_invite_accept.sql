-- Atomically consumes an invite token and activates the pending membership.
-- Returns a composite: (success boolean, error text).
-- error is NULL on success. success is FALSE on error.
--
-- Errors:
--   not_found      — no unconsumed, unexpired token matches p_token
--   email_mismatch — token email does not match p_email (normalized)
--   already_used   — token was already consumed (concurrent accept)

CREATE TYPE invite_accept_result AS (
  success boolean,
  error   text
);

CREATE OR REPLACE FUNCTION accept_invite(
  p_token   text,
  p_user_id uuid,
  p_email   text
) RETURNS invite_accept_result
  LANGUAGE plpgsql
  SECURITY DEFINER
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

  v_result.success := true;
  v_result.error   := null;
  RETURN v_result;
END;
$$;

-- Only service role can call this function directly.
REVOKE EXECUTE ON FUNCTION accept_invite(text, uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION accept_invite(text, uuid, text) TO service_role;
