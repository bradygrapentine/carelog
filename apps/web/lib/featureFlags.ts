import { createServerSupabase } from "@/lib/supabaseServer";
import { getPostHogClient } from "@/lib/posthog-server";

/**
 * Server-side feature flag evaluation.
 *
 * distinctId is derived from the authenticated Supabase session
 * (user.id is the anonymous UUID per ADR-0001). There is NO way
 * for a caller to pass email/name — by design.
 *
 * Returns false when:
 *   - no authenticated session (anonymous user)
 *   - PostHog is unreachable (fail-closed)
 *   - flag is disabled or undefined
 *
 * See docs/adr/0004-feature-flag-rollout-pattern.md for rollout guidance.
 */
export async function getFeatureFlag(flag: string): Promise<boolean> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) return false; // anonymous — flag off

  const client = getPostHogClient();
  try {
    const value = await client.isFeatureEnabled(flag, user.id);
    return value === true;
  } catch {
    return false; // fail-closed
  }
}
