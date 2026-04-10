-- P5-02: Benefits screener results
-- Saves coordinator screener runs for reference. Coordinator-only access.

CREATE TABLE benefits_screenings (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_id uuid        NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
  answers      jsonb       NOT NULL,
  results      jsonb       NOT NULL,
  created_by   uuid        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE benefits_screenings ENABLE ROW LEVEL SECURITY;

-- Coordinator-only read
CREATE POLICY "coordinator can read benefits_screenings"
  ON benefits_screenings FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   memberships
      WHERE  org_id       = benefits_screenings.org_id
      AND    user_id      = auth.uid()
      AND    role         = 'coordinator'
      AND    accepted_at  IS NOT NULL
    )
  );

-- Coordinator-only insert
CREATE POLICY "coordinator can insert benefits_screenings"
  ON benefits_screenings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   memberships
      WHERE  org_id       = benefits_screenings.org_id
      AND    user_id      = auth.uid()
      AND    role         = 'coordinator'
      AND    accepted_at  IS NOT NULL
    )
  );
