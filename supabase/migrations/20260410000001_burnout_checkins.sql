-- P4-02: Burnout check-ins table
-- Weekly caregiver self-assessment: sleep, stress, support scores (1-5).
-- Users see only their own rows; coordinators see all rows in their org (for aggregates).
-- The UNIQUE constraint on (user_id, week_stamp) makes check-ins idempotent (one per week).

CREATE TABLE burnout_checkins (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL,
  sleep_score   smallint    NOT NULL CHECK (sleep_score BETWEEN 1 AND 5),
  stress_score  smallint    NOT NULL CHECK (stress_score BETWEEN 1 AND 5),
  support_score smallint    NOT NULL CHECK (support_score BETWEEN 1 AND 5),
  notes         text        CHECK (char_length(notes) <= 500),
  week_stamp    text        NOT NULL CHECK (week_stamp ~ '^\d{4}-W\d{2}$'),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_stamp)
);

ALTER TABLE burnout_checkins ENABLE ROW LEVEL SECURITY;

-- Users can read their own check-ins
CREATE POLICY "user reads own burnout_checkins"
  ON burnout_checkins FOR SELECT
  USING (user_id = auth.uid());

-- Coordinators can read all check-ins for their org (for aggregate trend view)
-- user_is_org_coordinator() is defined in an earlier migration (symptom_readings or memberships)
CREATE POLICY "coordinator reads org burnout_checkins"
  ON burnout_checkins FOR SELECT
  USING (user_is_org_coordinator(org_id));

-- Any active org member can insert their OWN check-in (user_id must match caller)
CREATE POLICY "org member inserts own burnout_checkin"
  ON burnout_checkins FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND user_is_org_member(org_id)
  );

-- Users can update their own check-in for the current week (upsert support)
CREATE POLICY "user updates own burnout_checkin"
  ON burnout_checkins FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
