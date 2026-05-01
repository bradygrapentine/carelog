-- ============================================================
-- Visit recordings — first slice for ON-55/ON-69 (Phase 4 visit recorder)
--
-- Mobile records audio at the doctor's office, uploads to Supabase
-- Storage, then an Inngest job runs Whisper → Claude to extract
-- structured visit notes. The resulting record links to a `visit_note`
-- care_event so the timeline + brief surfaces can pick it up.
--
-- This migration adds only the schema. The Inngest pipeline + the
-- mobile recording UI ship as follow-up rows on top of this contract.
-- ============================================================

-- 1. Extend the event_type enum so care_events can carry visit_note rows.
-- ALTER TYPE ... ADD VALUE is non-transactional in Postgres < 12 but safe
-- in 14+ (Supabase runs 15). IF NOT EXISTS guards against re-runs.
ALTER TYPE event_type ADD VALUE IF NOT EXISTS 'visit_note';

-- 2. Status enum for the per-recording pipeline state.
CREATE TYPE visit_recording_status AS ENUM (
  'pending',      -- audio uploaded, awaiting transcription
  'transcribing', -- Whisper running
  'extracting',   -- Claude structured-data run
  'needs_review', -- structured data ready; caregiver hasn't confirmed
  'confirmed',    -- caregiver approved → care_event row created
  'failed'        -- terminal error; see error_message
);

-- 3. The recordings table itself. Mirrors the ocr_jobs shape — this is the
-- same "audio/image → AI pipeline → structured care_event" pattern.
CREATE TABLE visit_recordings (
  id                   uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid                   NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_id         uuid                   NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
  -- The original appointment care_event the recording belongs to (nullable
  -- because a caregiver may record an unscheduled visit).
  appointment_event_id uuid                   REFERENCES care_events(id) ON DELETE SET NULL,
  -- The resulting visit_note care_event once extraction is confirmed.
  -- Stays NULL until status='confirmed'.
  care_event_id        uuid                   REFERENCES care_events(id) ON DELETE SET NULL,
  audio_url            text                   NOT NULL,
  duration_seconds     integer,
  -- Whisper output. Streamed in once transcription completes.
  transcript           text,
  -- Claude structured extraction. Schema TBD (chief_complaint,
  -- recommendations[], prescription_changes[], follow_ups[], notes).
  -- jsonb keeps us flexible until the PRD locks the shape.
  structured_data      jsonb,
  status               visit_recording_status NOT NULL DEFAULT 'pending',
  -- Populated when status='failed'; otherwise NULL.
  error_message        text,
  created_by           uuid                   NOT NULL REFERENCES auth.users(id),
  created_at           timestamptz            NOT NULL DEFAULT now(),
  updated_at           timestamptz            NOT NULL DEFAULT now()
);

-- 4. Indexes — the recipient-scoped read is the hot path; the org-scoped
-- index supports the rate-limit + monitoring queries.
CREATE INDEX idx_visit_recordings_recipient
  ON visit_recordings (recipient_id, created_at DESC);
CREATE INDEX idx_visit_recordings_org
  ON visit_recordings (org_id, created_at DESC);
-- Surfaces "recordings still pending after N minutes" alerting.
CREATE INDEX idx_visit_recordings_pending
  ON visit_recordings (status, created_at)
  WHERE status IN ('pending', 'transcribing', 'extracting');

-- 5. updated_at trigger (mirrors the project convention used by other
-- mutating tables; see e.g. medications + care_recipients).
CREATE OR REPLACE FUNCTION set_visit_recordings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_visit_recordings_updated_at
  BEFORE UPDATE ON visit_recordings
  FOR EACH ROW
  EXECUTE FUNCTION set_visit_recordings_updated_at();

-- 6. RLS — same pattern as ocr_jobs. Team members can read; the policy
-- relies on user_can_access_recipient() which already encodes the
-- coordinator / caregiver / aide / supporter access matrix.
ALTER TABLE visit_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "visit_recordings readable by team"
  ON visit_recordings FOR SELECT
  USING (user_can_access_recipient(recipient_id));

CREATE POLICY "visit_recordings writable by team"
  ON visit_recordings FOR ALL
  USING (user_can_access_recipient(recipient_id));
