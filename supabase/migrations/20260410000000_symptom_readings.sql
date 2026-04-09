-- P4-01: Symptom readings table
-- Tracks care recipient vitals/symptoms: pain, mood, appetite, mobility.
-- All org members can read; coordinators and caregivers can insert.
-- Supporters are read-only (enforced here and at tRPC layer).

-- Helper: any active org member (all roles)
CREATE OR REPLACE FUNCTION user_is_org_member(p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   memberships
    WHERE  org_id       = p_org_id
    AND    user_id      = auth.uid()
    AND    accepted_at  IS NOT NULL
  );
$$;

CREATE TABLE symptom_readings (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_id  uuid        NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
  logged_by     uuid        NOT NULL,
  pain_level    smallint    CHECK (pain_level BETWEEN 0 AND 10),
  mood          text        CHECK (mood IN ('good','okay','difficult','crisis')),
  appetite      text        CHECK (appetite IN ('normal','reduced','poor','none')),
  mobility      text        CHECK (mobility IN ('normal','limited','assisted','bedbound')),
  notes         text        CHECK (char_length(notes) <= 1000),
  recorded_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE symptom_readings ENABLE ROW LEVEL SECURITY;

-- All active org members can read readings for their org
CREATE POLICY "org members can read symptom_readings"
  ON symptom_readings FOR SELECT
  USING (user_is_org_member(org_id));

-- Coordinators and caregivers can insert (supporters cannot)
CREATE POLICY "coordinator or caregiver can insert symptom_readings"
  ON symptom_readings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   memberships
      WHERE  org_id       = symptom_readings.org_id
      AND    user_id      = auth.uid()
      AND    role         IN ('coordinator', 'caregiver')
      AND    accepted_at  IS NOT NULL
    )
  );
