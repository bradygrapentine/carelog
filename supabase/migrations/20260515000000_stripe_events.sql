-- SEC-002: Stripe webhook event-ID deduplication table.
-- Replay protection: service-role inserts event_id on first delivery;
-- duplicate event_ids are rejected by the primary-key constraint, allowing
-- the API route to short-circuit without dispatching handlers a second time.

CREATE TABLE IF NOT EXISTS stripe_events (
  event_id     text        PRIMARY KEY,
  event_type   text        NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
-- No policies — only service_role (bypasses RLS) may read/write.

GRANT INSERT, SELECT ON stripe_events TO service_role;
