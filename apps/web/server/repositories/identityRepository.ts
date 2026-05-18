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
 * TD-179: backed by `public.update_emergency_info` SECURITY DEFINER RPC
 * (migration 20260518090000). RPC does an atomic shallow top-level merge via
 * `jsonb_strip_nulls(existing || patch)` server-side. Eliminates the JS
 * read-merge-write race the prior implementation carried.
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
  // Build snake_case jsonb patch.
  // - undefined → skip key entirely (server preserves existing value)
  // - null/"" → pass null (server's jsonb_strip_nulls clears the key)
  // - value → pass through
  const patchJson: Record<string, unknown> = {};
  if (patch.dnrStatus !== undefined) {
    patchJson.dnr_status =
      patch.dnrStatus === null || patch.dnrStatus === ""
        ? null
        : patch.dnrStatus;
  }
  if (patch.hospital !== undefined) {
    patchJson.hospital =
      patch.hospital === null || patch.hospital === "" ? null : patch.hospital;
  }
  if (patch.primaryContact !== undefined) {
    patchJson.primary_contact =
      patch.primaryContact === null ? null : patch.primaryContact;
  }

  const { data, error } = await supabaseAdmin.rpc("update_emergency_info", {
    p_org_id: orgId,
    p_recipient_id: recipientId,
    p_patch: patchJson,
  });

  if (error) {
    // SQLSTATE-based mapping (NOT string-matching error.message).
    // P0002  → recipient missing or cross-org access denied.
    // P0IDF  → recipient resolved but identity vault row missing.
    //          (User-defined SQLSTATE; class P0 is documented PL/pgSQL user
    //          space; class 45 was originally chosen but is non-conformant
    //          per SQLSTATE spec — see TD-188 hotfix.)
    if (error.code === "P0002") {
      throw new Error("recipient_not_found");
    }
    if (error.code === "P0IDF") {
      throw new Error("identity_not_found");
    }
    // Catch-all: DROP raw error.message entirely. PG error messages may
    // include column values (e.g. `Key (email)=(jane@x.com)`), which is
    // a PHI leak path into thrown Error → Sentry capture → log aggregator.
    // Code-only signal preserves debuggability without leaking PII.
    throw new Error(`identity_update_failed: ${error.code ?? "UNKNOWN"}`);
  }

  return parseEmergencyInfo((data ?? {}) as Record<string, unknown>);
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
