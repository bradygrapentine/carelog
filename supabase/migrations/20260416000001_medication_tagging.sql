-- ON-46: Medication tagging junction tables
-- Links care_events and vault documents to specific medications

CREATE TABLE care_event_medications (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  care_event_id  uuid        NOT NULL REFERENCES care_events(id) ON DELETE CASCADE,
  medication_id  uuid        NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  org_id         uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  confidence     text        NOT NULL DEFAULT 'auto'
                               CHECK (confidence IN ('manual', 'auto')),
  tagged_by      uuid        REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(care_event_id, medication_id)
);

CREATE TABLE document_medications (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    uuid        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  medication_id  uuid        NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  org_id         uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  confidence     text        NOT NULL DEFAULT 'auto'
                               CHECK (confidence IN ('manual', 'auto')),
  tagged_by      uuid        REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, medication_id)
);

-- Performance indexes
CREATE INDEX idx_cem_event  ON care_event_medications(care_event_id);
CREATE INDEX idx_cem_med    ON care_event_medications(medication_id);
CREATE INDEX idx_dm_doc     ON document_medications(document_id);
CREATE INDEX idx_dm_med     ON document_medications(medication_id);

-- RLS
ALTER TABLE care_event_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_medications   ENABLE ROW LEVEL SECURITY;

-- ── care_event_medications policies ──────────────────────────────────────────

-- Any org member can read
CREATE POLICY "org members read care_event_medications"
  ON care_event_medications FOR SELECT
  USING (user_is_org_member(org_id));

-- Any org member can insert (manual tag)
CREATE POLICY "org members insert care_event_medications"
  ON care_event_medications FOR INSERT
  WITH CHECK (user_is_org_member(org_id));

-- Tagger or coordinator can delete
CREATE POLICY "tagger or coordinator delete care_event_medications"
  ON care_event_medications FOR DELETE
  USING (
    tagged_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = care_event_medications.org_id
        AND m.user_id = auth.uid()
        AND m.role = 'coordinator'
        AND m.accepted_at IS NOT NULL
    )
  );

-- ── document_medications policies ────────────────────────────────────────────

-- Any org member can read
CREATE POLICY "org members read document_medications"
  ON document_medications FOR SELECT
  USING (user_is_org_member(org_id));

-- Coordinator only can insert (mirrors coordinator-only document insert)
CREATE POLICY "coordinator insert document_medications"
  ON document_medications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = document_medications.org_id
        AND m.user_id = auth.uid()
        AND m.role = 'coordinator'
        AND m.accepted_at IS NOT NULL
    )
  );

-- Coordinator only can delete
CREATE POLICY "coordinator delete document_medications"
  ON document_medications FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = document_medications.org_id
        AND m.user_id = auth.uid()
        AND m.role = 'coordinator'
        AND m.accepted_at IS NOT NULL
    )
  );
