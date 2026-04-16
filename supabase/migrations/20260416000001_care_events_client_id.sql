-- PP-011: Add optional client_id column to care_events for offline write-queue idempotency
ALTER TABLE care_events ADD COLUMN IF NOT EXISTS client_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS care_events_client_id_idx ON care_events (client_id) WHERE client_id IS NOT NULL;
