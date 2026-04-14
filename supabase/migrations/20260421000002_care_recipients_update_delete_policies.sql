-- ON-23: Add UPDATE and DELETE RLS policies for care_recipients
-- SELECT and INSERT policies exist in the core schema migration.
-- Coordinators are the only role that should mutate recipient records.

CREATE POLICY "recipients updatable by coordinators"
  ON care_recipients FOR UPDATE
  USING (user_is_org_coordinator(org_id))
  WITH CHECK (user_is_org_coordinator(org_id));

CREATE POLICY "recipients deletable by coordinators"
  ON care_recipients FOR DELETE
  USING (user_is_org_coordinator(org_id));
