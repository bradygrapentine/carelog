-- SEC-006 / FIND-005: normalize share-token entropy to 256-bit.
-- Existing rows preserved — DEFAULT only affects future inserts.
-- Pre-state: outer_circle_requests.share_token = 128-bit, care_briefs.share_token = 192-bit,
--           invite_tokens.token = 256-bit (already compliant).
ALTER TABLE outer_circle_requests
  ALTER COLUMN share_token SET DEFAULT encode(extensions.gen_random_bytes(32), 'hex');
ALTER TABLE care_briefs
  ALTER COLUMN share_token SET DEFAULT encode(extensions.gen_random_bytes(32), 'hex');
