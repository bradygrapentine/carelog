-- AI assistant: user opt-in flag
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS ai_assistant_enabled boolean NOT NULL DEFAULT false;

-- ai_conversations: optional session history (de-identified prompts only — no PHI)
CREATE TABLE IF NOT EXISTS ai_conversations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  messages    jsonb[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner only read"
  ON ai_conversations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "owner only insert"
  ON ai_conversations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "owner only update"
  ON ai_conversations FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "owner only delete"
  ON ai_conversations FOR DELETE
  USING (user_id = auth.uid());
