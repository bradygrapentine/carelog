-- Add FK from burnout_checkins.user_id → auth.users(id)
-- Ensures orphaned rows are cleaned up if a user account is deleted.
-- Separate migration to keep schema changes atomic.
ALTER TABLE burnout_checkins
  ADD CONSTRAINT burnout_checkins_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
