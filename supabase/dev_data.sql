-- =============================================================================
-- Carelog dev / QA dataset
-- Run AFTER: supabase start
-- Loads 7 users, 2 orgs, 3 recipients, and a full activity history.
-- Idempotent — safe to re-run.
--
-- Run with:
--   npx supabase db execute --local < supabase/dev_data.sql
-- =============================================================================

DO $$
DECLARE
  -- ── Users ─────────────────────────────────────────────────────────────────
  v_brady_id       uuid := gen_random_uuid();
  v_gail_id        uuid := gen_random_uuid();
  v_coord_id       uuid := gen_random_uuid();
  v_cg1_id         uuid := gen_random_uuid();
  v_cg2_id         uuid := gen_random_uuid();
  v_supporter_id   uuid := gen_random_uuid();
  v_aide_id        uuid := gen_random_uuid();

  -- ── Orgs ──────────────────────────────────────────────────────────────────
  v_brady_org      uuid := gen_random_uuid();
  v_henderson_org  uuid := gen_random_uuid();

  -- ── Identity vault tokens ─────────────────────────────────────────────────
  v_margaret_tok   uuid := gen_random_uuid();
  v_robert_tok     uuid := gen_random_uuid();
  v_dorothy_tok    uuid := gen_random_uuid();

  -- ── Care recipients ───────────────────────────────────────────────────────
  v_margaret       uuid := gen_random_uuid();
  v_robert         uuid := gen_random_uuid();
  v_dorothy        uuid := gen_random_uuid();

  -- ── Medications – Margaret ────────────────────────────────────────────────
  v_m_lisinopril   uuid := gen_random_uuid();
  v_m_metformin    uuid := gen_random_uuid();
  v_m_atorvastatin uuid := gen_random_uuid();
  v_m_aspirin      uuid := gen_random_uuid();
  v_m_amlodipine   uuid := gen_random_uuid();

  -- ── Medications – Robert ─────────────────────────────────────────────────
  v_r_lisinopril   uuid := gen_random_uuid();
  v_r_warfarin     uuid := gen_random_uuid();
  v_r_furosemide   uuid := gen_random_uuid();
  v_r_metoprolol   uuid := gen_random_uuid();
  v_r_omeprazole   uuid := gen_random_uuid();

  -- ── Medications – Dorothy ────────────────────────────────────────────────
  v_d_levothyrox   uuid := gen_random_uuid();
  v_d_calcium      uuid := gen_random_uuid();
  v_d_vitamin_d    uuid := gen_random_uuid();

  -- ── Journal events (need IDs for reactions) ───────────────────────────────
  v_mj1 uuid := gen_random_uuid();
  v_mj2 uuid := gen_random_uuid();
  v_mj3 uuid := gen_random_uuid();
  v_rj1 uuid := gen_random_uuid();
  v_rj2 uuid := gen_random_uuid();

  -- ── Outer circle requests ─────────────────────────────────────────────────
  v_ocr_m1 uuid := gen_random_uuid();
  v_ocr_m2 uuid := gen_random_uuid();
  v_ocr_r1 uuid := gen_random_uuid();
  v_ocr_r2 uuid := gen_random_uuid();

BEGIN

-- =============================================================================
-- 1. USERS
-- =============================================================================

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (
    v_gail_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'gmkruege@gmail.com', crypt('password123', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Gail"}', now(), now()
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_gail_id FROM auth.users WHERE email = 'gmkruege@gmail.com';

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (
    v_brady_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'brady.grapentine@gmail.com', crypt('password123', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Brady"}', now(), now()
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_brady_id FROM auth.users WHERE email = 'brady.grapentine@gmail.com';

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (
    v_coord_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'brady.grapentine+coordinator@gmail.com', crypt('password123', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Sarah"}', now(), now()
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_coord_id FROM auth.users WHERE email = 'brady.grapentine+coordinator@gmail.com';

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (
    v_cg1_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'brady.grapentine+first-caregiver@gmail.com', crypt('password123', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Alex"}', now(), now()
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_cg1_id FROM auth.users WHERE email = 'brady.grapentine+first-caregiver@gmail.com';

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (
    v_cg2_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'brady.grapentine+second-caregiver@gmail.com', crypt('password123', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Jordan"}', now(), now()
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_cg2_id FROM auth.users WHERE email = 'brady.grapentine+second-caregiver@gmail.com';

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (
    v_supporter_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'brady.grapentine+supporter@gmail.com', crypt('password123', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Robin"}', now(), now()
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_supporter_id FROM auth.users WHERE email = 'brady.grapentine+supporter@gmail.com';

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (
    v_aide_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'brady.grapentine+aide@gmail.com', crypt('password123', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Taylor"}', now(), now()
  ) ON CONFLICT DO NOTHING;
  SELECT id INTO v_aide_id FROM auth.users WHERE email = 'brady.grapentine+aide@gmail.com';

-- =============================================================================
-- 2. USER PROFILES  (trigger auto-created them; mark everyone onboarded)
-- =============================================================================

  UPDATE public.user_profiles SET onboarded = true
  WHERE id IN (v_brady_id, v_gail_id, v_coord_id, v_cg1_id, v_cg2_id, v_supporter_id, v_aide_id);

-- =============================================================================
-- 3. ORGANIZATIONS
-- =============================================================================

  INSERT INTO public.organizations (id, name, org_type, plan)
  VALUES (v_brady_org, 'Brady''s Family', 'family', 'professional')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.organizations (id, name, org_type, plan)
  VALUES (v_henderson_org, 'The Henderson Family', 'family', 'family')
  ON CONFLICT DO NOTHING;

-- =============================================================================
-- 4. IDENTITY VAULT  (service-role only; bypassed in seed context)
-- =============================================================================

  INSERT INTO public.identity_vault (token, org_id, full_name, dob, contact_info)
  VALUES
    (v_margaret_tok, v_brady_org, 'Margaret Thompson', '1940-03-15',
     '{"phone":"415-555-0101","emergency_contact":"Brady Grapentine"}'),
    (v_robert_tok,   v_brady_org, 'Robert Thompson',   '1938-07-22',
     '{"phone":"415-555-0102","emergency_contact":"Brady Grapentine"}'),
    (v_dorothy_tok,  v_henderson_org, 'Dorothy Henderson', '1945-09-10',
     '{"phone":"510-555-0201","emergency_contact":"Gail Kruege"}')
  ON CONFLICT (token) DO NOTHING;

-- =============================================================================
-- 5. CARE RECIPIENTS
-- =============================================================================

  INSERT INTO public.care_recipients (id, org_id, identity_token, diagnoses, allergies, preferences)
  VALUES
    (v_margaret, v_brady_org, v_margaret_tok,
     '["Type 2 Diabetes","Hypertension","Mild Cognitive Impairment"]',
     '["Penicillin"]',
     '{"preferred_language":"English","wake_time":"07:00","sleep_time":"21:00"}'),
    (v_robert, v_brady_org, v_robert_tok,
     '["Congestive Heart Failure","Atrial Fibrillation","Chronic Kidney Disease Stage 3"]',
     '["Sulfa drugs","NSAIDs"]',
     '{"preferred_language":"English","wake_time":"06:30","sleep_time":"20:30","low_sodium_diet":true}'),
    (v_dorothy, v_henderson_org, v_dorothy_tok,
     '["Hypothyroidism","Osteoporosis"]',
     '[]',
     '{"preferred_language":"English","wake_time":"07:30","sleep_time":"22:00"}')
  ON CONFLICT DO NOTHING;

-- =============================================================================
-- 6. DISPLAY NAMES CACHE
-- =============================================================================

  INSERT INTO public.display_names (recipient_id, org_id, full_name, cached_at, expires_at)
  VALUES
    (v_margaret, v_brady_org,    'Margaret Thompson', now(), now() + interval '24 hours'),
    (v_robert,   v_brady_org,    'Robert Thompson',   now(), now() + interval '24 hours'),
    (v_dorothy,  v_henderson_org,'Dorothy Henderson', now(), now() + interval '24 hours')
  ON CONFLICT (recipient_id) DO UPDATE
    SET full_name  = EXCLUDED.full_name,
        cached_at  = EXCLUDED.cached_at,
        expires_at = EXCLUDED.expires_at;

-- =============================================================================
-- 7. MEMBERSHIPS  (recipient_id = NULL → org-wide access)
-- =============================================================================

  -- Brady's Family
  INSERT INTO public.memberships (org_id, user_id, recipient_id, role, accepted_at)
  VALUES
    (v_brady_org, v_brady_id,    NULL, 'coordinator', now()),
    (v_brady_org, v_gail_id,     NULL, 'coordinator', now()),
    (v_brady_org, v_coord_id,    NULL, 'coordinator', now()),
    (v_brady_org, v_cg1_id,      NULL, 'caregiver',   now()),
    (v_brady_org, v_cg2_id,      NULL, 'caregiver',   now()),
    (v_brady_org, v_supporter_id,NULL, 'supporter',   now()),
    (v_brady_org, v_aide_id,     NULL, 'aide',        now())
  ON CONFLICT (org_id, user_id, recipient_id) DO UPDATE
    SET accepted_at = EXCLUDED.accepted_at;

  -- Henderson Family
  INSERT INTO public.memberships (org_id, user_id, recipient_id, role, accepted_at)
  VALUES
    (v_henderson_org, v_brady_id,    NULL, 'coordinator', now()),
    (v_henderson_org, v_gail_id,     NULL, 'coordinator', now()),
    (v_henderson_org, v_cg2_id,      NULL, 'caregiver',   now()),
    (v_henderson_org, v_supporter_id,NULL, 'supporter',   now()),
    (v_henderson_org, v_aide_id,     NULL, 'aide',        now())
  ON CONFLICT (org_id, user_id, recipient_id) DO UPDATE
    SET accepted_at = EXCLUDED.accepted_at;

-- =============================================================================
-- 8. MEDICATIONS
-- =============================================================================

  -- Margaret
  INSERT INTO public.medications
    (id, org_id, recipient_id, drug_name, brand_name, dosage, form, instructions,
     prescriber, pharmacy, pharmacy_phone, refills_remaining, supply_days_remaining,
     last_refill_date, active, scan_source)
  VALUES
    (v_m_lisinopril,   v_brady_org, v_margaret, 'Lisinopril',   'Zestril',  '10mg',  'tablet',
     'Take once daily in the morning with or without food.',
     'Dr. Patricia Nguyen', 'Walgreens Pharmacy', '415-555-1000', 3, 22, current_date - 8,  true, 'manual'),
    (v_m_metformin,    v_brady_org, v_margaret, 'Metformin',    'Glucophage','500mg', 'tablet',
     'Take twice daily with meals to reduce stomach upset.',
     'Dr. Patricia Nguyen', 'Walgreens Pharmacy', '415-555-1000', 5, 15, current_date - 15, true, 'manual'),
    (v_m_atorvastatin, v_brady_org, v_margaret, 'Atorvastatin', 'Lipitor',  '20mg',  'tablet',
     'Take once daily in the evening.',
     'Dr. Patricia Nguyen', 'CVS Pharmacy',       '415-555-2000', 2, 8,  current_date - 22, true, 'manual'),
    (v_m_aspirin,      v_brady_org, v_margaret, 'Aspirin',      NULL,       '81mg',  'tablet',
     'Take once daily in the morning with food.',
     'Dr. Patricia Nguyen', 'Walgreens Pharmacy', '415-555-1000', 11, 45, current_date - 5,  true, 'manual'),
    (v_m_amlodipine,   v_brady_org, v_margaret, 'Amlodipine',   'Norvasc',  '5mg',   'tablet',
     'Take once daily. May cause ankle swelling.',
     'Dr. Patricia Nguyen', 'CVS Pharmacy',       '415-555-2000', 4, 30, current_date - 1,  true, 'manual')
  ON CONFLICT DO NOTHING;

  -- Robert
  INSERT INTO public.medications
    (id, org_id, recipient_id, drug_name, brand_name, dosage, form, instructions,
     prescriber, pharmacy, pharmacy_phone, refills_remaining, supply_days_remaining,
     last_refill_date, active, scan_source)
  VALUES
    (v_r_lisinopril, v_brady_org, v_robert, 'Lisinopril',  'Zestril',   '5mg',  'tablet',
     'Take once daily in the morning. Monitor blood pressure.',
     'Dr. Michael Chen', 'Rite Aid Pharmacy', '415-555-3000', 2, 18, current_date - 12, true, 'manual'),
    (v_r_warfarin,   v_brady_org, v_robert, 'Warfarin',    'Coumadin',  '5mg',  'tablet',
     'Take once daily in the evening. Avoid leafy greens. Weekly INR check required.',
     'Dr. Michael Chen', 'Rite Aid Pharmacy', '415-555-3000', 1, 10, current_date - 20, true, 'manual'),
    (v_r_furosemide, v_brady_org, v_robert, 'Furosemide',  'Lasix',     '20mg', 'tablet',
     'Take once daily in the morning. Monitor fluid intake and weight daily.',
     'Dr. Michael Chen', 'Rite Aid Pharmacy', '415-555-3000', 3, 25, current_date - 5,  true, 'manual'),
    (v_r_metoprolol, v_brady_org, v_robert, 'Metoprolol',  'Lopressor', '25mg', 'tablet',
     'Take twice daily. Do not stop suddenly.',
     'Dr. Michael Chen', 'CVS Pharmacy',      '415-555-2000', 2, 5,  current_date - 25, true, 'manual'),
    (v_r_omeprazole, v_brady_org, v_robert, 'Omeprazole',  'Prilosec',  '20mg', 'capsule',
     'Take once daily 30–60 minutes before breakfast.',
     'Dr. Michael Chen', 'Walgreens Pharmacy','415-555-1000', 5, 30, current_date - 3,  true, 'manual')
  ON CONFLICT DO NOTHING;

  -- Dorothy
  INSERT INTO public.medications
    (id, org_id, recipient_id, drug_name, brand_name, dosage, form, instructions,
     prescriber, pharmacy, pharmacy_phone, refills_remaining, supply_days_remaining,
     last_refill_date, active, scan_source)
  VALUES
    (v_d_levothyrox, v_henderson_org, v_dorothy, 'Levothyroxine', 'Synthroid', '50mcg', 'tablet',
     'Take on empty stomach 30–60 minutes before breakfast.',
     'Dr. Amara Osei', 'Oakland Pharmacy', '510-555-4000', 6, 28, current_date - 2,  true, 'manual'),
    (v_d_calcium,    v_henderson_org, v_dorothy, 'Calcium Carbonate', 'Caltrate', '600mg', 'tablet',
     'Take twice daily with meals for best absorption.',
     'Dr. Amara Osei', 'Oakland Pharmacy', '510-555-4000', 8, 40, current_date - 10, true, 'manual'),
    (v_d_vitamin_d,  v_henderson_org, v_dorothy, 'Vitamin D3',   NULL,        '2000IU','softgel',
     'Take once daily with a meal containing fat.',
     'Dr. Amara Osei', 'Oakland Pharmacy', '510-555-4000', 10, 55, current_date - 7, true, 'manual')
  ON CONFLICT DO NOTHING;

-- =============================================================================
-- 9. MEDICATION SCHEDULES
-- =============================================================================

  -- Margaret
  INSERT INTO public.medication_schedules
    (medication_id, recipient_id, time_of_day, days_of_week, assigned_to, active)
  VALUES
    (v_m_lisinopril,   v_margaret, '08:00', '{0,1,2,3,4,5,6}', v_cg1_id, true),
    (v_m_metformin,    v_margaret, '08:00', '{0,1,2,3,4,5,6}', v_cg1_id, true),
    (v_m_metformin,    v_margaret, '18:00', '{0,1,2,3,4,5,6}', v_cg2_id, true),
    (v_m_atorvastatin, v_margaret, '20:00', '{0,1,2,3,4,5,6}', v_cg1_id, true),
    (v_m_aspirin,      v_margaret, '08:00', '{0,1,2,3,4,5,6}', v_cg1_id, true),
    (v_m_amlodipine,   v_margaret, '08:00', '{0,1,2,3,4,5,6}', v_cg1_id, true)
  ON CONFLICT DO NOTHING;

  -- Robert
  INSERT INTO public.medication_schedules
    (medication_id, recipient_id, time_of_day, days_of_week, assigned_to, active)
  VALUES
    (v_r_lisinopril, v_robert, '08:00', '{0,1,2,3,4,5,6}', v_cg2_id, true),
    (v_r_warfarin,   v_robert, '18:00', '{0,1,2,3,4,5,6}', v_cg2_id, true),
    (v_r_furosemide, v_robert, '07:00', '{0,1,2,3,4,5,6}', v_cg1_id, true),
    (v_r_metoprolol, v_robert, '08:00', '{0,1,2,3,4,5,6}', v_cg1_id, true),
    (v_r_metoprolol, v_robert, '20:00', '{0,1,2,3,4,5,6}', v_cg2_id, true),
    (v_r_omeprazole, v_robert, '07:30', '{0,1,2,3,4,5,6}', v_cg1_id, true)
  ON CONFLICT DO NOTHING;

  -- Dorothy
  INSERT INTO public.medication_schedules
    (medication_id, recipient_id, time_of_day, days_of_week, active)
  VALUES
    (v_d_levothyrox, v_dorothy, '07:00', '{0,1,2,3,4,5,6}', true),
    (v_d_calcium,    v_dorothy, '08:00', '{0,1,2,3,4,5,6}', true),
    (v_d_calcium,    v_dorothy, '18:00', '{0,1,2,3,4,5,6}', true),
    (v_d_vitamin_d,  v_dorothy, '08:00', '{0,1,2,3,4,5,6}', true)
  ON CONFLICT DO NOTHING;

-- =============================================================================
-- 10. CARE EVENTS  (journal events with captured IDs get reactions later)
-- =============================================================================

  -- Margaret — journal events
  INSERT INTO public.care_events
    (id, org_id, recipient_id, actor_id, event_type, entry_kind, payload, flagged, occurred_at)
  VALUES
    (v_mj1, v_brady_org, v_margaret, v_cg1_id, 'journal', 'human',
     '{"text":"Margaret had a wonderful morning. She was talkative over breakfast and mentioned she had a good night''s sleep. Appetite was excellent — finished everything on her plate."}',
     false, now() - interval '28 days'),
    (v_mj2, v_brady_org, v_margaret, v_cg2_id, 'journal', 'human',
     '{"text":"Noticed Margaret seemed more confused than usual today. She asked what day it was three times. No fall or injury. Staying calm and redirecting gently. Brady notified."}',
     true,  now() - interval '14 days'),
    (v_mj3, v_brady_org, v_margaret, v_brady_id, 'journal', 'human',
     '{"text":"Mom had a rough afternoon — tearful and asking about Dad. We looked at old photos together which helped. She settled well by dinnertime. Heartbreaking but she was okay."}',
     false, now() - interval '3 days')
  ON CONFLICT DO NOTHING;

  -- Margaret — medication, appointment, shift events
  INSERT INTO public.care_events
    (org_id, recipient_id, actor_id, event_type, entry_kind, payload, flagged, occurred_at)
  VALUES
    (v_brady_org, v_margaret, v_cg1_id, 'medication', 'system',
     '{"drug_name":"Lisinopril 10mg","administered":true,"time":"08:05","notes":"Taken with water"}',
     false, now() - interval '1 day'),
    (v_brady_org, v_margaret, v_cg1_id, 'medication', 'system',
     '{"drug_name":"Metformin 500mg","administered":true,"time":"08:05","notes":"Taken with breakfast"}',
     false, now() - interval '1 day'),
    (v_brady_org, v_margaret, v_cg1_id, 'medication', 'system',
     '{"drug_name":"Aspirin 81mg","administered":false,"time":"08:05","notes":"Refused medication this morning"}',
     true,  now() - interval '5 days'),
    (v_brady_org, v_margaret, v_coord_id, 'appointment', 'human',
     '{"title":"Neurology Follow-up","location":"UCSF Memory and Aging Center","notes":"Dr. Rankin reviewed cognitive assessment. MMSE score stable at 22. Continue current plan. Next visit in 3 months.","scheduled_at":"2026-04-10T14:00:00Z"}',
     false, now() - interval '4 days'),
    (v_brady_org, v_margaret, v_coord_id, 'appointment', 'human',
     '{"title":"Primary Care – Quarterly Review","location":"Sutter Medical Center","notes":"Blood pressure 138/82. A1C at 7.1 — good control. Adjusted Metformin timing. Labs ordered.","scheduled_at":"2026-03-28T10:00:00Z"}',
     false, now() - interval '17 days'),
    (v_brady_org, v_margaret, v_cg1_id, 'shift', 'system',
     '{"summary":"Morning shift. Margaret up by 7am, bathed and dressed independently. Good humor. Prepared oatmeal. Administered morning medications.","duration_minutes":180}',
     false, now() - interval '2 days'),
    (v_brady_org, v_margaret, v_cg2_id, 'journal', 'human',
     '{"text":"Margaret completed a full puzzle today — the 300-piece one with the garden scene. She was so proud. Great concentration for about 45 minutes."}',
     false, now() - interval '10 days'),
    (v_brady_org, v_margaret, v_aide_id, 'journal', 'human',
     '{"text":"Evening check-in. Margaret ate a small dinner but said she wasn''t hungry. Drank full glass of water with evening meds. Seemed tired, went to bed early around 8pm."}',
     false, now() - interval '6 days'),
    (v_brady_org, v_margaret, v_cg1_id, 'medication', 'system',
     '{"drug_name":"Atorvastatin 20mg","administered":true,"time":"20:00","notes":"Evening dose taken with water"}',
     false, now() - interval '2 days'),
    (v_brady_org, v_margaret, v_cg1_id, 'medication', 'system',
     '{"drug_name":"Amlodipine 5mg","administered":true,"time":"08:10","notes":"Taken without issues"}',
     false, now() - interval '3 days')
  ON CONFLICT DO NOTHING;

  -- Robert — journal events
  INSERT INTO public.care_events
    (id, org_id, recipient_id, actor_id, event_type, entry_kind, payload, flagged, occurred_at)
  VALUES
    (v_rj1, v_brady_org, v_robert, v_cg2_id, 'journal', 'human',
     '{"text":"Robert''s weight is up 2 lbs from yesterday — 184 lbs this morning. Ankles look a bit puffy. He''s on a 1500ml fluid restriction. Called Dr. Chen''s office to report. Waiting to hear back."}',
     true,  now() - interval '7 days'),
    (v_rj2, v_brady_org, v_robert, v_cg1_id, 'journal', 'human',
     '{"text":"Great afternoon — Robert and I watched the Giants game together. He was in great spirits, telling old stories about Candlestick Park. Ate a full low-sodium dinner. Evening weight stable at 182 lbs."}',
     false, now() - interval '2 days')
  ON CONFLICT DO NOTHING;

  -- Robert — medication, appointment, shift events
  INSERT INTO public.care_events
    (org_id, recipient_id, actor_id, event_type, entry_kind, payload, flagged, occurred_at)
  VALUES
    (v_brady_org, v_robert, v_cg2_id, 'medication', 'system',
     '{"drug_name":"Warfarin 5mg","administered":true,"time":"18:00","notes":"Evening dose. INR check scheduled Friday."}',
     false, now() - interval '1 day'),
    (v_brady_org, v_robert, v_cg1_id, 'medication', 'system',
     '{"drug_name":"Furosemide 20mg","administered":true,"time":"07:05","notes":"Taken. Urine output normal."}',
     false, now() - interval '1 day'),
    (v_brady_org, v_robert, v_cg2_id, 'medication', 'system',
     '{"drug_name":"Metoprolol 25mg","administered":false,"time":"20:00","notes":"Robert was already asleep. Coordinator notified."}',
     true,  now() - interval '9 days'),
    (v_brady_org, v_robert, v_coord_id, 'appointment', 'human',
     '{"title":"Cardiology – Monthly Check","location":"UCSF Cardiology","notes":"EF stable at 40%. Dr. Patel pleased with fluid management. Continue current Lasix dose. INR 2.4 — therapeutic range.","scheduled_at":"2026-04-08T09:00:00Z"}',
     false, now() - interval '6 days'),
    (v_brady_org, v_robert, v_cg2_id, 'shift', 'system',
     '{"summary":"Overnight shift. Quiet night. Robert slept through. Morning weight 182 lbs — down 1 lb. Good. Administered morning meds at 7:30am. Breakfast eaten well.","duration_minutes":480}',
     false, now() - interval '3 days'),
    (v_brady_org, v_robert, v_cg1_id, 'journal', 'human',
     '{"text":"Robert was asking about his brother Gerald today. We called Gerald together on video chat — it was beautiful. Robert was laughing and joking. Best I''ve seen him in weeks."}',
     false, now() - interval '12 days'),
    (v_brady_org, v_robert, v_brady_id, 'journal', 'human',
     '{"text":"Dad seemed short of breath after walking to the living room today. Rested and it resolved in a few minutes. No chest pain. Monitoring closely. Will mention to Dr. Chen."}',
     true,  now() - interval '4 days'),
    (v_brady_org, v_robert, v_cg1_id, 'medication', 'system',
     '{"drug_name":"Lisinopril 5mg","administered":true,"time":"08:00","notes":"Taken with water. BP 132/78 before dose."}',
     false, now() - interval '2 days'),
    (v_brady_org, v_robert, v_cg2_id, 'medication', 'system',
     '{"drug_name":"Omeprazole 20mg","administered":true,"time":"07:30","notes":"Taken 45 min before breakfast as directed."}',
     false, now() - interval '2 days'),
    (v_brady_org, v_robert, v_cg1_id, 'medication', 'system',
     '{"drug_name":"Metoprolol 25mg","administered":true,"time":"08:00","notes":"Morning dose. Heart rate 64 bpm."}',
     false, now() - interval '1 day')
  ON CONFLICT DO NOTHING;

  -- Dorothy — lighter dataset
  INSERT INTO public.care_events
    (org_id, recipient_id, actor_id, event_type, entry_kind, payload, flagged, occurred_at)
  VALUES
    (v_henderson_org, v_dorothy, v_gail_id, 'journal', 'human',
     '{"text":"Mom took her Levothyroxine right on schedule this morning. She''s been walking the block every afternoon — incredible for 80. Full of energy today."}',
     false, now() - interval '5 days'),
    (v_henderson_org, v_dorothy, v_gail_id, 'journal', 'human',
     '{"text":"Dorothy complained of lower back pain today — she rated it a 4/10. Reminded her about the calcium supplements and the importance of the daily walk. Ice pack helped."}',
     false, now() - interval '2 days'),
    (v_henderson_org, v_dorothy, v_cg2_id, 'medication', 'system',
     '{"drug_name":"Levothyroxine 50mcg","administered":true,"time":"07:00","notes":"Taken on empty stomach as directed."}',
     false, now() - interval '1 day'),
    (v_henderson_org, v_dorothy, v_coord_id, 'appointment', 'human',
     '{"title":"Endocrinology – TSH Follow-up","location":"Alta Bates Medical","notes":"TSH 2.1 — well controlled. Continue current Levothyroxine dose. DEXA scan scheduled for next month.","scheduled_at":"2026-04-05T11:00:00Z"}',
     false, now() - interval '9 days'),
    (v_henderson_org, v_dorothy, v_cg2_id, 'medication', 'system',
     '{"drug_name":"Calcium Carbonate 600mg","administered":true,"time":"08:00","notes":"Morning dose taken with breakfast."}',
     false, now() - interval '1 day'),
    (v_henderson_org, v_dorothy, v_aide_id, 'journal', 'human',
     '{"text":"Dorothy had her neighbor visit for tea this afternoon. She was in wonderful spirits — showed her the garden. Evening meds taken without issue."}',
     false, now() - interval '8 days')
  ON CONFLICT DO NOTHING;

-- =============================================================================
-- 11. JOURNAL REACTIONS
-- =============================================================================

  INSERT INTO public.journal_reactions (event_id, user_id, reaction, note)
  VALUES
    (v_mj1, v_brady_id,    'heart',         'So glad she had a good morning.'),
    (v_mj1, v_gail_id,     'grateful',      NULL),
    (v_mj1, v_coord_id,    'thinking_of_you',NULL),
    (v_mj2, v_brady_id,    'thinking_of_you','Thank you for catching this and letting me know right away.'),
    (v_mj2, v_gail_id,     'strong',        NULL),
    (v_mj3, v_gail_id,     'heart',         'You are such a good son.'),
    (v_rj1, v_brady_id,    'thinking_of_you','Called Dr. Chen''s office as well. Appreciate you flagging.'),
    (v_rj2, v_gail_id,     'heart',         'This made me smile so much.')
  ON CONFLICT (event_id, user_id) DO NOTHING;

-- =============================================================================
-- 12. SYMPTOM READINGS
-- =============================================================================

  -- Margaret
  INSERT INTO public.symptom_readings
    (org_id, recipient_id, logged_by, pain_level, mood, appetite, mobility, notes, recorded_at)
  VALUES
    (v_brady_org, v_margaret, v_cg1_id,  2, 'good',      'normal',  'normal',  NULL,                               now() - interval '14 days'),
    (v_brady_org, v_margaret, v_cg1_id,  3, 'okay',      'normal',  'normal',  'Mild knee stiffness in the morning', now() - interval '12 days'),
    (v_brady_org, v_margaret, v_cg2_id,  5, 'difficult', 'reduced', 'normal',  'Confused and agitated this afternoon', now() - interval '10 days'),
    (v_brady_org, v_margaret, v_cg1_id,  2, 'okay',      'normal',  'normal',  NULL,                               now() - interval '8 days'),
    (v_brady_org, v_margaret, v_cg1_id,  1, 'good',      'normal',  'normal',  'Best day in weeks',                now() - interval '7 days'),
    (v_brady_org, v_margaret, v_cg2_id,  3, 'okay',      'reduced', 'normal',  NULL,                               now() - interval '5 days'),
    (v_brady_org, v_margaret, v_cg1_id,  4, 'difficult', 'poor',    'limited', 'Didn''t want to get out of bed. Took some coaxing.', now() - interval '3 days'),
    (v_brady_org, v_margaret, v_cg1_id,  2, 'good',      'normal',  'normal',  'Much better today',                now() - interval '2 days'),
    (v_brady_org, v_margaret, v_cg2_id,  2, 'good',      'normal',  'normal',  NULL,                               now() - interval '1 day'),
    (v_brady_org, v_margaret, v_cg1_id,  3, 'okay',      'normal',  'normal',  NULL,                               now());

  -- Robert
  INSERT INTO public.symptom_readings
    (org_id, recipient_id, logged_by, pain_level, mood, appetite, mobility, notes, recorded_at)
  VALUES
    (v_brady_org, v_robert, v_cg2_id,  1, 'good',      'normal',  'normal',   NULL,                                 now() - interval '13 days'),
    (v_brady_org, v_robert, v_cg1_id,  2, 'okay',      'normal',  'normal',   'Mild fatigue in the afternoon',      now() - interval '11 days'),
    (v_brady_org, v_robert, v_cg2_id,  3, 'difficult', 'reduced', 'limited',  'Ankle swelling noted. Fluid restriction reinforced.', now() - interval '9 days'),
    (v_brady_org, v_robert, v_cg1_id,  2, 'okay',      'normal',  'normal',   NULL,                                 now() - interval '7 days'),
    (v_brady_org, v_robert, v_cg2_id,  4, 'difficult', 'poor',    'limited',  'Shortness of breath on exertion. Notified coordinator.', now() - interval '5 days'),
    (v_brady_org, v_robert, v_cg1_id,  2, 'okay',      'normal',  'normal',   NULL,                                 now() - interval '4 days'),
    (v_brady_org, v_robert, v_cg2_id,  1, 'good',      'normal',  'normal',   'Weight down to 182 — great trend',   now() - interval '3 days'),
    (v_brady_org, v_robert, v_cg1_id,  3, 'okay',      'reduced', 'normal',   'Bit tired today',                    now() - interval '2 days'),
    (v_brady_org, v_robert, v_cg2_id,  2, 'okay',      'normal',  'normal',   NULL,                                 now() - interval '1 day'),
    (v_brady_org, v_robert, v_cg1_id,  1, 'good',      'normal',  'normal',   'Good morning',                       now());

  -- Dorothy
  INSERT INTO public.symptom_readings
    (org_id, recipient_id, logged_by, pain_level, mood, appetite, mobility, notes, recorded_at)
  VALUES
    (v_henderson_org, v_dorothy, v_cg2_id, 2, 'good',      'normal', 'normal',  NULL,                        now() - interval '6 days'),
    (v_henderson_org, v_dorothy, v_gail_id,4, 'difficult', 'normal', 'limited', 'Back pain. Ice pack helped.', now() - interval '3 days'),
    (v_henderson_org, v_dorothy, v_cg2_id, 2, 'okay',      'normal', 'normal',  NULL,                        now() - interval '1 day'),
    (v_henderson_org, v_dorothy, v_gail_id,1, 'good',      'normal', 'normal',  'Afternoon walk completed',   now());

-- =============================================================================
-- 13. MOOD ENTRIES
-- =============================================================================

  -- Margaret
  INSERT INTO public.mood_entries (org_id, recipient_id, author_id, mood, note, occurred_at)
  VALUES
    (v_brady_org, v_margaret, v_cg1_id,  'good',      'Great breakfast, very talkative',           now() - interval '13 days'),
    (v_brady_org, v_margaret, v_cg2_id,  'difficult', 'Confused about time and place most of the afternoon', now() - interval '10 days'),
    (v_brady_org, v_margaret, v_cg1_id,  'okay',      NULL,                                        now() - interval '8 days'),
    (v_brady_org, v_margaret, v_brady_id,'difficult', 'Tearful, missing Dad',                      now() - interval '6 days'),
    (v_brady_org, v_margaret, v_cg1_id,  'good',      'Finished a puzzle, very proud',             now() - interval '4 days'),
    (v_brady_org, v_margaret, v_cg2_id,  'okay',      NULL,                                        now() - interval '2 days'),
    (v_brady_org, v_margaret, v_cg1_id,  'good',      NULL,                                        now() - interval '1 day'),
    (v_brady_org, v_margaret, v_cg1_id,  'okay',      'A little quiet today',                      now());

  -- Robert
  INSERT INTO public.mood_entries (org_id, recipient_id, author_id, mood, note, occurred_at)
  VALUES
    (v_brady_org, v_robert, v_cg2_id,  'okay',      NULL,                                           now() - interval '12 days'),
    (v_brady_org, v_robert, v_cg1_id,  'good',      'Video call with brother Gerald — he was beaming', now() - interval '10 days'),
    (v_brady_org, v_robert, v_cg2_id,  'difficult', 'Worried about his INR levels',                 now() - interval '8 days'),
    (v_brady_org, v_robert, v_cg1_id,  'okay',      NULL,                                           now() - interval '6 days'),
    (v_brady_org, v_robert, v_cg2_id,  'difficult', 'Frustrated about fluid restriction at dinner', now() - interval '4 days'),
    (v_brady_org, v_robert, v_cg1_id,  'good',      'Giants game — best mood in weeks',             now() - interval '2 days'),
    (v_brady_org, v_robert, v_cg2_id,  'okay',      NULL,                                           now() - interval '1 day'),
    (v_brady_org, v_robert, v_cg1_id,  'good',      'Weight down, energy up',                       now());

  -- Dorothy
  INSERT INTO public.mood_entries (org_id, recipient_id, author_id, mood, note, occurred_at)
  VALUES
    (v_henderson_org, v_dorothy, v_gail_id,  'good',      'Morning walk and tea with neighbor',  now() - interval '5 days'),
    (v_henderson_org, v_dorothy, v_cg2_id,   'difficult', 'Back pain making her grumpy',         now() - interval '2 days'),
    (v_henderson_org, v_dorothy, v_gail_id,  'okay',      NULL,                                  now() - interval '1 day'),
    (v_henderson_org, v_dorothy, v_cg2_id,   'good',      'Good energy today',                   now());

-- =============================================================================
-- 14. SHIFTS
-- =============================================================================

  -- Margaret (6 shifts)
  INSERT INTO public.shifts
    (org_id, recipient_id, assignee_user_id, status, start_at, end_at, recurring, created_by)
  VALUES
    -- completed
    (v_brady_org, v_margaret, v_cg1_id, 'completed',
     now() - interval '3 days' + time '07:00', now() - interval '3 days' + time '13:00',
     false, v_coord_id),
    -- missed
    (v_brady_org, v_margaret, v_cg2_id, 'missed',
     now() - interval '5 days' + time '19:00', now() - interval '5 days' + time '23:00',
     false, v_coord_id),
    -- confirmed (future)
    (v_brady_org, v_margaret, v_cg1_id, 'confirmed',
     now() + interval '1 day' + time '07:00', now() + interval '1 day' + time '13:00',
     false, v_coord_id),
    -- claimed (future)
    (v_brady_org, v_margaret, v_cg2_id, 'claimed',
     now() + interval '2 days' + time '13:00', now() + interval '2 days' + time '19:00',
     false, v_coord_id),
    -- open (future)
    (v_brady_org, v_margaret, NULL, 'open',
     now() + interval '3 days' + time '07:00', now() + interval '3 days' + time '13:00',
     false, v_coord_id),
    -- open (future)
    (v_brady_org, v_margaret, NULL, 'open',
     now() + interval '4 days' + time '13:00', now() + interval '4 days' + time '19:00',
     false, v_coord_id)
  ON CONFLICT DO NOTHING;

  -- Robert (4 shifts)
  INSERT INTO public.shifts
    (org_id, recipient_id, assignee_user_id, status, start_at, end_at, recurring, created_by)
  VALUES
    (v_brady_org, v_robert, v_cg2_id, 'completed',
     now() - interval '2 days' + time '07:00', now() - interval '2 days' + time '15:00',
     false, v_coord_id),
    (v_brady_org, v_robert, v_cg1_id, 'confirmed',
     now() + interval '1 day' + time '07:00', now() + interval '1 day' + time '15:00',
     false, v_coord_id),
    (v_brady_org, v_robert, NULL, 'open',
     now() + interval '2 days' + time '07:00', now() + interval '2 days' + time '15:00',
     false, v_coord_id),
    (v_brady_org, v_robert, NULL, 'open',
     now() + interval '3 days' + time '15:00', now() + interval '3 days' + time '23:00',
     false, v_coord_id)
  ON CONFLICT DO NOTHING;

  -- Dorothy (2 shifts)
  INSERT INTO public.shifts
    (org_id, recipient_id, assignee_user_id, status, start_at, end_at, recurring, created_by)
  VALUES
    (v_henderson_org, v_dorothy, v_cg2_id, 'completed',
     now() - interval '4 days' + time '09:00', now() - interval '4 days' + time '13:00',
     false, v_gail_id),
    (v_henderson_org, v_dorothy, NULL, 'open',
     now() + interval '2 days' + time '09:00', now() + interval '2 days' + time '13:00',
     false, v_gail_id)
  ON CONFLICT DO NOTHING;

-- =============================================================================
-- 15. EXPENSES
-- =============================================================================

  -- Margaret
  INSERT INTO public.expenses
    (org_id, recipient_id, logged_by, amount, currency, category, description, paid_by_name, incurred_at)
  VALUES
    (v_brady_org, v_margaret, v_coord_id,  87.50, 'USD', 'medication',       'Atorvastatin 30-day supply — CVS',           'Brady Grapentine', current_date - 22),
    (v_brady_org, v_margaret, v_cg1_id,    24.99, 'USD', 'supplies',         'Adult briefs — 40ct pack',                   'Alex',             current_date - 18),
    (v_brady_org, v_margaret, v_coord_id,  45.00, 'USD', 'transport',        'Medical transport to UCSF neurology visit',  'Brady Grapentine', current_date - 4),
    (v_brady_org, v_margaret, v_cg2_id,    18.75, 'USD', 'food',             'Grocery run — soft foods per dietary plan',  'Jordan',           current_date - 7),
    (v_brady_org, v_margaret, v_coord_id, 340.00, 'USD', 'aide_hours',       'Alex — 8hr weekend shift',                   'Brady Grapentine', current_date - 3),
    (v_brady_org, v_margaret, v_coord_id,  62.00, 'USD', 'home_modification','Non-slip bath mat and grab bar installation','Brady Grapentine', current_date - 14)
  ON CONFLICT DO NOTHING;

  -- Robert
  INSERT INTO public.expenses
    (org_id, recipient_id, logged_by, amount, currency, category, description, paid_by_name, incurred_at)
  VALUES
    (v_brady_org, v_robert, v_coord_id,  112.00, 'USD', 'medication',   'Warfarin + Furosemide — Rite Aid monthly fill', 'Brady Grapentine', current_date - 20),
    (v_brady_org, v_robert, v_cg1_id,     28.00, 'USD', 'supplies',     'Low-sodium salt substitute and weekly food supplies', 'Alex',      current_date - 10),
    (v_brady_org, v_robert, v_coord_id,   55.00, 'USD', 'transport',    'Ride to UCSF cardiology appointment',           'Brady Grapentine', current_date - 6),
    (v_brady_org, v_robert, v_cg2_id,     14.50, 'USD', 'food',         'Heart-healthy meal prep supplies',               'Jordan',          current_date - 5),
    (v_brady_org, v_robert, v_coord_id,  340.00, 'USD', 'aide_hours',   'Jordan — overnight + morning shift',            'Brady Grapentine', current_date - 2),
    (v_brady_org, v_robert, v_coord_id,   95.00, 'USD', 'equipment',    'Digital weight scale + blood pressure monitor', 'Brady Grapentine', current_date - 30)
  ON CONFLICT DO NOTHING;

  -- Dorothy
  INSERT INTO public.expenses
    (org_id, recipient_id, logged_by, amount, currency, category, description, paid_by_name, incurred_at)
  VALUES
    (v_henderson_org, v_dorothy, v_gail_id, 42.00, 'USD', 'medication', 'Levothyroxine + Calcium — Oakland Pharmacy', 'Gail Kruege', current_date - 8),
    (v_henderson_org, v_dorothy, v_gail_id, 38.00, 'USD', 'supplies',   'Walker maintenance and tennis ball tips',    'Gail Kruege', current_date - 15),
    (v_henderson_org, v_dorothy, v_cg2_id,  50.00, 'USD', 'transport',  'Drive to Alta Bates endocrinology visit',   'Jordan',      current_date - 9)
  ON CONFLICT DO NOTHING;

-- =============================================================================
-- 16. OUTER CIRCLE REQUESTS + CLAIMS
-- =============================================================================

  INSERT INTO public.outer_circle_requests
    (id, org_id, recipient_id, title, description, request_type, slots_total, slots_filled, needed_by, active, created_by)
  VALUES
    (v_ocr_m1, v_brady_org, v_margaret,
     'Weekly meal drop-off for Margaret',
     'Looking for kind neighbors or friends to drop off a home-cooked meal once a week. Margaret loves soups, casseroles, and anything easy to eat. No nuts due to preference.',
     'meal', 4, 2, now() + interval '30 days', true, v_brady_id),
    (v_ocr_m2, v_brady_org, v_margaret,
     'Help with grocery runs',
     'Need someone to pick up a small grocery list every 2 weeks from Safeway on Market St. Takes about 30 minutes. We reimburse for groceries and gas.',
     'errand', 2, 0, now() + interval '14 days', true, v_coord_id),
    (v_ocr_r1, v_brady_org, v_robert,
     'Friendly visits for Robert',
     'Robert loves talking about baseball and history. Looking for someone to visit for an hour or two, once a week. Means the world to him.',
     'visit', 3, 1, now() + interval '60 days', true, v_brady_id),
    (v_ocr_r2, v_brady_org, v_robert,
     'Ride to cardiology appointment',
     'Robert has a cardiology follow-up at UCSF on April 28th at 9am. Need a reliable driver. We cover parking.',
     'transport', 1, 0, now() + interval '14 days', true, v_coord_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.outer_circle_claims
    (request_id, claimer_name, claimer_email, slot_date, note, confirmed)
  VALUES
    (v_ocr_m1, 'Diane Fisher',   'diane.fisher@example.com',   now() + interval '7 days',  'Happy to bring over my chicken soup on Sundays!', true),
    (v_ocr_m1, 'Tom Hendricks',  'tom.hendricks@example.com',  now() + interval '14 days', 'I''ll bring a lasagna. Is garlic okay?',            false),
    (v_ocr_r1, 'Carlos Medina',  'carlos.medina@example.com',  now() + interval '5 days',  'Huge baseball fan myself. Would love to visit.',   true)
  ON CONFLICT DO NOTHING;

-- =============================================================================
-- 17. BURNOUT CHECK-INS  (caregiver1 + caregiver2, last 4 weeks)
-- =============================================================================

  INSERT INTO public.burnout_checkins
    (org_id, user_id, sleep_score, stress_score, support_score, notes, week_stamp)
  VALUES
    -- Alex (cg1)
    (v_brady_org, v_cg1_id, 3, 4, 3, 'Tough week — Robert had a rough few days and I was worried.',    '2026-W13'),
    (v_brady_org, v_cg1_id, 4, 3, 4, NULL,                                                               '2026-W14'),
    (v_brady_org, v_cg1_id, 2, 5, 2, 'Exhausted. Short-staffed and doubled up on shifts.',              '2026-W15'),
    (v_brady_org, v_cg1_id, 3, 3, 3, 'Feeling more balanced this week. Team helped a lot.',             '2026-W16'),
    -- Jordan (cg2)
    (v_brady_org, v_cg2_id, 4, 3, 4, NULL,                                                               '2026-W13'),
    (v_brady_org, v_cg2_id, 3, 4, 3, 'Concerned about Robert''s weight fluctuations. Hard to watch.',   '2026-W14'),
    (v_brady_org, v_cg2_id, 4, 3, 4, NULL,                                                               '2026-W15'),
    (v_brady_org, v_cg2_id, 5, 2, 5, 'Great week. Robert had such a good day watching the Giants.',     '2026-W16')
  ON CONFLICT (user_id, week_stamp) DO NOTHING;

-- =============================================================================
-- 18. BENEFITS SCREENINGS
-- =============================================================================

  INSERT INTO public.benefits_screenings
    (org_id, recipient_id, answers, results, created_by)
  VALUES
    (v_brady_org, v_margaret,
     '{"age":86,"income_level":"below_poverty","has_medicare":true,"has_medicaid":false,"lives_alone":false,"has_caregiver":true,"veteran":false}',
     '{"eligible_programs":["Medicaid HCBS Waiver","PACE Program","Senior Extra Help (Part D)","Area Agency on Aging Meals Program"],"priority":"high","notes":"Strong candidate for HCBS waiver given cognitive decline. Recommend submitting Medicaid application this quarter."}',
     v_brady_id),
    (v_brady_org, v_robert,
     '{"age":87,"income_level":"low_income","has_medicare":true,"has_medicaid":false,"lives_alone":false,"has_caregiver":true,"veteran":true}',
     '{"eligible_programs":["VA Aid & Attendance","Medicare PACE","Low Income Subsidy (LIS)","VA Home-Based Primary Care"],"priority":"high","notes":"Veterans benefits likely unlocked. VA Aid & Attendance could offset aide costs significantly. Contact VA case worker."}',
     v_coord_id)
  ON CONFLICT DO NOTHING;

-- =============================================================================
-- 19. DOCUMENTS
-- =============================================================================

  INSERT INTO public.documents
    (org_id, recipient_id, uploaded_by, display_name, doc_type, storage_path, file_size)
  VALUES
    (v_brady_org, v_margaret, v_brady_id,
     'Margaret Thompson — Durable Power of Attorney',
     'power_of_attorney',
     'care-documents/brady-org/margaret/durable-poa-2024.pdf', 245760),
    (v_brady_org, v_margaret, v_brady_id,
     'Margaret Thompson — Advance Directive / Living Will',
     'advance_directive',
     'care-documents/brady-org/margaret/advance-directive-2024.pdf', 189440),
    (v_brady_org, v_robert, v_brady_id,
     'Robert Thompson — VA Benefits Authorization (HIPAA)',
     'hipaa_authorization',
     'care-documents/brady-org/robert/hipaa-va-auth-2025.pdf', 102400),
    (v_brady_org, v_robert, v_coord_id,
     'Robert Thompson — Advance Directive',
     'advance_directive',
     'care-documents/brady-org/robert/advance-directive-2025.pdf', 201728)
  ON CONFLICT DO NOTHING;

-- =============================================================================
-- 20. EOL PLANS
-- =============================================================================

  INSERT INTO public.eol_plans
    (org_id, recipient_id, created_by, healthcare_proxy, resuscitation_pref,
     funeral_pref, legacy_message, attorney_name, attorney_contact)
  VALUES
    (v_brady_org, v_margaret, v_brady_id,
     'Brady Grapentine (son) — Primary; Gail Kruege — Alternate',
     'dnr_comfort_only',
     'Simple graveside service. Buried with Robert when the time comes. No viewing.',
     'I have had a beautiful life. I love my children and grandchildren more than words can say. Take care of each other and don''t forget to laugh.',
     'James O''Brien, Esq.', '415-555-9100'),
    (v_brady_org, v_robert, v_brady_id,
     'Brady Grapentine (son) — Primary; Gail Kruege — Alternate',
     'dnr',
     'Veterans memorial service. Burial with military honors at Golden Gate National Cemetery.',
     'Serve your country, love your family, and root for the Giants. That''s all there is to it.',
     'James O''Brien, Esq.', '415-555-9100')
  ON CONFLICT (recipient_id) DO NOTHING;

-- =============================================================================
-- 21. CARE BRIEFS
-- =============================================================================

  INSERT INTO public.care_briefs
    (org_id, recipient_id, title, content, includes, expires_at, revoked, created_by)
  VALUES
    (v_brady_org, v_margaret,
     'Margaret Thompson — Care Overview',
     '{"summary":"Margaret is an 86-year-old woman with Type 2 Diabetes, Hypertension, and Mild Cognitive Impairment. She lives at home with daily caregiver support.","medications_summary":"Lisinopril 10mg, Metformin 500mg, Atorvastatin 20mg, Aspirin 81mg, Amlodipine 5mg — all taken daily.","key_contacts":"Primary physician: Dr. Patricia Nguyen (415-555-8800). Neurologist: Dr. Rankin at UCSF Memory Center.","care_notes":"Responds well to redirection when confused. Enjoys puzzles and music from the 1950s. Penicillin allergy — alert all care providers."}',
     ARRAY['medications','contacts','diagnoses','allergies'],
     now() + interval '30 days', false, v_brady_id),
    (v_brady_org, v_robert,
     'Robert Thompson — Care Overview',
     '{"summary":"Robert is an 87-year-old veteran with Congestive Heart Failure, Atrial Fibrillation, and CKD Stage 3. Daily weight monitoring and strict fluid restriction (1500ml/day) are critical.","medications_summary":"Lisinopril 5mg, Warfarin 5mg, Furosemide 20mg, Metoprolol 25mg, Omeprazole 20mg.","key_contacts":"Cardiologist: Dr. Patel at UCSF (415-555-7700). Primary: Dr. Michael Chen (415-555-8900).","care_notes":"CRITICAL: Sulfa drug and NSAID allergy. Daily weight must be logged — call coordinator if weight up >2lbs in 24hrs. 1500ml fluid restriction enforced."}',
     ARRAY['medications','contacts','diagnoses','allergies','care_notes'],
     now() + interval '30 days', false, v_brady_id),
    (v_henderson_org, v_dorothy,
     'Dorothy Henderson — Care Overview',
     '{"summary":"Dorothy is an 80-year-old woman with Hypothyroidism and Osteoporosis. Well-managed with medication. Active — walks daily.","medications_summary":"Levothyroxine 50mcg (empty stomach, morning), Calcium Carbonate 600mg twice daily, Vitamin D3 2000IU daily.","key_contacts":"Endocrinologist: Dr. Amara Osei at Alta Bates (510-555-6600).","care_notes":"Levothyroxine must be taken 30-60 min before breakfast on an empty stomach. Fall risk awareness — ensure clear walkways."}',
     ARRAY['medications','contacts','diagnoses'],
     now() + interval '30 days', false, v_gail_id)
  ON CONFLICT DO NOTHING;

END $$;
