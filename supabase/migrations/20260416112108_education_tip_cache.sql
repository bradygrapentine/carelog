-- education_tip_cache: one row per org, stores the most relevant guide slug
-- refreshed daily by Inngest educationTip.refresh function

CREATE TABLE IF NOT EXISTS education_tip_cache (
  org_id        uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  guide_slug    text NOT NULL,
  refreshed_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE education_tip_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE education_tip_cache FORCE ROW LEVEL SECURITY;

-- Org members can read their own org's tip; no user writes (Inngest uses service role)
CREATE POLICY "org members read own tip"
  ON education_tip_cache FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM memberships
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

-- Explicitly prohibit member deletes (belt-and-suspenders: no permissive DELETE policy already blocks)
CREATE POLICY "deny member delete"
  ON education_tip_cache FOR DELETE
  USING (false);

-- user_profiles: add education tip dismissal
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS education_tip_dismissed_until timestamptz;
