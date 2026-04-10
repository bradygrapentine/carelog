-- P5-04: End-of-life planner
-- One plan per care recipient. Coordinator-only — completely invisible to other roles.
-- Uses UPSERT on recipient_id to prevent duplicate plans.

CREATE TABLE eol_plans (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_id        uuid        NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
  created_by          uuid        NOT NULL,
  healthcare_proxy    text,
  resuscitation_pref  text        CHECK (resuscitation_pref IN ('full', 'dnr', 'dnr_comfort_only')),
  funeral_pref        text,
  legacy_message      text,
  attorney_name       text,
  attorney_contact    text,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipient_id)
);

ALTER TABLE eol_plans ENABLE ROW LEVEL SECURITY;

-- Coordinator-only read
CREATE POLICY "coordinator can read eol_plans"
  ON eol_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   memberships
      WHERE  org_id       = eol_plans.org_id
      AND    user_id      = auth.uid()
      AND    role         = 'coordinator'
      AND    accepted_at  IS NOT NULL
    )
  );

-- Coordinator-only insert
CREATE POLICY "coordinator can insert eol_plans"
  ON eol_plans FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   memberships
      WHERE  org_id       = eol_plans.org_id
      AND    user_id      = auth.uid()
      AND    role         = 'coordinator'
      AND    accepted_at  IS NOT NULL
    )
  );

-- Coordinator-only update
CREATE POLICY "coordinator can update eol_plans"
  ON eol_plans FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM   memberships
      WHERE  org_id       = eol_plans.org_id
      AND    user_id      = auth.uid()
      AND    role         = 'coordinator'
      AND    accepted_at  IS NOT NULL
    )
  );
