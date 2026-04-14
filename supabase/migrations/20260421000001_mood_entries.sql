-- ON-24: mood_entries table (PHI)
-- Caregiver-logged mood observations for a care recipient.
-- Org-scoped; author-only update/delete; org members can read.

CREATE TABLE mood_entries (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_id  uuid        NOT NULL REFERENCES care_recipients(id) ON DELETE CASCADE,
  author_id     uuid        NOT NULL REFERENCES auth.users(id),
  mood          text        NOT NULL
                            CHECK (mood IN ('good', 'okay', 'difficult', 'crisis')),
  note          text        CHECK (char_length(note) <= 1000),
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mood_entries ENABLE ROW LEVEL SECURITY;

-- Org members can read mood entries for recipients they can access
CREATE POLICY "mood_entries_readable_by_team"
  ON mood_entries FOR SELECT
  USING (user_can_access_recipient(recipient_id));

-- Active org members can insert mood entries for accessible recipients
CREATE POLICY "mood_entries_insertable_by_team"
  ON mood_entries FOR INSERT
  WITH CHECK (
    user_can_access_recipient(recipient_id)
    AND author_id = auth.uid()
  );

-- Only the author can update their own entry
CREATE POLICY "mood_entries_author_update"
  ON mood_entries FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- Only the author can delete their own entry
CREATE POLICY "mood_entries_author_delete"
  ON mood_entries FOR DELETE
  USING (author_id = auth.uid());

CREATE INDEX mood_entries_recipient_idx ON mood_entries (recipient_id, occurred_at DESC);
CREATE INDEX mood_entries_author_idx    ON mood_entries (author_id);
