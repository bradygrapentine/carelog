-- ============================================================
-- Track who created each invite_tokens row so the invite landing
-- can name the inviter ("Sarah Smith invited you to help...")
-- and pass the 3-second phishing-vs-legit credibility test for the
-- recipient.
--
-- Nullable because rows created before this migration have no
-- recorded inviter; the GET handler falls back to the org name.
-- ============================================================

ALTER TABLE invite_tokens
  ADD COLUMN invited_by_user_id uuid REFERENCES auth.users(id);

CREATE INDEX idx_invite_tokens_invited_by_user_id
  ON invite_tokens (invited_by_user_id);

COMMENT ON COLUMN invite_tokens.invited_by_user_id IS
  'auth.users.id of the coordinator who created this invite. Nullable: pre-2026-04-29 rows have no recorded inviter.';
