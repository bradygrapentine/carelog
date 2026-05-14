-- TD-132 / FIND-007: cap ai_conversations.messages at 50 entries per row.
-- Defends against unbounded jsonb[] growth (LLM10).
-- No app-code write site exists today (only revokeConsent DELETE in ai.ts);
-- enforcing at DB layer covers any future caller.
ALTER TABLE ai_conversations
  ADD CONSTRAINT ai_conversations_messages_cap
  CHECK (array_length(messages, 1) IS NULL OR array_length(messages, 1) <= 50);
