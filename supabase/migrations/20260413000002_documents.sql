-- P5-03: Document vault
-- Private document storage. All org members read; coordinator insert/delete.
-- Downloads use signed URLs generated server-side — no public bucket URLs.

CREATE TABLE documents (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_id  uuid        NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
  uploaded_by   uuid        NOT NULL,
  display_name  text        NOT NULL,
  doc_type      text        NOT NULL CHECK (doc_type IN (
    'hipaa_authorization', 'power_of_attorney', 'advance_directive',
    'insurance_card', 'medication_list', 'other'
  )),
  storage_path  text        NOT NULL,
  file_size     integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- All active org members can read document metadata
CREATE POLICY "org members can read documents"
  ON documents FOR SELECT
  USING (user_is_org_member(org_id));

-- Coordinator only can insert
CREATE POLICY "coordinator can insert documents"
  ON documents FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM   memberships
      WHERE  org_id       = documents.org_id
      AND    user_id      = auth.uid()
      AND    role         = 'coordinator'
      AND    accepted_at  IS NOT NULL
    )
  );

-- Coordinator only can delete
CREATE POLICY "coordinator can delete documents"
  ON documents FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM   memberships
      WHERE  org_id       = documents.org_id
      AND    user_id      = auth.uid()
      AND    role         = 'coordinator'
      AND    accepted_at  IS NOT NULL
    )
  );

INSERT INTO storage.buckets (id, name, public)
VALUES ('care-documents', 'care-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: only service_role can manage objects
-- Access is enforced at the API route layer with signed URLs — no direct public access
CREATE POLICY "service role can manage care-documents"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'care-documents');
