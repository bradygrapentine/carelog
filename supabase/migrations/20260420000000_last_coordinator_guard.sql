-- Prevent deletion of the last remaining coordinator in an org.
-- The application-layer check in memberships.remove is racy — two concurrent
-- deletes could each read count=2 and both proceed, leaving zero coordinators.
-- This trigger closes the race by rechecking at commit time with row locks.

CREATE OR REPLACE FUNCTION prevent_last_coordinator_delete()
RETURNS TRIGGER AS $$
DECLARE
  remaining_coordinators int;
BEGIN
  IF OLD.role <> 'coordinator' OR OLD.accepted_at IS NULL THEN
    RETURN OLD;
  END IF;

  -- Lock all active coordinator rows in this org (excluding the row being
  -- deleted, which is already locked by the DELETE), then count them.
  PERFORM 1 FROM memberships
    WHERE org_id = OLD.org_id
      AND role = 'coordinator'
      AND accepted_at IS NOT NULL
      AND id <> OLD.id
    FOR UPDATE;

  SELECT count(*) INTO remaining_coordinators
  FROM memberships
  WHERE org_id = OLD.org_id
    AND role = 'coordinator'
    AND accepted_at IS NOT NULL
    AND id <> OLD.id;

  IF remaining_coordinators = 0 THEN
    RAISE EXCEPTION 'Cannot remove the last coordinator in org %', OLD.org_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_last_coordinator_delete ON memberships;
CREATE TRIGGER prevent_last_coordinator_delete
  BEFORE DELETE ON memberships
  FOR EACH ROW
  EXECUTE FUNCTION prevent_last_coordinator_delete();
