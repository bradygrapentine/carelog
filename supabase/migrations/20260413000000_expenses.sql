-- P5-01: Shared expense log
-- Tracks care-related expenses. All org members can read.
-- Coordinators and caregivers can insert. Coordinators can delete.

CREATE TABLE expenses (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_id  uuid        NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
  logged_by     uuid        NOT NULL REFERENCES auth.users(id),
  amount        numeric(10,2) NOT NULL CHECK (amount > 0),
  currency      text        NOT NULL DEFAULT 'USD',
  category      text        NOT NULL CHECK (category IN (
    'medication', 'supplies', 'equipment', 'home_modification',
    'aide_hours', 'transport', 'food', 'other'
  )),
  description   text        NOT NULL,
  paid_by_name  text,
  receipt_url   text,
  incurred_at   date        NOT NULL DEFAULT current_date,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- All active org members can read expenses for their org
CREATE POLICY "org members can read expenses"
  ON expenses FOR SELECT
  USING (user_is_org_member(org_id));

-- Coordinators and caregivers can insert
CREATE POLICY "coordinator or caregiver can insert expenses"
  ON expenses FOR INSERT
  WITH CHECK (
    logged_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM   memberships
      WHERE  org_id       = expenses.org_id
      AND    user_id      = auth.uid()
      AND    role         IN ('coordinator', 'caregiver')
      AND    accepted_at  IS NOT NULL
    )
  );

-- Coordinator only can delete
CREATE POLICY "coordinator can delete expenses"
  ON expenses FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM   memberships
      WHERE  org_id       = expenses.org_id
      AND    user_id      = auth.uid()
      AND    role         = 'coordinator'
      AND    accepted_at  IS NOT NULL
    )
  );

-- No UPDATE policy: expenses is an append-only log. Coordinators delete, not edit.
