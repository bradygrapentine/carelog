-- TD-217 + TD-207 (widened per /owasp threat pass 2026-05-20): pin search_path
-- on every SECURITY DEFINER function in `public` that was unpinned or partial.
--
-- CVE-2018-1058: a SECURITY DEFINER function with an unpinned search_path that
-- references unqualified objects can be hijacked via an attacker-created temp
-- object (authenticated/anon can create temp tables; pg_temp is searched). Fix:
-- SET search_path = public, pg_temp (project idiom) on each.
--
-- ⚠ Supabase's platform default privileges GRANT EXECUTE ON FUNCTIONS TO anon,
-- authenticated for every function created in `public`. Every CREATE OR REPLACE
-- below therefore RE-GRANTS execute. Of these 10, only accept_invite carried an
-- explicit REVOKE (TD-129, 20260516000000) — so its REVOKEs are re-issued below
-- to avoid regressing that lockdown. The other 9 had no explicit REVOKE.
--
-- Bodies are byte-identical to their latest definitions; only the search_path
-- clause is added/changed. RLS policy logic is untouched.

-- ============================================================
-- core_schema.sql helpers (4) — were UNPINNED
-- ============================================================
CREATE OR REPLACE FUNCTION user_can_access_recipient(p_recipient_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   memberships m
    JOIN   care_recipients cr ON cr.org_id = m.org_id
    WHERE  cr.id           = p_recipient_id
      AND  m.user_id       = auth.uid()
      AND  m.accepted_at   IS NOT NULL
      AND  (m.recipient_id IS NULL OR m.recipient_id = p_recipient_id)
  )
$$;

CREATE OR REPLACE FUNCTION user_is_coordinator_for(p_recipient_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   memberships m
    JOIN   care_recipients cr ON cr.org_id = m.org_id
    WHERE  cr.id           = p_recipient_id
      AND  m.user_id       = auth.uid()
      AND  m.role          = 'coordinator'
      AND  m.accepted_at   IS NOT NULL
  )
$$;

CREATE OR REPLACE FUNCTION user_in_org(p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   memberships
    WHERE  org_id       = p_org_id
      AND  user_id      = auth.uid()
      AND  accepted_at  IS NOT NULL
  )
$$;

CREATE OR REPLACE FUNCTION user_is_org_coordinator(p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   memberships
    WHERE  org_id       = p_org_id
      AND  user_id      = auth.uid()
      AND  role         = 'coordinator'
      AND  accepted_at  IS NOT NULL
  )
$$;

-- ============================================================
-- symptom_readings.sql — user_is_org_member — was UNPINNED
-- ============================================================
CREATE OR REPLACE FUNCTION user_is_org_member(p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   memberships
    WHERE  org_id       = p_org_id
    AND    user_id      = auth.uid()
    AND    accepted_at  IS NOT NULL
  );
$$;

-- ============================================================
-- messaging.sql — is_thread_member + find_dm_thread — were UNPINNED
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_thread_member(p_thread_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.message_thread_members
    WHERE thread_id = p_thread_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.find_dm_thread(
  p_user_a uuid, p_user_b uuid, p_org_id uuid
) RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public, pg_temp AS $$
  SELECT t.id
  FROM public.message_threads t
  WHERE t.thread_type = 'dm'
    AND t.org_id = p_org_id
    AND (
      SELECT count(*) FROM public.message_thread_members m
      WHERE m.thread_id = t.id AND m.user_id IN (p_user_a, p_user_b)
    ) = 2
    AND (
      SELECT count(*) FROM public.message_thread_members m
      WHERE m.thread_id = t.id
    ) = 2
  LIMIT 1;
$$;

-- ============================================================
-- sec_high_fixes.sql — claim_outer_circle_slot — was PARTIAL (public only)
-- Body copied from sec_high_fixes.sql:25 (the latest definition).
-- ============================================================
CREATE OR REPLACE FUNCTION claim_outer_circle_slot(
  p_request_id  uuid,
  p_name        text,
  p_email       text,
  p_date        timestamptz DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  claim_id uuid;
BEGIN
  UPDATE outer_circle_requests
  SET    slots_filled = slots_filled + 1
  WHERE  id           = p_request_id
    AND  active       = true
    AND  slots_filled < slots_total;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'slot_unavailable';
  END IF;

  INSERT INTO outer_circle_claims (request_id, claimer_name, claimer_email, slot_date)
  VALUES (p_request_id, p_name, p_email, p_date)
  RETURNING id INTO claim_id;

  RETURN claim_id;
END;
$$;

-- ============================================================
-- atomic_invite_accept.sql — accept_invite — was PARTIAL (public only)
-- ============================================================
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

-- ============================================================
-- shift_questions.sql — shift_questions_immutable_cols — had NO search_path.
-- Keeps SECURITY INVOKER (body references only OLD/NEW, no table queries —
-- verified); search_path pinned for a uniform proconfig invariant.
-- ============================================================
CREATE OR REPLACE FUNCTION shift_questions_immutable_cols()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION 'shift_questions.org_id is immutable';
  END IF;
  IF NEW.recipient_id IS DISTINCT FROM OLD.recipient_id THEN
    RAISE EXCEPTION 'shift_questions.recipient_id is immutable';
  END IF;
  IF NEW.raised_by IS DISTINCT FROM OLD.raised_by THEN
    RAISE EXCEPTION 'shift_questions.raised_by is immutable';
  END IF;
  IF NEW.raised_at IS DISTINCT FROM OLD.raised_at THEN
    RAISE EXCEPTION 'shift_questions.raised_at is immutable';
  END IF;
  IF NEW.body IS DISTINCT FROM OLD.body THEN
    RAISE EXCEPTION 'shift_questions.body is immutable';
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- FIND-005 — NOT applied to these 4 (deliberate). The threat pass proposed
-- REVOKEing direct EXECUTE on user_is_coordinator_for / user_is_org_member /
-- is_thread_member / find_dm_thread as defense-in-depth, on the assumption that
-- RLS policies evaluate helper calls as the table owner. That is INCORRECT:
-- Postgres evaluates RLS USING/WITH CHECK expressions AS THE QUERYING ROLE, and
-- a function call requires the *caller* to hold EXECUTE (SECURITY DEFINER changes
-- the body's execution context, not the call-time permission check). The first
-- three are invoked inside RLS USING clauses (user_is_org_member: 10 policies,
-- is_thread_member: 4, user_is_coordinator_for: 1) → REVOKEing from authenticated
-- breaks (empirically: crashes) every gated SELECT for normal users. find_dm_thread
-- is a user-facing RPC called by authenticated. So all 4 MUST remain caller-
-- executable; the actual hardening for them is the pinned search_path above.
-- (Contrast accept_invite/confirm_ocr_job/task predicates, which are invoked
--  server-side as service_role and ARE correctly revoked.)
