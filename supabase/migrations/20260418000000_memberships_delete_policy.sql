-- Allow coordinators to remove members from their org.
-- Server-side memberships.remove mutation enforces additional rules
-- (cannot remove self, cannot remove last coordinator); this policy
-- is the defense-in-depth layer so non-server clients cannot bypass.

CREATE POLICY "memberships deletable by coordinators"
  ON memberships FOR DELETE
  USING (user_is_org_coordinator(org_id));
