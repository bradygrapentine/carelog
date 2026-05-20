BEGIN;
SELECT plan(7);

-- ─── ON-78: shift_type column + no-widen RLS assertion ───────────────────────

SET LOCAL ROLE postgres;

INSERT INTO auth.users (
  id, aud, role, email, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin
) VALUES
  ('aaaa0078-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'coord@shift-type.com', now(), now(), now(), '{}', '{}', false),
  ('cccc0078-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'outsider@shift-type.com', now(), now(), now(), '{}', '{}', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, org_type)
VALUES ('10000078-0000-0000-0000-000000000001', 'Shift Type Org', 'family')
ON CONFLICT DO NOTHING;

INSERT INTO identity_vault (org_id, full_name)
VALUES ('10000078-0000-0000-0000-000000000001', 'Type Test Recipient')
ON CONFLICT DO NOTHING;

INSERT INTO care_recipients (id, org_id, identity_token)
SELECT '20000078-0000-0000-0000-000000000001', '10000078-0000-0000-0000-000000000001', token
FROM identity_vault WHERE org_id = '10000078-0000-0000-0000-000000000001' LIMIT 1
ON CONFLICT DO NOTHING;

-- coordinator is a member; outsider is NOT a member of this org
INSERT INTO memberships (org_id, user_id, role, accepted_at, recipient_id)
VALUES (
  '10000078-0000-0000-0000-000000000001',
  'aaaa0078-0000-0000-0000-000000000001',
  'coordinator', now(), null
) ON CONFLICT DO NOTHING;

INSERT INTO shifts (id, org_id, recipient_id, status, start_at, end_at, created_by)
VALUES (
  '30000078-0000-0000-0000-000000000001',
  '10000078-0000-0000-0000-000000000001',
  '20000078-0000-0000-0000-000000000001',
  'scheduled', now(), now() + interval '8 hours',
  'aaaa0078-0000-0000-0000-000000000001'
) ON CONFLICT DO NOTHING;

-- ─── column metadata (additive enum column) ─────────────────────────────────

SELECT has_column('shifts', 'shift_type', 'shifts.shift_type column exists');
SELECT col_type_is('shifts', 'shift_type', 'shift_type', 'shifts.shift_type is the shift_type enum');
SELECT col_not_null('shifts', 'shift_type', 'shifts.shift_type is NOT NULL');
SELECT col_default_is('shifts', 'shift_type', 'standard'::shift_type, 'shifts.shift_type defaults to standard');

-- existing row backfilled to standard via the DEFAULT (no separate UPDATE)
SELECT is(
  (SELECT shift_type::text FROM shifts WHERE id = '30000078-0000-0000-0000-000000000001'),
  'standard',
  'pre-existing shift backfilled to standard'
);

-- the enum admits exactly the two intended labels
SELECT set_eq(
  $$ SELECT unnest(enum_range(NULL::shift_type))::text $$,
  ARRAY['standard', 'on_call'],
  'shift_type enum admits exactly standard + on_call'
);

-- ─── NO-WIDEN: the new column must not widen access ──────────────────────────
-- An outsider (no membership in this org) still sees 0 rows on shifts after the
-- column add — the column inherits shifts RLS, it does not bypass it.
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "cccc0078-0000-0000-0000-000000000003", "role": "authenticated"}';

SELECT is(
  (SELECT count(*)::int FROM shifts WHERE org_id = '10000078-0000-0000-0000-000000000001'),
  0,
  'non-member outsider still sees 0 shifts after shift_type column add (no widen)'
);

SELECT * FROM finish();
ROLLBACK;
