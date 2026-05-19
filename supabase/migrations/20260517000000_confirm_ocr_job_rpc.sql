-- TD-144: collapse OCR confirm into one transaction.
--
-- Prior route at apps/web/app/api/ocr/confirm/route.ts performed 3 sequential
-- writes (audit insert, medication insert, optimistic-lock status flip). A
-- concurrent confirm on the same job_id could win past the audit insert and
-- both insert medication rows before either reached the optimistic UPDATE.
-- The optimistic-lock returned 409 to the loser but its medication row had
-- already committed → silent duplicate.
--
-- This RPC collapses audit + medication + status flip under one FOR UPDATE
-- on ocr_jobs. The route handler keeps its coordinator-membership check and
-- the pre-RPC raw_text read (needed to compute the SHA-256 hash in JS so the
-- test suite can assert the hash deterministically; pgcrypto stays out).
--
-- Threat model: .claude/state/owasp-threat-td-144.md (T1–T5 all controlled).
-- State machine source of truth: apps/web/lib/ocr/jobStateMachine.ts —
-- `confirmed` is reachable ONLY from `needs_review`.

CREATE TYPE confirm_ocr_job_result AS (
  success boolean,
  -- Sentinel values: 'not_found' | 'not_pending' | 'org_mismatch' | 'already_confirmed' | NULL.
  -- `not_pending` is the name kept for caller back-compat; semantically it
  -- means "status is not needs_review and not confirmed" (covers pending,
  -- processing, failed, and any future non-needs_review state).
  error text
);

CREATE OR REPLACE FUNCTION confirm_ocr_job(
  p_user_id              uuid,
  p_org_id               uuid,
  p_job_id               uuid,
  p_drug_name            text,
  p_dosage               text,
  p_instructions         text,
  p_raw_output_hash      bytea,
  p_confirmed_field_keys text[]
) RETURNS confirm_ocr_job_result
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_temp
AS $$
DECLARE
  v_job    ocr_jobs%ROWTYPE;
  v_result confirm_ocr_job_result;
BEGIN
  -- T3 (race): lock the row before any writes. A concurrent caller waits here
  -- and then observes status='confirmed', exiting via the already_confirmed
  -- branch with no inserts.
  --
  -- FOR UPDATE is load-bearing: removes the race when two concurrent confirms
  -- target the same job. Removing this without an advisory-lock equivalent is
  -- a regression — both transactions would observe status='needs_review',
  -- both pass the guard, and both insert duplicate audit + medication rows.
  -- See supabase/tests/confirm_ocr_job.test.sql Case 5 for the (single-tx)
  -- post-lock guard test and a note on the concurrent-waiter coverage gap.
  SELECT * INTO v_job
  FROM   ocr_jobs
  WHERE  id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    v_result.success := false;
    v_result.error   := 'not_found';
    RETURN v_result;
  END IF;

  -- T1 (privilege escalation defense in depth): validate org against the row.
  IF v_job.org_id <> p_org_id THEN
    v_result.success := false;
    v_result.error   := 'org_mismatch';
    RETURN v_result;
  END IF;

  IF v_job.status = 'confirmed' THEN
    v_result.success := false;
    v_result.error   := 'already_confirmed';
    RETURN v_result;
  END IF;

  -- State machine: confirmed ← needs_review only. See jobStateMachine.ts.
  IF v_job.status <> 'needs_review' THEN
    v_result.success := false;
    v_result.error   := 'not_pending';
    RETURN v_result;
  END IF;

  INSERT INTO ocr_audit_log (
    ocr_job_id, org_id_snapshot, user_id,
    raw_output_hash, confirmed_field_keys, field_count
  ) VALUES (
    p_job_id, p_org_id, p_user_id,
    p_raw_output_hash, p_confirmed_field_keys,
    -- array_length returns NULL for empty array; ocr_audit_log.field_count is
    -- NOT NULL CHECK (>= 0). Coalesce to 0.
    COALESCE(array_length(p_confirmed_field_keys, 1), 0)
  );

  -- medications has no created_by column (verified against core_schema.sql
  -- and apps/web/lib/database.types.ts:964). The prior route passed created_by
  -- but PostgREST silently dropped it. Match the actual schema; if/when a
  -- created_by column lands via separate migration, widen the INSERT and the
  -- function signature in one PR.
  INSERT INTO medications (
    org_id, recipient_id, drug_name, dosage, instructions, scan_source
  ) VALUES (
    p_org_id, v_job.recipient_id, p_drug_name, p_dosage,
    NULLIF(p_instructions, ''), 'ocr_scan'
  );

  UPDATE ocr_jobs SET status = 'confirmed' WHERE id = p_job_id;

  v_result.success := true;
  v_result.error   := NULL;
  RETURN v_result;
END;
$$;

-- T1: only service_role (used by apps/web/server/supabaseAdmin.server.ts) may
-- call. anon and authenticated JWTs cannot reach this function even though
-- SECURITY DEFINER would otherwise grant them definer privileges.
REVOKE EXECUTE ON FUNCTION confirm_ocr_job(uuid,uuid,uuid,text,text,text,bytea,text[]) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION confirm_ocr_job(uuid,uuid,uuid,text,text,text,bytea,text[]) TO service_role;

COMMENT ON FUNCTION confirm_ocr_job IS
  'TD-144: collapses audit insert + medication insert + status flip into one tx, eliminating the medication-duplication race in the prior 3-statement pattern at apps/web/app/api/ocr/confirm/route.ts.';
