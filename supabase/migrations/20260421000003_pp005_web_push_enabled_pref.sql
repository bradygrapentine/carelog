-- PP-005 follow-up: add web_push_enabled to notification_preferences.
-- Originally lived in 20260416200000_pp005_web_push.sql but ran before
-- 20260421000000_notification_preferences.sql created the table — broken
-- on every fresh apply (RLS pgTAP CI). Moved here so the column lands
-- right after the table is created.

alter table public.notification_preferences
  add column if not exists web_push_enabled boolean not null default true;
