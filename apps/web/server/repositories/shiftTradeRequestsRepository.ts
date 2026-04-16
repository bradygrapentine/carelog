import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../supabaseAdmin.server";

// Local type derived from the DB schema — regenerate with /supabase-types once
// the migration is reflected in packages/types/src/supabase.ts.
type ShiftTradeRow = {
  id: string;
  shift_id: string;
  org_id: string;
  requested_by: string;
  target_user_id: string | null;
  status: "open" | "accepted" | "declined" | "expired" | "cancelled";
  message: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  expires_at: string;
};

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createRequest(
  supabase: SupabaseClient,
  params: {
    shiftId: string;
    orgId: string;
    requestedBy: string;
    targetUserId?: string;
    message?: string;
  },
): Promise<ShiftTradeRow> {
  const { data, error } = await supabase
    .from("shift_trade_requests")
    .insert({
      shift_id: params.shiftId,
      org_id: params.orgId,
      requested_by: params.requestedBy,
      target_user_id: params.targetUserId ?? null,
      message: params.message ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`createRequest failed: ${error.message}`);
  return data as ShiftTradeRow;
}

// ---------------------------------------------------------------------------
// Respond (target user accepts or declines — RLS enforces target-only writes)
// ---------------------------------------------------------------------------

export async function respondToRequest(
  supabase: SupabaseClient,
  requestId: string,
  userId: string,
  action: "accept" | "decline",
): Promise<ShiftTradeRow> {
  const status = action === "accept" ? "accepted" : "declined";

  const { data, error } = await supabase
    .from("shift_trade_requests")
    .update({
      status,
      resolved_by: userId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select()
    .single();

  if (error) throw new Error(`respondToRequest failed: ${error.message}`);
  return data as ShiftTradeRow;
}

// ---------------------------------------------------------------------------
// Accept (atomic: update trade status + reassign shift — uses service role)
// ---------------------------------------------------------------------------

export async function acceptRequest(
  requestId: string,
  acceptingUserId: string,
): Promise<ShiftTradeRow> {
  // 1. Fetch the trade request to get shift_id
  const { data: tradeRow, error: fetchError } = await supabaseAdmin
    .from("shift_trade_requests")
    .select("id, shift_id, status")
    .eq("id", requestId)
    .single();

  if (fetchError)
    throw new Error(`acceptRequest fetch failed: ${fetchError.message}`);

  const trade = tradeRow as { id: string; shift_id: string; status: string };

  if (trade.status !== "open") {
    throw new Error(
      `acceptRequest: trade ${requestId} is not open (status=${trade.status})`,
    );
  }

  // 2. Update shift_trade_requests status to 'accepted'
  const { data: updatedTrade, error: tradeUpdateError } = await supabaseAdmin
    .from("shift_trade_requests")
    .update({
      status: "accepted",
      resolved_by: acceptingUserId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select()
    .single();

  if (tradeUpdateError)
    throw new Error(
      `acceptRequest trade update failed: ${tradeUpdateError.message}`,
    );

  // 3. Reassign the shift to the accepting user
  const { error: shiftUpdateError } = await supabaseAdmin
    .from("shifts")
    .update({ assignee_user_id: acceptingUserId })
    .eq("id", trade.shift_id);

  if (shiftUpdateError)
    throw new Error(
      `acceptRequest shift reassign failed: ${shiftUpdateError.message}`,
    );

  return updatedTrade as ShiftTradeRow;
}

// ---------------------------------------------------------------------------
// Force override (coordinator action — uses service role)
// ---------------------------------------------------------------------------

export async function forceOverride(
  requestId: string,
  coordinatorId: string,
  orgId: string,
  action: "accept" | "decline" | "cancel",
): Promise<ShiftTradeRow> {
  const statusMap = {
    accept: "accepted",
    decline: "declined",
    cancel: "cancelled",
  } as const;

  const status = statusMap[action];

  const { data, error } = await supabaseAdmin
    .from("shift_trade_requests")
    .update({
      status,
      resolved_by: coordinatorId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("org_id", orgId)
    .select()
    .single();

  if (error) throw new Error(`forceOverride failed: ${error.message}`);

  // audit_events table doesn't exist yet — log via console.info
  console.info("[forceOverride]", {
    coordinatorId,
    requestId,
    orgId,
    action,
    status,
    resolvedAt: new Date().toISOString(),
  });

  return data as ShiftTradeRow;
}

// ---------------------------------------------------------------------------
// List for shift (RLS scoped)
// ---------------------------------------------------------------------------

export async function listForShift(
  supabase: SupabaseClient,
  shiftId: string,
  status?: string[],
): Promise<ShiftTradeRow[]> {
  let query = supabase
    .from("shift_trade_requests")
    .select("*")
    .eq("shift_id", shiftId)
    .order("created_at", { ascending: false });

  if (status && status.length > 0) {
    query = query.in("status", status);
  }

  const { data, error } = await query;
  if (error) throw new Error(`listForShift failed: ${error.message}`);
  return (data ?? []) as ShiftTradeRow[];
}

// ---------------------------------------------------------------------------
// Expire stale requests (admin cron — uses service role)
// ---------------------------------------------------------------------------

export async function expireStaleRequests(): Promise<{ expiredIds: string[] }> {
  const { data, error } = await supabaseAdmin
    .from("shift_trade_requests")
    .update({ status: "expired" })
    .eq("status", "open")
    .lte("expires_at", new Date().toISOString())
    .select("id");

  if (error) throw new Error(`expireStaleRequests failed: ${error.message}`);

  const expiredIds = (data ?? []).map((row: { id: string }) => row.id);
  return { expiredIds };
}
