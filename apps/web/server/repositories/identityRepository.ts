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

/**
 * UX-105: shape used by EmergencyFooterCard. Parsed from
 * `identity_vault.contact_info jsonb`. PHI lives behind identity_token
 * resolution; the page's RLS-scoped care_recipients read serves as the
 * membership gate before resolveIdentity runs.
 */
export interface EmergencyInfo {
  dnrStatus?: string;
  primaryContact?: {
    name: string;
    relationship?: string;
    phone?: string;
  };
  hospital?: string;
}

/**
 * Permissive parse of `contact_info jsonb` for emergency fields.
 * Pure function — never throws; unknown shapes return `{}`.
 */
export function parseEmergencyInfo(
  contactInfo: Record<string, unknown>,
): EmergencyInfo {
  const out: EmergencyInfo = {};
  const dnr = contactInfo.dnr_status;
  if (typeof dnr === "string" && dnr.trim()) out.dnrStatus = dnr;
  const hospital = contactInfo.hospital;
  if (typeof hospital === "string" && hospital.trim()) out.hospital = hospital;
  const pc = contactInfo.primary_contact;
  if (pc && typeof pc === "object" && !Array.isArray(pc)) {
    const obj = pc as Record<string, unknown>;
    const name = obj.name;
    if (typeof name === "string" && name.trim()) {
      out.primaryContact = { name };
      const rel = obj.relationship;
      if (typeof rel === "string" && rel.trim())
        out.primaryContact.relationship = rel;
      const phone = obj.phone;
      if (typeof phone === "string" && phone.trim())
        out.primaryContact.phone = phone;
    }
  }
  return out;
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

/**
 * UX-105b: write-side patch shape for the emergency-info edit affordance.
 * - `undefined` → leave the existing key untouched
 * - `null` or empty string → clear (remove) the key from contact_info
 * - non-empty value → set
 *
 * Implementation uses read-merge-write rather than a Postgres `jsonb_set`
 * RPC because adding an RPC requires a migration which is out of scope for
 * UX-105b. The lost-update window under concurrent edits is accepted: this
 * surface has at most one coordinator editing the recipient profile at a
 * time. If concurrent-edit conflicts surface in practice, promote to an
 * RPC-backed jsonb_set in a follow-up.
 */
export type EmergencyInfoPatch = {
  dnrStatus?: string | null;
  primaryContact?: {
    name: string;
    relationship?: string;
    phone?: string;
  } | null;
  hospital?: string | null;
};

export async function updateEmergencyInfo(
  orgId: string,
  recipientId: string,
  patch: EmergencyInfoPatch,
): Promise<EmergencyInfo> {
  const { data: recipient, error: recipientError } = await supabaseAdmin
    .from("care_recipients")
    .select("identity_token")
    .eq("id", recipientId)
    .eq("org_id", orgId)
    .single();
  if (recipientError || !recipient) {
    throw new Error("recipient_not_found");
  }
  const identityToken = (recipient as { identity_token: string })
    .identity_token;

  const { data: current, error: readError } = await supabaseAdmin
    .from("identity_vault")
    .select("contact_info")
    .eq("token", identityToken)
    .eq("org_id", orgId)
    .single();
  if (readError || !current) {
    throw new Error("identity_not_found");
  }
  const existing = ((
    current as { contact_info: Record<string, unknown> | null }
  ).contact_info ?? {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...existing };

  if (patch.dnrStatus !== undefined) {
    if (patch.dnrStatus === null || patch.dnrStatus === "") {
      delete merged.dnr_status;
    } else {
      merged.dnr_status = patch.dnrStatus;
    }
  }
  if (patch.hospital !== undefined) {
    if (patch.hospital === null || patch.hospital === "") {
      delete merged.hospital;
    } else {
      merged.hospital = patch.hospital;
    }
  }
  if (patch.primaryContact !== undefined) {
    if (patch.primaryContact === null) {
      delete merged.primary_contact;
    } else {
      merged.primary_contact = patch.primaryContact;
    }
  }

  const { error: writeError } = await supabaseAdmin
    .from("identity_vault")
    .update({ contact_info: merged })
    .eq("token", identityToken)
    .eq("org_id", orgId);
  if (writeError) {
    throw new Error(`identity_update_failed: ${writeError.message}`);
  }
  return parseEmergencyInfo(merged);
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
