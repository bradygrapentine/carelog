-- ON-44: Comment threads on care events
-- Flat list, soft-delete only, author-only edit/delete, RLS mirrors care_events.

CREATE TABLE care_event_comments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  care_event_id   uuid        NOT NULL REFERENCES care_events(id) ON DELETE CASCADE,
  org_id          uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  author_id       uuid        NOT NULL REFERENCES auth.users(id),
  body            text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  edited_at       timestamptz,
  deleted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX care_event_comments_event_created_idx
  ON care_event_comments (care_event_id, created_at);
CREATE INDEX care_event_comments_org_idx
  ON care_event_comments (org_id);

ALTER TABLE care_event_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "care_event_comments_member_select"
  ON care_event_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = care_event_comments.org_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "care_event_comments_member_insert"
  ON care_event_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.org_id = care_event_comments.org_id
        AND m.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM care_events ce
      WHERE ce.id = care_event_comments.care_event_id
        AND ce.org_id = care_event_comments.org_id
    )
  );

CREATE POLICY "care_event_comments_author_update"
  ON care_event_comments FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- DELETE prohibited (soft-delete only — no DELETE policy)

ALTER PUBLICATION supabase_realtime ADD TABLE care_event_comments;

ALTER TABLE notification_preferences
  ADD COLUMN care_event_comments boolean NOT NULL DEFAULT true;
