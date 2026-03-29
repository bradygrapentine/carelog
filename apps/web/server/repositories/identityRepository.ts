// identity_vault stores real names, DOB, and contact info — the PHI boundary.
// care_recipients never stores real names; it holds only an identity_token UUID.
// All functions here require supabaseAdmin (service role) because identity_vault
// has RLS policies that return 0 rows to anon and authenticated roles.
import { supabaseAdmin } from "../supabaseAdmin.server";

export interface IdentityRecord {
  full_name: string;
  dob: string | null;
  contact_info: Record<string, unknown>;
}

export async function resolveIdentity(
  token: string,
  orgId: string,
): Promise<IdentityRecord> {
  const { data, error } = await supabaseAdmin
    .from("identity_vault")
    .select("full_name, dob, contact_info")
    .eq("token", token)
    .eq("org_id", orgId)
    .single();

  if (error || !data) {
    throw new Error(`Identity resolution failed: ${error?.message}`);
  }

  return data as IdentityRecord;
}

export async function createIdentity(params: {
  orgId: string;
  fullName: string;
  dob?: string;
  contactInfo?: Record<string, unknown>;
}): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("identity_vault")
    .insert({
      org_id: params.orgId,
      full_name: params.fullName,
      dob: params.dob ?? null,
      contact_info: params.contactInfo ?? {},
    })
    .select("token")
    .single();

  if (error || !data) {
    throw new Error(`Identity creation failed: ${error?.message}`);
  }

  return data.token as string;
}

// Cache-aside pattern: check display_names first (24h TTL), fall back to the
// vault on miss, then write the result back to the cache.
// This avoids a vault read on every timeline render (50 events = 50 vault reads
// without the cache). The cache is written by service role, read by authenticated.
export async function resolveAndCacheDisplayName(
  recipientId: string,
  orgId: string,
  token: string,
): Promise<string> {
  const { data: cached } = await supabaseAdmin
    .from("display_names")
    .select("full_name, expires_at")
    .eq("recipient_id", recipientId)
    .single();

  if (cached && new Date(cached.expires_at) > new Date()) {
    return cached.full_name as string;
  }

  // Cache miss — go to the vault (requires service role)
  const identity = await resolveIdentity(token, orgId);

  // Write back to cache with a 24-hour TTL
  await supabaseAdmin.from("display_names").upsert({
    recipient_id: recipientId,
    org_id: orgId,
    full_name: identity.full_name,
    cached_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });

  return identity.full_name;
}
