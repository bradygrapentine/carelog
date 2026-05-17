import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../supabaseAdmin.server";
import type { Membership } from "@carelog/types";

export async function getMemberships(
  supabase: SupabaseClient,
  orgId: string,
  recipientId?: string,
): Promise<Membership[]> {
  let query = supabase
    .from("memberships")
    .select("*")
    .eq("org_id", orgId)
    .not("accepted_at", "is", null);

  if (recipientId) {
    // Include org-wide members (recipient_id IS NULL — coordinators/supervisors)
    // alongside members scoped to this specific recipient.
    query = query.or(`recipient_id.eq.${recipientId},recipient_id.is.null`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Memberships fetch failed: ${error.message}`);
  return (data ?? []) as Membership[];
}

export type CareTeamMember = {
  id: string;
  name: string;
  role: string;
  initials?: string;
};

function initialsFromName(name: string): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  const out = (first + last).toUpperCase();
  return out || undefined;
}

// TD-121: bound concurrent supabaseAdmin.auth.admin.getUserById() calls below
// the Supabase Auth Admin per-second rate limit (50/s/project). Chunking at 8
// keeps a 50-member team well under the limit even with a concurrent profile
// load. Pairs with the .limit(50) cap on the memberships query below.
const CARE_TEAM_CHUNK_SIZE = 8;

/**
 * UX-103: care-team list for the recipient profile page.
 * Returns accepted members of `orgId` whose membership is either scoped to
 * `recipientId` or org-wide (recipient_id NULL).
 *
 * Member display names live in `auth.users.user_metadata` — there is no
 * cache table for member names (display_names is recipient-only). Resolve
 * each name via `supabaseAdmin.auth.admin.getUserById()` per the precedent
 * in `briefs.ts:232`. Falls back to "Member" when metadata is absent.
 */
export async function getCareTeamForRecipient(
  supabase: SupabaseClient,
  orgId: string,
  recipientId: string,
): Promise<CareTeamMember[]> {
  // TD-120: read memberships via session-scoped supabase (RLS-gated) instead
  // of supabaseAdmin (service-role bypass). Mirrors the pattern set by
  // getRecipientPreferences (recipientsRepository.ts:26). Per-member name
  // resolution below stays on supabaseAdmin — auth.admin.getUserById is the
  // only way to read user_metadata.
  const { data: rows, error } = await supabase
    .from("memberships")
    .select("id, user_id, role, recipient_id")
    .eq("org_id", orgId)
    .or(`recipient_id.eq.${recipientId},recipient_id.is.null`)
    .not("accepted_at", "is", null)
    .not("user_id", "is", null)
    .limit(50);

  if (error)
    throw new Error(`getCareTeamForRecipient failed: ${error.message}`);

  const rowList = rows ?? [];
  const members: CareTeamMember[] = [];
  for (let i = 0; i < rowList.length; i += CARE_TEAM_CHUNK_SIZE) {
    const chunk = rowList.slice(i, i + CARE_TEAM_CHUNK_SIZE);
    const settled = await Promise.allSettled(
      chunk.map(async (row) => {
        const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(
          row.user_id as string,
        );
        const meta = userRes?.user?.user_metadata as
          | { display_name?: string; full_name?: string }
          | undefined;
        const name = meta?.display_name ?? meta?.full_name ?? "Member";
        return {
          id: row.id as string,
          name,
          role: row.role as string,
          initials: initialsFromName(name),
        };
      }),
    );
    for (const result of settled) {
      if (result.status === "fulfilled") {
        members.push(result.value);
      } else {
        // Rejected = getUserById blip / 429. Drop the member silently from
        // the list rather than 500ing the page; surface the cause for prod
        // observability.
        console.warn(
          "getCareTeamForRecipient: getUserById rejected",
          result.reason,
        );
      }
    }
  }

  return members;
}

export async function createMembershipAndInvite(params: {
  orgId: string;
  recipientId: string | null;
  role: string;
  email: string;
}): Promise<{ membershipId: string; token: string }> {
  // user_id is null for pending memberships — set to the accepting user's ID
  // by the accept_invite SQL RPC when the invite is consumed.
  const { data: membership, error: mError } = await supabaseAdmin
    .from("memberships")
    .insert({
      org_id: params.orgId,
      user_id: null,
      recipient_id: params.recipientId,
      role: params.role,
    })
    .select("id")
    .single();

  if (mError || !membership) {
    throw new Error(`Membership creation failed: ${mError?.message}`);
  }

  const { data: invite, error: iError } = await supabaseAdmin
    .from("invite_tokens")
    .insert({
      membership_id: membership.id,
      email: params.email.toLowerCase(),
    })
    .select("token")
    .single();

  if (iError || !invite) {
    throw new Error(`Invite token creation failed: ${iError?.message}`);
  }

  return {
    membershipId: membership.id as string,
    token: invite.token as string,
  };
}

// TD-142: the previous TS `acceptInvite` was deleted. It used a non-atomic
// Promise.all of two UPDATEs and was already dead code — both production
// callers go through the `accept_invite(text, uuid, text)` SQL function:
//   - tRPC: apps/web/server/routers/memberships.ts → supabaseAdmin.rpc('accept_invite', ...)
//   - HTTP: apps/web/app/api/invite/[token]/accept/route.ts → same RPC
// Semantics live in supabase/migrations/20260407000000_atomic_invite_accept.sql
// (single-tx token consume + membership activation). Access control is locked
// down by supabase/migrations/20260516000000_revoke_accept_invite_from_anon_authenticated.sql
// — anon and authenticated cannot EXECUTE the function; only service_role.
// Any future `CREATE OR REPLACE FUNCTION accept_invite(...)` MUST be followed
// by a fresh REVOKE FROM anon, authenticated to preserve that boundary.
