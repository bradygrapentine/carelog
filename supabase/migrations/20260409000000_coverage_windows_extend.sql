-- Extend coverage_windows for recurring expectations
ALTER TABLE coverage_windows
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS required_role text,
  ADD COLUMN IF NOT EXISTS day_of_week smallint CHECK (day_of_week >= 0 AND day_of_week <= 6),
  ADD COLUMN IF NOT EXISTS recurring boolean NOT NULL DEFAULT false;

-- Coordinators can manage coverage windows
CREATE POLICY "coverage insertable by coordinator"
  ON coverage_windows FOR INSERT
  WITH CHECK (user_is_org_coordinator(org_id));

CREATE POLICY "coverage updatable by coordinator"
  ON coverage_windows FOR UPDATE
  USING (user_is_org_coordinator(org_id))
  WITH CHECK (user_is_org_coordinator(org_id));

CREATE POLICY "coverage deletable by coordinator"
  ON coverage_windows FOR DELETE
  USING (user_is_org_coordinator(org_id));
