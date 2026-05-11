-- =============================================================================
-- Carelog local dev seed
-- Run automatically after: supabase db reset
-- =============================================================================
-- Creates brady.grapentine@gmail.com as a coordinator with a 'family'/'professional'
-- org, a care recipient (PHI in identity_vault), and an accepted membership row.
--
-- TD-124: prior version silently failed on multiple inserts due to schema drift
-- (missing org_type, wrong care_recipients columns, missing accepted_at, missing
-- email column on user_profiles). Fixed end-to-end so `supabase db reset` produces
-- a working dashboard immediately.
--
-- org_type enum values: 'family' | 'agency' | 'institution' | 'employer'
--   (see supabase/migrations/20260327234330_core_schema.sql `CREATE TYPE org_type`)
-- org_plan enum values: 'free' | 'family' | 'professional' | 'enterprise'
-- =============================================================================

DO $$
DECLARE
  v_user_id           uuid := gen_random_uuid();
  v_org_id            uuid := gen_random_uuid();
  v_recip_id          uuid := gen_random_uuid();
  v_identity_token    uuid;
BEGIN

  -- Auth user. auth.users has NO unique constraint on email (only on id PK and
  -- phone), so ON CONFLICT (email) won't work. Use a defensive existence check
  -- so the seed is idempotent across re-runs (`supabase db reset` always wipes
  -- first, so the existence check is mostly belt-and-suspenders).
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'brady.grapentine@gmail.com';
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'brady.grapentine@gmail.com',
      crypt('password123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"display_name":"Brady"}',
      now(), now()
    );
  END IF;

  -- User profile. Schema (20260328000200_auth_config.sql):
  --   id uuid PK FK -> auth.users(id), display_name, avatar_url, onboarded, created_at
  -- (NO email column — auth.users owns email.)
  INSERT INTO public.user_profiles (id, display_name, onboarded)
  VALUES (v_user_id, 'Brady', true)
  ON CONFLICT (id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        onboarded    = EXCLUDED.onboarded;

  -- Organization. org_type is NOT NULL with no default — must specify.
  INSERT INTO public.organizations (id, name, org_type, plan)
  VALUES (v_org_id, 'Brady''s Family', 'family', 'professional')
  ON CONFLICT (id) DO NOTHING;

  -- Identity vault row first (PHI: real name + dob + emergency contact info).
  -- care_recipients references this via NOT NULL identity_token FK.
  INSERT INTO public.identity_vault (org_id, full_name, dob, contact_info)
  VALUES (
    v_org_id,
    'Test Recipient',
    '1940-01-01',
    jsonb_build_object(
      'dnr_status', 'Full code',
      'primary_contact', jsonb_build_object(
        'name', 'Jane Doe',
        'relationship', 'Daughter',
        'phone', '555-0100'
      ),
      'hospital', 'Memorial Cooper'
    )
  )
  RETURNING token INTO v_identity_token;

  -- Care recipient. Real schema: id, org_id, identity_token, diagnoses, allergies,
  -- preferences (all NOT NULL with sensible jsonb defaults). Seed sample
  -- preferences so UX-104 LikesDislikesList renders non-empty in dev.
  INSERT INTO public.care_recipients (id, org_id, identity_token, preferences)
  VALUES (
    v_recip_id,
    v_org_id,
    v_identity_token,
    jsonb_build_object(
      'likes',    jsonb_build_array('jazz', 'walks in the park', 'crossword puzzles'),
      'dislikes', jsonb_build_array('loud TVs', 'cold rooms')
    )
  )
  ON CONFLICT (id) DO NOTHING;

  -- Membership. accepted_at MUST be set — every router membership-check filters
  -- `not accepted_at is null`; without it the row is treated as un-accepted and
  -- the dashboard shows the "no care teams" empty state.
  --
  -- No ON CONFLICT: the unique constraint `(org_id, user_id, recipient_id)`
  -- has nullable columns post-migration 20260401000000, which makes Postgres
  -- ON CONFLICT inference reject the column list. Seed runs after a fresh
  -- migration apply so there's no conflict to suppress.
  INSERT INTO public.memberships (org_id, user_id, recipient_id, role, accepted_at)
  VALUES (v_org_id, v_user_id, v_recip_id, 'coordinator', now());

EXCEPTION WHEN others THEN
  RAISE;  -- Don't swallow; halt db reset loudly so failed seeds surface immediately.
END $$;
