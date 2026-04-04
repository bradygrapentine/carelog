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
