-- OOP-008: Pin care_briefs.recipient_id as immutable.
-- A BEFORE UPDATE trigger raises an exception whenever a caller attempts to
-- change recipient_id. All other column UPDATEs pass through unaffected.
-- Uses IS DISTINCT FROM so NULL-to-value (and value-to-NULL) transitions are
-- also caught correctly (unlike <> which returns NULL when either side is NULL).

CREATE OR REPLACE FUNCTION care_briefs_recipient_immutable_fn()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.recipient_id IS DISTINCT FROM OLD.recipient_id THEN
    RAISE EXCEPTION 'care_briefs.recipient_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER care_briefs_recipient_immutable_trg
  BEFORE UPDATE ON care_briefs
  FOR EACH ROW EXECUTE FUNCTION care_briefs_recipient_immutable_fn();

COMMENT ON TRIGGER care_briefs_recipient_immutable_trg ON care_briefs IS
  'OOP-008: Enforces that care_briefs.recipient_id cannot be changed after INSERT. '
  'Changing recipient ownership would silently reassign PHI access; reject instead.';
