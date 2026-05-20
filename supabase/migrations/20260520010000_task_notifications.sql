-- ON-81: Configurable task notifications (email + in-app; on-call routing).
--
-- Two changes:
--   (1) Extend notification_preferences with per-event task toggles. The table's
--       owner-only RLS (user_id = auth.uid()) covers added columns automatically
--       (ON-22), so a user can only read/write their OWN task preferences — no new
--       policy needed (threat model FIND-003).
--   (2) A net-new in_app_notifications feed. Owner-only read/update; INSERT is
--       service-role-only (Inngest fanout) — RLS enabled with NO insert policy is
--       default-deny for `authenticated`, and service_role bypasses RLS at the
--       connection level (same posture as email_dispatch_log). FIND-004.
--
-- Defaults: assigned/completed notify by default; created defaults OFF (a
-- coordinator creating many tasks shouldn't spam the team on every create).

-- (1) Task notification preferences ------------------------------------------
ALTER TABLE notification_preferences
  ADD COLUMN IF NOT EXISTS task_assigned  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS task_completed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS task_created   boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN notification_preferences.task_assigned IS
  'ON-81: notify this user when a task is assigned to them.';
COMMENT ON COLUMN notification_preferences.task_completed IS
  'ON-81: notify this user (requester/assignee) when a task they care about is completed.';
COMMENT ON COLUMN notification_preferences.task_created IS
  'ON-81: notify on task creation. Default off — opt-in to avoid create-spam.';

-- (2) In-app notification feed -----------------------------------------------
CREATE TABLE in_app_notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id        uuid NOT NULL,
  recipient_id  uuid,
  type          text NOT NULL CHECK (type IN ('task_assigned', 'task_completed', 'task_created')),
  task_id       uuid,
  title         text,
  body          text,
  read_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Unread-feed read path: newest-first per user.
CREATE INDEX in_app_notifications_unread_idx
  ON in_app_notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

-- Idempotency for the service-role fanout INSERT: one notification per
-- (user, event-type, task). A double-fire (e.g. complete + update-to-done)
-- raises 23505, which the Inngest fn catches and skips (FIND-005 / M2).
CREATE UNIQUE INDEX in_app_notifications_dedup_idx
  ON in_app_notifications (user_id, type, task_id);

ALTER TABLE in_app_notifications ENABLE ROW LEVEL SECURITY;

-- Owner can read their own notifications.
CREATE POLICY "in_app_notifications_owner_select"
  ON in_app_notifications FOR SELECT
  USING (user_id = auth.uid());

-- Owner can mark their own notifications read (the only mutation a user makes).
CREATE POLICY "in_app_notifications_owner_update"
  ON in_app_notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- NO insert/delete policy: default-deny for anon/authenticated. The Inngest
-- fanout writes via service_role (bypasses RLS), the same posture as
-- email_dispatch_log.

COMMENT ON TABLE in_app_notifications IS
  'ON-81: per-user in-app task-notification feed. Owner-only read/update RLS; service-role-only insert from the Inngest task-notification fanout. Partial unique (user_id,type,task_id) makes the fanout INSERT idempotent against retry/double-emit.';
