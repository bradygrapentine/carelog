-- SEC-006 / FIND-005: Verify share-token entropy is normalized to 256-bit
-- (32 bytes hex = 64 characters) across all three token surfaces.
BEGIN;
SELECT plan(3);

-- ─── fixtures ────────────────────────────────────────────────────────────────

SET LOCAL ROLE postgres;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('ee006001-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'coord@sec006-entropy.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, org_type)
VALUES ('ee006000-0000-0000-0000-000000000001', 'SEC-006 Entropy Org', 'family')
ON CONFLICT DO NOTHING;

INSERT INTO identity_vault (org_id, full_name)
VALUES ('ee006000-0000-0000-0000-000000000001', 'SEC-006 Test Recipient')
ON CONFLICT DO NOTHING;

INSERT INTO care_recipients (id, org_id, identity_token)
SELECT 'ee006002-0000-0000-0000-000000000001', 'ee006000-0000-0000-0000-000000000001', token
FROM identity_vault WHERE org_id = 'ee006000-0000-0000-0000-000000000001' LIMIT 1
ON CONFLICT DO NOTHING;

INSERT INTO memberships (org_id, user_id, role, accepted_at)
VALUES (
  'ee006000-0000-0000-0000-000000000001',
  'ee006001-0000-0000-0000-000000000001',
  'coordinator', now()
) ON CONFLICT DO NOTHING;

-- Also need a membership_id for invite_tokens FK
-- memberships.id is auto-assigned; capture it below via subquery.

-- ─── tests ───────────────────────────────────────────────────────────────────

-- Test 1 (SEC-006): outer_circle_requests.share_token DEFAULT = 256-bit (64 hex chars)
INSERT INTO outer_circle_requests (org_id, recipient_id, title, request_type, created_by)
VALUES (
  'ee006000-0000-0000-0000-000000000001',
  'ee006002-0000-0000-0000-000000000001',
  'SEC-006 entropy check',
  'meal',
  'ee006001-0000-0000-0000-000000000001'
);

SELECT is(
  length(share_token),
  64,
  'SEC-006: outer_circle_requests.share_token DEFAULT is 256-bit (64 hex chars)'
)
FROM outer_circle_requests
WHERE title = 'SEC-006 entropy check'
  AND org_id = 'ee006000-0000-0000-0000-000000000001';

-- Test 2 (SEC-006): care_briefs.share_token DEFAULT = 256-bit (64 hex chars)
INSERT INTO care_briefs (org_id, recipient_id, content, created_by)
VALUES (
  'ee006000-0000-0000-0000-000000000001',
  'ee006002-0000-0000-0000-000000000001',
  '{"recipient_name": "SEC-006", "medications": [], "recent_entries": []}'::jsonb,
  'ee006001-0000-0000-0000-000000000001'
);

SELECT is(
  length(share_token),
  64,
  'SEC-006: care_briefs.share_token DEFAULT is 256-bit (64 hex chars)'
)
FROM care_briefs
WHERE org_id = 'ee006000-0000-0000-0000-000000000001'
ORDER BY created_at DESC
LIMIT 1;

-- Test 3 (SEC-006 baseline): invite_tokens.token DEFAULT = 256-bit (already compliant pre-migration)
INSERT INTO invite_tokens (membership_id, email)
SELECT id, 'sec006-check@entropy.com'
FROM memberships
WHERE org_id = 'ee006000-0000-0000-0000-000000000001'
  AND user_id = 'ee006001-0000-0000-0000-000000000001'
LIMIT 1;

SELECT is(
  length(token),
  64,
  'SEC-006: invite_tokens.token DEFAULT is 256-bit (64 hex chars) — baseline compliant'
)
FROM invite_tokens
WHERE email = 'sec006-check@entropy.com';

SELECT finish();
ROLLBACK;
