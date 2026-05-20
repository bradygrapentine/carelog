-- TD-210 — constrain email_dispatch_log.kind to the known dispatch namespaces.
--
-- `kind` is the dedup-key namespace half of the composite unique
-- (kind, dedup_key) that defeats Inngest retry duplicates (ON-71). It was an
-- unconstrained `text`, so a typo'd or stray namespace would silently fragment
-- idempotency (a 'refil' alert would not dedup against a 'refill' one).
--
-- The three values below are the complete set of literals inserted today:
--   - 'refill'        — refillAlert.ts:209
--   - 'task'          — taskNotificationFanout.ts:228
--   - 'weekly_digest' — weeklyDigest.ts:340
-- Adding a new dispatch kind = add it here in the same migration as the new
-- inserter (the CHECK fails closed on an unknown value, which is the point).

ALTER TABLE email_dispatch_log
  ADD CONSTRAINT email_dispatch_log_kind_check
  CHECK (kind IN ('refill', 'task', 'weekly_digest'));
