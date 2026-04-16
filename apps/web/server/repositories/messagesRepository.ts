// apps/web/server/repositories/messagesRepository.ts
import { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../supabaseAdmin.server";
import type { Database } from "@carelog/types";

type Client = SupabaseClient<Database>;

/** Returns all threads the user belongs to, with unread count and last message preview. */
export async function listThreadsForUser(
  client: Client,
  userId: string,
  orgId: string,
) {
  const { data, error } = await client
    .from("message_threads")
    .select(
      `id, thread_type, name, created_at,
       message_thread_members!inner(user_id, last_read_at),
       messages(id, body, created_at, deleted_at,
         sender:user_profiles(display_name))`,
    )
    .eq("org_id", orgId)
    .eq("message_thread_members.user_id", userId)
    .order("created_at", { referencedTable: "messages", ascending: false })
    .limit(1, { referencedTable: "messages" });

  if (error) throw error;
  return (data ?? []) as Record<string, unknown>[];
}

/** Returns paginated messages for a thread. */
export async function getThreadMessages(
  client: Client,
  threadId: string,
  limit = 50,
  before?: string, // ISO datetime cursor
) {
  let query = client
    .from("messages")
    .select("*, sender:user_profiles(display_name)")
    .eq("thread_id", threadId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (before) query = query.lt("created_at", before);

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).reverse(); // chronological order
}

/** Returns thread members with display names. */
export async function getThreadMembers(client: Client, threadId: string) {
  const { data, error } = await client
    .from("message_thread_members")
    .select("*, profile:user_profiles(display_name)")
    .eq("thread_id", threadId);

  if (error) throw error;
  return (data ?? []) as Record<string, unknown>[];
}

/** Idempotent DM creation. Returns existing thread if one exists between the two users. */
export async function findOrCreateDm(
  userId: string,
  targetUserId: string,
  orgId: string,
): Promise<string> {
  // Find existing DM thread with exactly these two members
  const { data: existing } = await supabaseAdmin.rpc(
    "find_dm_thread" as never,
    { p_user_a: userId, p_user_b: targetUserId, p_org_id: orgId },
  );

  if (existing) return existing as string;

  // Create new DM thread
  const { data: thread, error: threadErr } = await supabaseAdmin
    .from("message_threads")
    .insert({ org_id: orgId, thread_type: "dm", created_by: userId })
    .select("id")
    .single();

  if (threadErr || !thread) throw threadErr ?? new Error("Failed to create DM");

  await supabaseAdmin.from("message_thread_members").insert([
    { thread_id: thread.id, user_id: userId },
    { thread_id: thread.id, user_id: targetUserId },
  ]);

  return thread.id as string;
}

/** Creates a group thread with the creator + given member IDs. */
export async function createGroupThread(
  userId: string,
  orgId: string,
  name: string,
  memberUserIds: string[],
): Promise<string> {
  const { data: thread, error } = await supabaseAdmin
    .from("message_threads")
    .insert({ org_id: orgId, thread_type: "group", name, created_by: userId })
    .select("id")
    .single();

  if (error || !thread) throw error ?? new Error("Failed to create group");

  const allMembers = Array.from(new Set([userId, ...memberUserIds]));
  await supabaseAdmin
    .from("message_thread_members")
    .insert(allMembers.map((uid) => ({ thread_id: thread.id, user_id: uid })));

  return thread.id as string;
}

/** Inserts a message and returns the created row. */
export async function insertMessage(
  client: Client,
  threadId: string,
  senderId: string,
  body: string,
) {
  const { data, error } = await client
    .from("messages")
    .insert({ thread_id: threadId, sender_id: senderId, body })
    .select("*, sender:user_profiles(display_name)")
    .single();

  if (error) throw error;
  return data as Record<string, unknown> & {
    id: string;
    thread_id: string;
    sender_id: string;
    body: string;
    created_at: string;
    edited_at: string | null;
    deleted_at: string | null;
  };
}

/** Updates last_read_at for the user on a thread. */
export async function markThreadRead(
  client: Client,
  threadId: string,
  userId: string,
) {
  const { error } = await client
    .from("message_thread_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("thread_id", threadId)
    .eq("user_id", userId);

  if (error) throw error;
}

/** Used by the Inngest push function: returns member user_ids + last_read_at for a thread. */
export async function getThreadMembersForPush(threadId: string) {
  const { data, error } = await supabaseAdmin
    .from("message_thread_members")
    .select("user_id, last_read_at")
    .eq("thread_id", threadId);

  if (error) throw error;
  return (data ?? []) as { user_id: string; last_read_at: string | null }[];
}
