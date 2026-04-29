-- ============================================================
-- Editorial-emphasis headline for care_briefs.
--
-- Per DESIGN.md the brief is the one app surface where Fraunces
-- italic-violet <em> emphasis is sanctioned (Italic-Emphasis Rule).
-- Stored as a structured Span[] so the renderer can wrap emphasis
-- spans in <em> without parsing strings:
--   [{"text": "Mom slept "}, {"text": "poorly", "em": true}, ...]
--
-- Nullable: legacy briefs created before this migration have no
-- structured headline. Renderer falls back to the existing `title`
-- column when `headline` is null.
-- ============================================================

ALTER TABLE care_briefs
  ADD COLUMN headline jsonb;

COMMENT ON COLUMN care_briefs.headline IS
  'Structured editorial headline as Span[]: [{text: string, em?: boolean}]. Nullable for legacy rows; the title column is the plain-text fallback.';
