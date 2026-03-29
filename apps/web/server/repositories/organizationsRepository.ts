import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../supabaseAdmin.server";
import type { Organization } from "@carelog/types";

export async function getOrganization(
  supabase: SupabaseClient,
  orgId: string,
): Promise<Organization | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();

  if (error) return null;
  return data as Organization;
}

export async function createOrganization(params: {
  name: string;
  orgType: string;
}): Promise<Organization> {
  const { data, error } = await supabaseAdmin
    .from("organizations")
    .insert({
      name: params.name,
      org_type: params.orgType,
      plan: "free",
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Org creation failed: ${error?.message}`);
  }

  return data as Organization;
}

export async function getUserOrganizations(
  supabase: SupabaseClient,
  userId: string,
): Promise<Organization[]> {
  const { data, error } = await supabase
    .from("memberships")
    .select("organizations(*)")
    .eq("user_id", userId)
    .not("accepted_at", "is", null);

  if (error) throw new Error(`Org fetch failed: ${error.message}`);

  return (data ?? [])
    .map((m: unknown) => (m as { organizations: Organization }).organizations)
    .filter(Boolean) as Organization[];
}
