CREATE TABLE push_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token        TEXT NOT NULL UNIQUE,
  platform     TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can read and write their own tokens only
CREATE POLICY "push_tokens_owner_select" ON push_tokens
  FOR SELECT USING (auth_user_id = auth.uid());

CREATE POLICY "push_tokens_owner_insert" ON push_tokens
  FOR INSERT WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "push_tokens_owner_delete" ON push_tokens
  FOR DELETE USING (auth_user_id = auth.uid());

-- Index for coordinator push queries (auth_user_id looked up in bulk)
CREATE INDEX push_tokens_auth_user_id_idx ON push_tokens (auth_user_id);
