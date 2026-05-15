-- SEC-007: OCR confirm audit log (FIND-003 part 3).
-- Append-only forensic trail of OCR confirm events. PHI-free by construction:
-- stores only field-key allowlist + SHA-256 hashes, never values or raw text.
-- See docs/plans/2026-05-15-security-audit-pair.md for threat model and
-- .claude/state/owasp-threat-security-audit-pair.md for the 14-finding matrix.

CREATE TABLE ocr_audit_log (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ocr_job_id            uuid        NOT NULL,            -- denormalized snapshot, no FK (survives parent cleanup, T-11)
  org_id_snapshot       uuid        NOT NULL,            -- denormalized
  user_id               uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  raw_output_hash       bytea       NOT NULL CHECK (octet_length(raw_output_hash) = 32),
  confirmed_field_keys  text[]      NOT NULL CHECK (
    confirmed_field_keys <@ ARRAY['drug_name','dosage','instructions','frequency','prescriber']
  ),
  field_count           int         NOT NULL CHECK (field_count >= 0),
  ts                    timestamptz NOT NULL DEFAULT now(),
  backfilled            boolean     NOT NULL DEFAULT false
);

ALTER TABLE ocr_audit_log ENABLE ROW LEVEL SECURITY;

-- T-03: service-role-only access. No SELECT/INSERT/UPDATE/DELETE policies for
-- authenticated or anon — they get nothing.
CREATE POLICY "audit service role only" ON ocr_audit_log
  USING (auth.role() = 'service_role');

-- T-04: Append-only via BOTH triggers AND REVOKE (defense-in-depth per cycle-1
-- Opus review: triggers protect against ordinary writes; REVOKE protects against
-- a future SECURITY DEFINER function using `SET LOCAL session_replication_role
-- = 'replica'` to bypass triggers silently).
CREATE OR REPLACE FUNCTION prevent_ocr_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ocr_audit_log is append-only';
END $$ LANGUAGE plpgsql;
CREATE TRIGGER ocr_audit_no_update BEFORE UPDATE ON ocr_audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_ocr_audit_mutation();
CREATE TRIGGER ocr_audit_no_delete BEFORE DELETE ON ocr_audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_ocr_audit_mutation();

REVOKE UPDATE, DELETE ON ocr_audit_log FROM PUBLIC;
REVOKE UPDATE, DELETE ON ocr_audit_log FROM authenticated, anon, service_role;

CREATE INDEX ocr_audit_log_ocr_job_id_idx ON ocr_audit_log(ocr_job_id);
CREATE INDEX ocr_audit_log_user_id_ts_idx ON ocr_audit_log(user_id, ts DESC);

-- T-07 backfill: insert placeholder rows for existing confirmed OCR jobs so
-- the audit trail has a known coverage start. Uses SHA-256 of empty string as
-- the hash marker (`e3b0c44...`) since we no longer have the original raw_text
-- for historical jobs. `backfilled=true` distinguishes these from live entries.
--
-- The COALESCE on `created_by` is dead code given the WHERE filter — we cannot
-- synthesize a system user UUID because `auth.users` has an FK ON DELETE
-- RESTRICT and we won't insert into auth schema from a public migration. Pre-RLS
-- ocr_jobs rows with NULL created_by are silently skipped.
DO $$
DECLARE
  empty_hash bytea := decode('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'hex');
BEGIN
  INSERT INTO ocr_audit_log (
    ocr_job_id,
    org_id_snapshot,
    user_id,
    raw_output_hash,
    confirmed_field_keys,
    field_count,
    ts,
    backfilled
  )
  SELECT
    j.id,
    j.org_id,
    COALESCE(j.created_by, '00000000-0000-0000-0000-000000000000'::uuid),
    empty_hash,
    ARRAY[]::text[],
    0,
    j.created_at,
    true
  FROM ocr_jobs j
  WHERE j.status = 'confirmed'
    AND j.created_by IS NOT NULL;
END $$;

COMMENT ON TABLE ocr_audit_log IS 'Append-only forensic audit of OCR confirm events. PHI-free: keys + hashes only, no values. See SEC-007 plan.';
