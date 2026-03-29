-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE org_type AS ENUM ('family', 'agency', 'institution', 'employer');
CREATE TYPE org_plan AS ENUM ('free', 'family', 'professional', 'enterprise');
CREATE TYPE member_role AS ENUM ('coordinator', 'caregiver', 'supporter', 'aide');
CREATE TYPE event_type AS ENUM (
  'journal', 'medication', 'shift', 'appointment',
  'symptom', 'task', 'expense', 'handoff'
);
CREATE TYPE entry_kind AS ENUM ('human', 'system');
CREATE TYPE shift_status AS ENUM ('open', 'claimed', 'confirmed', 'completed', 'missed');
CREATE TYPE ocr_status AS ENUM ('pending', 'processing', 'needs_review', 'confirmed', 'failed');
CREATE TYPE request_type AS ENUM ('meal', 'transport', 'errand', 'visit', 'other');

-- ============================================================
-- ORGANIZATIONS
-- ============================================================
CREATE TABLE organizations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  org_type   org_type    NOT NULL,
  plan       org_plan    NOT NULL DEFAULT 'free',
  stripe_id  text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- IDENTITY VAULT
-- PHI boundary. Service role only.
-- ============================================================
CREATE TABLE identity_vault (
  token        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name    text        NOT NULL,
  dob          date,
  contact_info jsonb       NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- CARE RECIPIENTS
-- ============================================================
CREATE TABLE care_recipients (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  identity_token uuid        NOT NULL REFERENCES identity_vault(token),
  diagnoses      jsonb       NOT NULL DEFAULT '[]',
  allergies      jsonb       NOT NULL DEFAULT '[]',
  preferences    jsonb       NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- DISPLAY NAME CACHE
-- ============================================================
CREATE TABLE display_names (
  recipient_id uuid        PRIMARY KEY REFERENCES care_recipients(id) ON DELETE CASCADE,
  org_id       uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name    text        NOT NULL,
  cached_at    timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

-- ============================================================
-- MEMBERSHIPS
-- ============================================================
CREATE TABLE memberships (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid        REFERENCES care_recipients(id) ON DELETE CASCADE,
  role         member_role NOT NULL,
  invited_at   timestamptz NOT NULL DEFAULT now(),
  accepted_at  timestamptz,
  UNIQUE (org_id, user_id, recipient_id)
);

-- ============================================================
-- INVITE TOKENS
-- ============================================================
CREATE TABLE invite_tokens (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token         text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  membership_id uuid        NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  email         text        NOT NULL,
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  consumed_at   timestamptz
);

-- ============================================================
-- CARE EVENTS
-- ============================================================
CREATE TABLE care_events (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_id uuid        NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
  actor_id     uuid        NOT NULL REFERENCES auth.users(id),
  event_type   event_type  NOT NULL,
  entry_kind   entry_kind  NOT NULL DEFAULT 'system',
  payload      jsonb       NOT NULL DEFAULT '{}',
  flagged      boolean     NOT NULL DEFAULT false,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE care_events
  ADD COLUMN missed boolean
  GENERATED ALWAYS AS ((payload->>'missed')::boolean) STORED;

-- ============================================================
-- JOURNAL REACTIONS
-- ============================================================
CREATE TABLE journal_reactions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid        NOT NULL REFERENCES care_events(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction   text        NOT NULL CHECK (reaction IN ('heart','thinking_of_you','strong','grateful')),
  note       text        CHECK (char_length(note) <= 280),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

-- ============================================================
-- MEDICATIONS
-- ============================================================
CREATE TABLE medications (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_id          uuid        NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
  drug_name             text        NOT NULL,
  brand_name            text,
  dosage                text        NOT NULL,
  form                  text,
  instructions          text,
  prescriber            text,
  pharmacy              text,
  pharmacy_phone        text,
  refills_remaining     integer,
  supply_days_remaining integer,
  last_refill_date      date,
  active                boolean     NOT NULL DEFAULT true,
  scan_source           text        NOT NULL DEFAULT 'manual'
                          CHECK (scan_source IN ('manual', 'ocr_scan')),
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- MEDICATION SCHEDULES
-- ============================================================
CREATE TABLE medication_schedules (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id uuid        NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  recipient_id  uuid        NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
  time_of_day   time        NOT NULL,
  days_of_week  integer[]   NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  assigned_to   uuid        REFERENCES auth.users(id),
  active        boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- OCR JOBS
-- ============================================================
CREATE TABLE ocr_jobs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_id  uuid        NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
  image_url     text        NOT NULL,
  raw_text      text,
  parsed_data   jsonb,
  medication_id uuid        REFERENCES medications(id),
  status        ocr_status  NOT NULL DEFAULT 'pending',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- SHIFTS
-- ============================================================
CREATE TABLE shifts (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_id  uuid         NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
  assigned_to   uuid         REFERENCES auth.users(id),
  status        shift_status NOT NULL DEFAULT 'open',
  starts_at     timestamptz  NOT NULL,
  ends_at       timestamptz  NOT NULL,
  recurring     boolean      NOT NULL DEFAULT false,
  recurrence    jsonb,
  claimed_at    timestamptz,
  confirmed_at  timestamptz,
  created_by    uuid         NOT NULL REFERENCES auth.users(id),
  created_at    timestamptz  NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

-- ============================================================
-- COVERAGE WINDOWS
-- ============================================================
CREATE TABLE coverage_windows (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_id  uuid        NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
  shift_id      uuid        REFERENCES shifts(id) ON DELETE SET NULL,
  starts_at     timestamptz NOT NULL,
  ends_at       timestamptz NOT NULL,
  covered       boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

-- ============================================================
-- OUTER CIRCLE REQUESTS
-- ============================================================
CREATE TABLE outer_circle_requests (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_id  uuid         NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
  share_token   text         NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  title         text         NOT NULL,
  description   text,
  request_type  request_type NOT NULL,
  slots_total   integer      NOT NULL DEFAULT 1 CHECK (slots_total > 0),
  slots_filled  integer      NOT NULL DEFAULT 0,
  needed_by     timestamptz,
  active        boolean      NOT NULL DEFAULT true,
  created_by    uuid         NOT NULL REFERENCES auth.users(id),
  created_at    timestamptz  NOT NULL DEFAULT now(),
  CHECK (slots_filled <= slots_total)
);

-- ============================================================
-- OUTER CIRCLE CLAIMS
-- ============================================================
CREATE TABLE outer_circle_claims (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    uuid        NOT NULL REFERENCES outer_circle_requests(id) ON DELETE CASCADE,
  claimer_name  text        NOT NULL,
  claimer_email text        NOT NULL,
  slot_date     timestamptz,
  note          text,
  confirmed     boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- CARE BRIEFS
-- ============================================================
CREATE TABLE care_briefs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_id  uuid        NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
  share_token   text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  title         text        NOT NULL DEFAULT 'Care brief',
  content       jsonb       NOT NULL,
  includes      text[]      NOT NULL DEFAULT '{}',
  expires_at    timestamptz,
  revoked       boolean     NOT NULL DEFAULT false,
  created_by    uuid        NOT NULL REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ATOMIC SLOT CLAIM FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION claim_outer_circle_slot(
  p_request_id  uuid,
  p_name        text,
  p_email       text,
  p_date        timestamptz DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  claim_id uuid;
BEGIN
  UPDATE outer_circle_requests
  SET    slots_filled = slots_filled + 1
  WHERE  id           = p_request_id
    AND  active       = true
    AND  slots_filled < slots_total;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'slot_unavailable';
  END IF;

  INSERT INTO outer_circle_claims (request_id, claimer_name, claimer_email, slot_date)
  VALUES (p_request_id, p_name, p_email, p_date)
  RETURNING id INTO claim_id;

  RETURN claim_id;
END;
$$;

-- ============================================================
-- HELPER FUNCTION: user_accessible_recipient
-- Returns true if the current user can access a given recipient.
-- Uses EXISTS — compatible with RLS policy expressions.
-- ============================================================
CREATE OR REPLACE FUNCTION user_can_access_recipient(p_recipient_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   memberships m
    JOIN   care_recipients cr ON cr.org_id = m.org_id
    WHERE  cr.id           = p_recipient_id
      AND  m.user_id       = auth.uid()
      AND  m.accepted_at   IS NOT NULL
      AND  (m.recipient_id IS NULL OR m.recipient_id = p_recipient_id)
  )
$$;

-- Helper: is user a coordinator in any org containing this recipient?
CREATE OR REPLACE FUNCTION user_is_coordinator_for(p_recipient_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   memberships m
    JOIN   care_recipients cr ON cr.org_id = m.org_id
    WHERE  cr.id           = p_recipient_id
      AND  m.user_id       = auth.uid()
      AND  m.role          = 'coordinator'
      AND  m.accepted_at   IS NOT NULL
  )
$$;

-- Helper: is user an active member of this org?
CREATE OR REPLACE FUNCTION user_in_org(p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   memberships
    WHERE  org_id       = p_org_id
      AND  user_id      = auth.uid()
      AND  accepted_at  IS NOT NULL
  )
$$;

-- Helper: is user a coordinator in this org?
CREATE OR REPLACE FUNCTION user_is_org_coordinator(p_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   memberships
    WHERE  org_id       = p_org_id
      AND  user_id      = auth.uid()
      AND  role         = 'coordinator'
      AND  accepted_at  IS NOT NULL
  )
$$;

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- All policies use scalar boolean functions — RLS compatible.
-- ============================================================
ALTER TABLE organizations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_vault        ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_recipients       ENABLE ROW LEVEL SECURITY;
ALTER TABLE display_names         ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships           ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_tokens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_reactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_schedules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_jobs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE coverage_windows      ENABLE ROW LEVEL SECURITY;
ALTER TABLE outer_circle_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE outer_circle_claims   ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_briefs           ENABLE ROW LEVEL SECURITY;

-- Identity vault: service_role ONLY
CREATE POLICY "vault service role only"
  ON identity_vault
  USING (auth.role() = 'service_role');

-- Organizations
CREATE POLICY "org members can read"
  ON organizations FOR SELECT
  USING (user_in_org(id));

-- Care recipients
CREATE POLICY "recipients readable by team"
  ON care_recipients FOR SELECT
  USING (user_can_access_recipient(id));

CREATE POLICY "recipients creatable by coordinators"
  ON care_recipients FOR INSERT
  WITH CHECK (user_is_org_coordinator(org_id));

-- Display names
CREATE POLICY "display names readable by team"
  ON display_names FOR SELECT
  USING (user_can_access_recipient(recipient_id));

CREATE POLICY "display names writable by service role"
  ON display_names FOR ALL
  USING (auth.role() = 'service_role');

-- Memberships
CREATE POLICY "memberships readable by team"
  ON memberships FOR SELECT
  USING (user_in_org(org_id));

CREATE POLICY "memberships insertable by coordinators"
  ON memberships FOR INSERT
  WITH CHECK (user_is_org_coordinator(org_id));

-- Invite tokens
CREATE POLICY "invite tokens coordinator access"
  ON invite_tokens FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE  m.id          = invite_tokens.membership_id
        AND  user_is_org_coordinator(m.org_id)
    )
  );

CREATE POLICY "invite tokens coordinator insert"
  ON invite_tokens FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE  m.id          = membership_id
        AND  user_is_org_coordinator(m.org_id)
    )
  );

-- Care events
CREATE POLICY "events readable by team"
  ON care_events FOR SELECT
  USING (user_can_access_recipient(recipient_id));

CREATE POLICY "events insertable by active members"
  ON care_events FOR INSERT
  WITH CHECK (
    user_can_access_recipient(recipient_id)
    AND actor_id = auth.uid()
  );

CREATE POLICY "events updatable by coordinators"
  ON care_events FOR UPDATE
  USING (user_is_coordinator_for(recipient_id));

-- Journal reactions
CREATE POLICY "reactions readable by team"
  ON journal_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM care_events ce
      WHERE  ce.id           = journal_reactions.event_id
        AND  user_can_access_recipient(ce.recipient_id)
    )
  );

CREATE POLICY "reactions insertable by members"
  ON journal_reactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "reactions deletable by owner"
  ON journal_reactions FOR DELETE
  USING (user_id = auth.uid());

-- Medications
CREATE POLICY "medications readable by team"
  ON medications FOR SELECT
  USING (user_can_access_recipient(recipient_id));

CREATE POLICY "medications writable by team"
  ON medications FOR INSERT
  WITH CHECK (user_can_access_recipient(recipient_id));

CREATE POLICY "medications updatable by team"
  ON medications FOR UPDATE
  USING (user_can_access_recipient(recipient_id));

-- Medication schedules
CREATE POLICY "schedules readable by team"
  ON medication_schedules FOR SELECT
  USING (user_can_access_recipient(recipient_id));

CREATE POLICY "schedules writable by team"
  ON medication_schedules FOR ALL
  USING (user_can_access_recipient(recipient_id));

-- OCR jobs
CREATE POLICY "ocr jobs by team"
  ON ocr_jobs FOR ALL
  USING (user_can_access_recipient(recipient_id));

-- Shifts
CREATE POLICY "shifts readable by team"
  ON shifts FOR SELECT
  USING (user_can_access_recipient(recipient_id));

CREATE POLICY "shifts writable by team"
  ON shifts FOR INSERT
  WITH CHECK (user_can_access_recipient(recipient_id));

CREATE POLICY "shifts updatable by team"
  ON shifts FOR UPDATE
  USING (user_can_access_recipient(recipient_id));

-- Coverage windows
CREATE POLICY "coverage readable by team"
  ON coverage_windows FOR SELECT
  USING (user_can_access_recipient(recipient_id));

CREATE POLICY "coverage writable by service role"
  ON coverage_windows FOR ALL
  USING (auth.role() = 'service_role');

-- Outer circle requests: open read, coordinator write
CREATE POLICY "outer requests open read"
  ON outer_circle_requests FOR SELECT
  USING (true);

CREATE POLICY "outer requests coordinator insert"
  ON outer_circle_requests FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "outer requests coordinator update"
  ON outer_circle_requests FOR UPDATE
  USING (created_by = auth.uid());

-- Outer circle claims: open insert, coordinator read
CREATE POLICY "outer claims open insert"
  ON outer_circle_claims FOR INSERT
  WITH CHECK (true);

CREATE POLICY "outer claims coordinator read"
  ON outer_circle_claims FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM outer_circle_requests r
      WHERE  r.id         = outer_circle_claims.request_id
        AND  r.created_by = auth.uid()
    )
  );

-- Care briefs: open read (token enforced in API), coordinator insert
CREATE POLICY "briefs open read"
  ON care_briefs FOR SELECT
  USING (true);

CREATE POLICY "briefs coordinator insert"
  ON care_briefs FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND user_can_access_recipient(recipient_id)
  );

CREATE POLICY "briefs coordinator update"
  ON care_briefs FOR UPDATE
  USING (created_by = auth.uid());

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_events_timeline
  ON care_events (recipient_id, occurred_at DESC);

CREATE INDEX idx_events_org_type
  ON care_events (org_id, event_type);

CREATE INDEX idx_events_actor
  ON care_events (actor_id, occurred_at DESC);

CREATE INDEX idx_events_flagged
  ON care_events (recipient_id, event_type, occurred_at DESC);

CREATE INDEX idx_events_missed
  ON care_events (recipient_id, missed)
  WHERE missed = true;

CREATE INDEX idx_memberships_user
  ON memberships (user_id, org_id, recipient_id)
  WHERE accepted_at IS NOT NULL;

CREATE INDEX idx_memberships_org
  ON memberships (org_id)
  WHERE accepted_at IS NOT NULL;

CREATE INDEX idx_meds_recipient
  ON medications (recipient_id)
  WHERE active = true;

CREATE INDEX idx_meds_supply
  ON medications (supply_days_remaining)
  WHERE active = true;

CREATE INDEX idx_schedules_med
  ON medication_schedules (medication_id)
  WHERE active = true;

CREATE INDEX idx_schedules_recipient
  ON medication_schedules (recipient_id)
  WHERE active = true;

CREATE INDEX idx_shifts_recipient_time
  ON shifts (recipient_id, starts_at);

CREATE INDEX idx_shifts_status
  ON shifts (status, starts_at)
  WHERE status IN ('open', 'claimed');

CREATE INDEX idx_coverage_recipient_time
  ON coverage_windows (recipient_id, starts_at, ends_at);

CREATE INDEX idx_coverage_uncovered
  ON coverage_windows (recipient_id, starts_at)
  WHERE covered = false;

CREATE INDEX idx_display_expiry
  ON display_names (expires_at);

CREATE INDEX idx_outer_share_token
  ON outer_circle_requests (share_token)
  WHERE active = true;

CREATE INDEX idx_brief_token
  ON care_briefs (share_token)
  WHERE revoked = false;

CREATE INDEX idx_invite_token
  ON invite_tokens (token)
  WHERE consumed_at IS NULL;
