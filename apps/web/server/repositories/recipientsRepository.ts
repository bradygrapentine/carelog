import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

const PreferencesSchema = z.object({
  likes: z.array(z.string()).default([]),
  dislikes: z.array(z.string()).default([]),
});

export type RecipientPreferences = {
  likes: string[];
  dislikes: string[];
};

/**
 * UX-104: read likes/dislikes from `care_recipients.preferences jsonb`.
 *
 * Takes a session-scoped supabase client (NOT supabaseAdmin) so RLS scoping
 * to the caller's orgs is the second line of defense behind the page's
 * RLS-gated `care_recipients` lookup. A non-member naturally gets a 0-row
 * result and the function returns empty defaults rather than leaking another
 * org's preferences.
 *
 * Permissive parse with empty-array defaults — an old/malformed jsonb blob
 * should not break the profile page.
 */
export async function getRecipientPreferences(
  supabase: SupabaseClient,
  orgId: string,
  recipientId: string,
): Promise<RecipientPreferences> {
  const { data, error } = await supabase
    .from("care_recipients")
    .select("preferences")
    .eq("org_id", orgId)
    .eq("id", recipientId)
    .maybeSingle();

  if (error)
    throw new Error(`getRecipientPreferences failed: ${error.message}`);

  const parsed = PreferencesSchema.safeParse(data?.preferences ?? {});
  return {
    likes: parsed.success ? parsed.data.likes : [],
    dislikes: parsed.success ? parsed.data.dislikes : [],
  };
}
