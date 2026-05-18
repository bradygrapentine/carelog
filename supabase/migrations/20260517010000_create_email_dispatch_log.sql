-- ON-71 Phase 2: write-before-send idempotency for transactional emails.
--
-- Inngest cron retries can fire the same step multiple times. We INSERT a row
-- here BEFORE calling Resend; on unique violation we know another invocation
-- already handled this dedup_key and we skip the send. On send success we
-- UPDATE sent_at = now() to mark the row as permanent.
--
-- A pending-row sweep (sent_at IS NULL AND created_at < now() - interval '15 min')
-- runs at the top of each cron tick to recover from step crashes that left a
-- row pending forever. 15 min is generous vs. the Inngest step wall-clock max.
--
-- Service-role bypasses RLS as designed for all Inngest cron functions. RLS is
-- ENABLED with NO policies, which is default-deny under Postgres for non-bypass
-- roles (anon, authenticated). Service-role bypasses RLS at the connection level.

CREATE TABLE email_dispatch_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL,
  recipient_id uuid,
  kind        text NOT NULL,
  dedup_key   text NOT NULL,
  sent_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_dispatch_log_kind_dedup_unique UNIQUE (kind, dedup_key)
);

CREATE INDEX email_dispatch_log_pending_idx
  ON email_dispatch_log (kind, created_at)
  WHERE sent_at IS NULL;

ALTER TABLE email_dispatch_log ENABLE ROW LEVEL SECURITY;

-- No policies. Under RLS-enabled mode this is default-deny for anon and
-- authenticated. service_role bypasses RLS at the connection level so it
-- retains full access for Inngest functions.

COMMENT ON TABLE email_dispatch_log IS
  'ON-71: idempotency log for transactional email dispatch. INSERT-before-send + composite unique (kind, dedup_key) defeats Inngest retry duplicates. Pending rows older than 15 min are swept at the top of each cron tick.';

COMMENT ON COLUMN email_dispatch_log.dedup_key IS
  'Per-kind stable identifier, e.g. for refill alerts: refill:<org_id>:<recipient_id>:<iso_week>';

COMMENT ON COLUMN email_dispatch_log.sent_at IS
  'NULL = pending (Resend call may have started but not confirmed). Set to now() after a successful resend.emails.send().';
