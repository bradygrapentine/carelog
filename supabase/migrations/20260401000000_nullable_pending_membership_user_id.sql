-- Pending memberships (invites not yet accepted) previously stored the inviting
-- user's ID as a placeholder in user_id. This caused unique constraint violations
-- when a coordinator invited multiple people to the same org+recipient, because
-- all pending rows shared the same (org_id, coordinator_uuid, recipient_id).
--
-- Fix: make user_id nullable. NULL is used for pending memberships until accepted.
-- Postgres UNIQUE constraints treat NULLs as distinct, so multiple pending rows
-- with NULL user_id + same (org_id, recipient_id) are allowed.
--
-- acceptInvite() sets user_id to the real accepting user's ID on acceptance.
-- getMemberships() already filters by .not('accepted_at', 'is', null), so
-- pending rows (user_id = NULL, accepted_at = NULL) never appear in member lists.

ALTER TABLE memberships
  ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN user_id DROP DEFAULT;

-- Drop the existing unique constraint (it included user_id as NOT NULL).
-- Re-add it unchanged — the constraint still prevents duplicate accepted memberships
-- for the same (org_id, user_id, recipient_id). NULL user_ids are excluded from
-- unique enforcement by Postgres semantics.
ALTER TABLE memberships DROP CONSTRAINT memberships_org_id_user_id_recipient_id_key;
ALTER TABLE memberships ADD CONSTRAINT memberships_org_id_user_id_recipient_id_key
  UNIQUE (org_id, user_id, recipient_id);
