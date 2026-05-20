-- =============================================================================
-- Carelog local dev seed — rich scenario (TD-219)
-- Run automatically after: supabase db reset
-- =============================================================================
-- Builds a believable, multi-recipient care org so every dashboard panel renders
-- non-empty in local/staging: 2 care recipients, 4 members across all roles, a
-- multi-week journal (all moods + a flagged entry + comments), medications
-- (incl. a low-supply refill case), a week of shifts (incl. on_call + a future
-- one), tasks across every status (with checklists, assignments, a shift pin),
-- documents, expenses, mood entries, and in-app notifications.
--
-- All identities are SYNTHETIC — no real PHI. Login for every seeded user is
-- password `password123` (email/password is enabled locally).
--
-- Idempotency: the SUPPORTED entry point is `supabase db reset`, which wipes
-- first — so the guards below are mostly belt-and-suspenders. Auth users are
-- existence-checked, profiles upsert on id, and the org is reused if it already
-- exists; the bulk scenario content is guarded on "no care_events for this org
-- yet". NOTE: identity_vault / care_recipients / memberships are plain INSERTs,
-- so a bare re-run WITHOUT a reset would duplicate those few rows — run a reset.
--
-- Enum references (see migrations / lib/database.types.ts):
--   org_type   : family | agency | institution | employer
--   org_plan   : free | family | professional | enterprise
--   member_role: coordinator | caregiver | supporter | aide
--   event_type : journal | medication | shift | appointment | symptom | task | expense | handoff | visit_note
--   entry_kind : human | system
--   shift_type : standard | on_call          shift_status: open|claimed|confirmed|completed|missed|scheduled|in_progress|cancelled
--   task_status: todo | in_progress | done | cancelled
--   mood (text): good | okay | difficult | crisis   (lib/mood.ts)
-- =============================================================================

-- Session-local helper: find-or-create a confirmed email/password auth user
-- plus its profile. Lives in pg_temp so it's auto-dropped at session end (the
-- seed runs in a single psql connection during `supabase db reset`).
CREATE FUNCTION pg_temp.seed_ensure_user(p_email text, p_name text) RETURNS uuid AS $f$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM auth.users WHERE email = p_email;
  IF v_id IS NULL THEN
    v_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      p_email, crypt('password123', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('display_name', p_name), now(), now()
    );
  END IF;
  INSERT INTO public.user_profiles (id, display_name, email, onboarded)
  VALUES (v_id, p_name, p_email, true)
  ON CONFLICT (id) DO UPDATE
    SET display_name = EXCLUDED.display_name, email = EXCLUDED.email, onboarded = true;
  RETURN v_id;
END;
$f$ LANGUAGE plpgsql;

DO $$
DECLARE
  v_org_id        uuid;
  -- Members
  v_coord_id      uuid;  -- brady.grapentine@gmail.com (coordinator)
  v_caregiver_id  uuid;  -- Maria Santos (caregiver)
  v_supporter_id  uuid;  -- David Kim (supporter)
  v_aide_id       uuid;  -- Grace Okafor (aide, recipient-A-scoped)
  -- Recipients
  v_recip_a       uuid := gen_random_uuid();  -- Eleanor Whitmore
  v_recip_b       uuid := gen_random_uuid();  -- Arthur Chen
  v_token_a       uuid;
  v_token_b       uuid;
  -- Captured for comments / pins
  v_event_flag    uuid := gen_random_uuid();  -- the flagged journal entry
  v_event_good    uuid := gen_random_uuid();  -- a good-mood entry (gets comments)
  v_shift_oncall  uuid := gen_random_uuid();  -- on-call shift (task pins to it)
BEGIN
  -- ---- Members ------------------------------------------------------------
  v_coord_id     := pg_temp.seed_ensure_user('brady.grapentine@gmail.com', 'Brady');
  v_caregiver_id := pg_temp.seed_ensure_user('e2e-caregiver@test.com',     'Maria Santos');
  v_supporter_id := pg_temp.seed_ensure_user('e2e-supporter@test.com',     'David Kim');
  v_aide_id      := pg_temp.seed_ensure_user('e2e-aide@test.com',          'Grace Okafor');

  -- ---- Organization -------------------------------------------------------
  -- Reuse Brady's existing org if the seed already created one (keeps the
  -- coordinator's home org stable across reseeds).
  SELECT org_id INTO v_org_id
    FROM public.memberships
    WHERE user_id = v_coord_id AND role = 'coordinator'
    ORDER BY invited_at LIMIT 1;
  IF v_org_id IS NULL THEN
    v_org_id := gen_random_uuid();
    INSERT INTO public.organizations (id, name, org_type, plan)
    VALUES (v_org_id, 'Whitmore Family Care', 'family', 'professional');
  END IF;

  -- ---- Care recipients (identity_vault holds the PHI: name/dob/contacts) ---
  INSERT INTO public.identity_vault (org_id, full_name, dob, contact_info)
  VALUES (v_org_id, 'Eleanor Whitmore', '1939-04-12', jsonb_build_object(
    'dnr_status', 'Full code',
    'primary_contact', jsonb_build_object('name','Brady Whitmore','relationship','Son','phone','555-0142'),
    'hospital', 'Memorial Cooper'))
  RETURNING token INTO v_token_a;

  INSERT INTO public.identity_vault (org_id, full_name, dob, contact_info)
  VALUES (v_org_id, 'Arthur Chen', '1945-11-03', jsonb_build_object(
    'dnr_status', 'DNR',
    'primary_contact', jsonb_build_object('name','Linda Chen','relationship','Daughter','phone','555-0188'),
    'hospital', 'St. Vincent'))
  RETURNING token INTO v_token_b;

  INSERT INTO public.care_recipients (id, org_id, identity_token, diagnoses, allergies, preferences)
  VALUES
    (v_recip_a, v_org_id, v_token_a,
      jsonb_build_array('Type 2 diabetes','Mild cognitive impairment'),
      jsonb_build_array('Penicillin'),
      jsonb_build_object('likes', jsonb_build_array('jazz','walks in the park','crossword puzzles'),
                         'dislikes', jsonb_build_array('loud TVs','cold rooms'))),
    (v_recip_b, v_org_id, v_token_b,
      jsonb_build_array('CHF','Hypertension'),
      jsonb_build_array('Sulfa drugs','Shellfish'),
      jsonb_build_object('likes', jsonb_build_array('classical music','gardening'),
                         'dislikes', jsonb_build_array('crowds')));

  -- ---- Memberships (all accepted; aide is recipient-A-scoped) -------------
  INSERT INTO public.memberships (org_id, user_id, recipient_id, role, accepted_at) VALUES
    (v_org_id, v_coord_id,     NULL,      'coordinator', now()),
    (v_org_id, v_caregiver_id, NULL,      'caregiver',   now()),
    (v_org_id, v_supporter_id, NULL,      'supporter',   now()),
    (v_org_id, v_aide_id,      v_recip_a, 'aide',        now());

  -- ---- Guard: only seed scenario content once per org ---------------------
  IF EXISTS (SELECT 1 FROM public.care_events WHERE org_id = v_org_id) THEN
    RETURN;
  END IF;

  -- ---- Journal (care_events): multi-week, all moods, flagged + comments ---
  INSERT INTO public.care_events (id, org_id, recipient_id, actor_id, event_type, entry_kind, flagged, payload, occurred_at) VALUES
    (v_event_good, v_org_id, v_recip_a, v_caregiver_id, 'journal', 'human', false,
      jsonb_build_object('text','Eleanor was bright this morning — finished the crossword and asked for seconds at breakfast.','mood','good'),
      now() - interval '20 days'),
    (gen_random_uuid(), v_org_id, v_recip_a, v_aide_id, 'journal', 'human', false,
      jsonb_build_object('text','Quiet afternoon. Short walk in the courtyard, a little tired after.','mood','okay'),
      now() - interval '16 days'),
    (gen_random_uuid(), v_org_id, v_recip_a, v_caregiver_id, 'symptom', 'human', false,
      jsonb_build_object('text','Blood sugar slightly high before dinner (180). Logged and watching.','mood','okay'),
      now() - interval '12 days'),
    (v_event_flag, v_org_id, v_recip_a, v_caregiver_id, 'journal', 'human', true,
      jsonb_build_object('text','Confused about the date and didn''t recognize the morning aide at first. Settled after coffee — flagging for the team.','mood','difficult'),
      now() - interval '8 days'),
    (gen_random_uuid(), v_org_id, v_recip_a, v_coord_id, 'medication', 'human', false,
      jsonb_build_object('text','Refilled metformin and set out the weekly pill organizer.','mood','good'),
      now() - interval '5 days'),
    (gen_random_uuid(), v_org_id, v_recip_a, v_aide_id, 'journal', 'human', true,
      jsonb_build_object('text','Fall risk: nearly slipped getting out of the tub. Recommending a grab bar before next bath.','mood','crisis'),
      now() - interval '3 days'),
    (gen_random_uuid(), v_org_id, v_recip_a, v_caregiver_id, 'journal', 'human', false,
      jsonb_build_object('text','Good day overall. Daughter visited and they looked at old photos together.','mood','good'),
      now() - interval '1 days'),
    (gen_random_uuid(), v_org_id, v_recip_b, v_caregiver_id, 'journal', 'human', false,
      jsonb_build_object('text','Arthur''s ankles less swollen today after the diuretic adjustment.','mood','okay'),
      now() - interval '2 days');

  INSERT INTO public.care_event_comments (org_id, care_event_id, author_id, body) VALUES
    (v_org_id, v_event_good, v_coord_id,     'Love hearing this — thanks for noting the appetite.'),
    (v_org_id, v_event_flag, v_supporter_id, 'Should we move up the neurology follow-up?'),
    (v_org_id, v_event_flag, v_coord_id,     'I''ll call the clinic tomorrow morning.');

  -- ---- Medications (one low-supply to populate the refill surface) --------
  INSERT INTO public.medications
    (org_id, recipient_id, drug_name, brand_name, dosage, form, instructions, prescriber, pharmacy, active, refills_remaining, supply_days_remaining, last_refill_date) VALUES
    (v_org_id, v_recip_a, 'Metformin', 'Glucophage', '500 mg', 'tablet', 'Take twice daily with meals.', 'Dr. Patel', 'Walgreens #2841', true, 2, 24, (now() - interval '6 days')::date),
    (v_org_id, v_recip_a, 'Donepezil', 'Aricept',    '10 mg',  'tablet', 'Take once at bedtime.',        'Dr. Nguyen', 'Walgreens #2841', true, 0, 5,  (now() - interval '25 days')::date),
    (v_org_id, v_recip_a, 'Lisinopril', NULL,        '20 mg',  'tablet', 'Take once in the morning.',    'Dr. Patel', 'Walgreens #2841', true, 3, 40, (now() - interval '2 days')::date),
    (v_org_id, v_recip_b, 'Furosemide', 'Lasix',     '40 mg',  'tablet', 'Take once in the morning.',    'Dr. Reyes', 'CVS #119',        true, 1, 7,  (now() - interval '23 days')::date);

  -- ---- Shifts: a week, incl. on_call + a future one -----------------------
  INSERT INTO public.shifts (id, org_id, recipient_id, created_by, assignee_user_id, shift_type, status, start_at, end_at, notes) VALUES
    (gen_random_uuid(), v_org_id, v_recip_a, v_coord_id, v_caregiver_id, 'standard', 'completed', now() - interval '2 days' + time '08:00', now() - interval '2 days' + time '16:00', 'Day shift — meals + meds.'),
    (gen_random_uuid(), v_org_id, v_recip_a, v_coord_id, v_aide_id,      'standard', 'confirmed', now() + interval '1 days' + time '08:00', now() + interval '1 days' + time '16:00', 'Bath day — grab bar pending.'),
    (v_shift_oncall,    v_org_id, v_recip_a, v_coord_id, v_caregiver_id, 'on_call',  'scheduled', now() + interval '2 days' + time '20:00', now() + interval '3 days' + time '08:00', 'Overnight on-call coverage.'),
    (gen_random_uuid(), v_org_id, v_recip_a, v_coord_id, NULL,           'standard', 'open',      now() + interval '4 days' + time '08:00', now() + interval '4 days' + time '16:00', 'Needs a volunteer.'),
    (gen_random_uuid(), v_org_id, v_recip_b, v_coord_id, v_caregiver_id, 'standard', 'confirmed', now() + interval '1 days' + time '09:00', now() + interval '1 days' + time '13:00', 'Check ankle swelling.');

  -- ---- Tasks: every status, with checklists / assignments / a shift pin ---
  INSERT INTO public.tasks (org_id, recipient_id, created_by, requested_by, assigned_to, status, title, instructions, due_at, shift_id, checklist) VALUES
    (v_org_id, v_recip_a, v_coord_id, v_coord_id, v_aide_id, 'todo',
      'Install bathroom grab bar', 'Per the fall-risk note — before next bath day.', now() + interval '1 days', NULL,
      jsonb_build_array(jsonb_build_object('text','Measure tub wall','done',true),
                        jsonb_build_object('text','Buy ADA grab bar','done',false),
                        jsonb_build_object('text','Mount + test','done',false))),
    (v_org_id, v_recip_a, v_coord_id, v_coord_id, v_caregiver_id, 'in_progress',
      'Pick up Donepezil refill', 'Low supply — about 5 days left.', now() + interval '2 days', v_shift_oncall,
      jsonb_build_array(jsonb_build_object('text','Call pharmacy','done',true),
                        jsonb_build_object('text','Confirm insurance','done',false))),
    (v_org_id, v_recip_a, v_caregiver_id, v_caregiver_id, v_caregiver_id, 'done',
      'Schedule neurology follow-up', 'Booked for next week.', now() - interval '1 days', NULL, '[]'::jsonb),
    (v_org_id, v_recip_b, v_coord_id, v_coord_id, NULL, 'cancelled',
      'Order compression socks', 'Cancelled — physician advised against.', now() - interval '3 days', NULL, '[]'::jsonb),
    (v_org_id, v_recip_b, v_coord_id, v_coord_id, v_caregiver_id, 'todo',
      'Weigh Arthur daily', 'Track CHF fluid retention; log each morning.', now() + interval '1 days', NULL,
      jsonb_build_array(jsonb_build_object('text','Morning weight','done',false)));

  -- ---- Documents ----------------------------------------------------------
  INSERT INTO public.documents (org_id, recipient_id, uploaded_by, display_name, doc_type, storage_path, file_size, extracted_text) VALUES
    (v_org_id, v_recip_a, v_coord_id, 'Medicare card (front)', 'insurance_card',     'seed/recip-a/medicare-front.jpg', 184320, NULL),
    (v_org_id, v_recip_a, v_coord_id, 'Advance directive',     'advance_directive',  'seed/recip-a/advance-directive.pdf', 512000, 'Healthcare proxy: Brady Whitmore. Resuscitation: full code.'),
    (v_org_id, v_recip_b, v_coord_id, 'Cardiology summary',    'other',              'seed/recip-b/cardiology-summary.pdf', 256000, 'CHF, EF 35%. Continue furosemide 40mg daily.');

  -- ---- Expenses -----------------------------------------------------------
  INSERT INTO public.expenses (org_id, recipient_id, logged_by, amount, category, description, paid_by_name, incurred_at) VALUES
    (v_org_id, v_recip_a, v_coord_id,     4200, 'other',            'Neurology copay',             'Brady', now() - interval '7 days'),
    (v_org_id, v_recip_a, v_caregiver_id, 1875, 'medication',       'Metformin + Donepezil refill','Maria', now() - interval '6 days'),
    (v_org_id, v_recip_a, v_coord_id,     3499, 'home_modification','ADA grab bar + mounting kit', 'Brady', now() - interval '2 days'),
    (v_org_id, v_recip_b, v_coord_id,     2500, 'other',            'Cardiology copay',            'Linda', now() - interval '4 days');

  -- ---- Mood entries -------------------------------------------------------
  INSERT INTO public.mood_entries (org_id, recipient_id, author_id, mood, note, occurred_at) VALUES
    (v_org_id, v_recip_a, v_caregiver_id, 'good',      'Cheerful and engaged today.',          now() - interval '20 days'),
    (v_org_id, v_recip_a, v_aide_id,      'okay',      'A bit tired but cooperative.',         now() - interval '16 days'),
    (v_org_id, v_recip_a, v_caregiver_id, 'difficult', 'Disoriented in the morning.',          now() - interval '8 days'),
    (v_org_id, v_recip_a, v_aide_id,      'crisis',    'Near-fall in the bathroom.',           now() - interval '3 days'),
    (v_org_id, v_recip_b, v_caregiver_id, 'okay',      'Stable; swelling improving.',          now() - interval '2 days');

  -- ---- In-app notifications (a couple unread) -----------------------------
  -- type ∈ task_assigned | task_completed | task_created (task_notifications migration)
  INSERT INTO public.in_app_notifications (org_id, user_id, recipient_id, task_id, type, title, body, read_at) VALUES
    (v_org_id, v_aide_id,      v_recip_a, NULL, 'task_assigned',  'New task assigned to you', 'Install bathroom grab bar', NULL),
    (v_org_id, v_coord_id,     v_recip_a, NULL, 'task_created',   'New task created',         'Weigh Arthur daily', NULL),
    (v_org_id, v_caregiver_id, v_recip_a, NULL, 'task_completed', 'Task completed',           'Schedule neurology follow-up', now() - interval '1 days');

EXCEPTION WHEN others THEN
  RAISE;  -- Don't swallow; halt db reset loudly so failed seeds surface immediately.
END $$;
