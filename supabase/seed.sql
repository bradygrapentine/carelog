-- =============================================================================
-- Carelog local dev seed
-- Run automatically after: supabase db reset
-- =============================================================================
-- Creates brady.grapentine@gmail.com as a coordinator with a professional-plan
-- org, so the paywall is bypassed in local dev.
-- =============================================================================

DO $$
DECLARE
  v_user_id   uuid := gen_random_uuid();
  v_org_id    uuid := gen_random_uuid();
  v_recip_id  uuid := gen_random_uuid();
BEGIN

  -- Auth user
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
    '{}',
    now(), now()
  )
  ON CONFLICT (email) DO UPDATE
    SET id = EXCLUDED.id
  RETURNING id INTO v_user_id;

  -- Re-fetch id in case the row already existed
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'brady.grapentine@gmail.com';

  -- User profile
  INSERT INTO public.user_profiles (id, display_name, email, onboarded)
  VALUES (v_user_id, 'Brady', 'brady.grapentine@gmail.com', true)
  ON CONFLICT (id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        email        = EXCLUDED.email,
        onboarded    = EXCLUDED.onboarded;

  -- Organization (professional plan — paywall bypassed)
  INSERT INTO public.organizations (id, name, plan)
  VALUES (v_org_id, 'Brady''s Family', 'professional')
  ON CONFLICT DO NOTHING;

  -- Care recipient
  INSERT INTO public.care_recipients (id, org_id, full_name, date_of_birth)
  VALUES (v_recip_id, v_org_id, 'Test Recipient', '1940-01-01')
  ON CONFLICT DO NOTHING;

  -- Membership (coordinator role)
  INSERT INTO public.memberships (org_id, user_id, recipient_id, role)
  VALUES (v_org_id, v_user_id, v_recip_id, 'coordinator')
  ON CONFLICT DO NOTHING;

END $$;
