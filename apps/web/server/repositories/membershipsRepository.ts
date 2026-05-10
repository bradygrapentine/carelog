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
  orgId: string,
  recipientId: string,
): Promise<CareTeamMember[]> {
  const { data: rows, error } = await supabaseAdmin
    .from("memberships")
    .select("id, user_id, role, recipient_id")
    .eq("org_id", orgId)
    .or(`recipient_id.eq.${recipientId},recipient_id.is.null`)
    .not("accepted_at", "is", null)
    .not("user_id", "is", null);

  if (error)
    throw new Error(`getCareTeamForRecipient failed: ${error.message}`);

  const members = await Promise.all(
    (rows ?? []).map(async (row) => {
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

  return members;
}

export async function createMembershipAndInvite(params: {
  orgId: string;
  recipientId: string | null;
  role: string;
  email: string;
}): Promise<{ membershipId: string; token: string }> {
  // user_id is null for pending memberships — set to the accepting user's ID
  // by acceptInvite() when the invite is consumed.
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

export async function acceptInvite(
  token: string,
  acceptingUser: { id: string; email: string },
): Promise<void> {
  const { data: invite, error: iError } = await supabaseAdmin
    .from("invite_tokens")
    .select("id, membership_id, email, expires_at, consumed_at")
    .eq("token", token)
    .single();

  if (iError || !invite) throw new Error("Invalid invite token");
  if (invite.consumed_at) throw new Error("This invite has already been used");
  if (new Date(invite.expires_at) < new Date())
    throw new Error("This invite has expired");

  if (invite.email !== acceptingUser.email.toLowerCase()) {
    throw new Error("This invite was sent to a different email address");
  }

  // Mark token consumed and activate membership together. Promise.all sends both
  // updates concurrently. Note: this is not a true DB transaction — if one update
  // fails after the other succeeds the state will be inconsistent. A Postgres RPC
  // function would be the correct fix for production.
  await Promise.all([
    supabaseAdmin
      .from("invite_tokens")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", invite.id),

    supabaseAdmin
      .from("memberships")
      .update({
        user_id: acceptingUser.id,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invite.membership_id),
  ]);
}
