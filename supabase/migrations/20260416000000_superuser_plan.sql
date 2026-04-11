-- Upgrade brady.grapentine@gmail.com's org to professional plan.
-- Safe to run in any environment (staging, prod). No-op if email not found.

UPDATE public.organizations
SET plan = 'professional'
WHERE id IN (
  SELECT m.org_id
  FROM public.memberships m
  JOIN auth.users u ON u.id = m.user_id
  WHERE u.email = 'brady.grapentine@gmail.com'
);
