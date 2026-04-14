-- ON-22: notification_preferences table
-- Per-user notification settings. Owner-only access.

CREATE TABLE notification_preferences (
  user_id             uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  push_enabled        boolean     NOT NULL DEFAULT true,
  email_enabled       boolean     NOT NULL DEFAULT true,
  sms_enabled         boolean     NOT NULL DEFAULT false,
  digest_frequency    text        NOT NULL DEFAULT 'daily'
                                  CHECK (digest_frequency IN ('realtime', 'daily', 'weekly', 'never')),
  quiet_hours_start   time,
  quiet_hours_end     time,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Owner can read their own preferences
CREATE POLICY "notification_preferences_owner_select"
  ON notification_preferences FOR SELECT
  USING (user_id = auth.uid());

-- Owner can insert their own preferences
CREATE POLICY "notification_preferences_owner_insert"
  ON notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Owner can update their own preferences
CREATE POLICY "notification_preferences_owner_update"
  ON notification_preferences FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Owner can delete their own preferences
CREATE POLICY "notification_preferences_owner_delete"
  ON notification_preferences FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX notification_preferences_user_id_idx ON notification_preferences (user_id);
