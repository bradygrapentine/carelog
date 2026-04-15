// apps/web/server/repositories/careEventCommentsRepository.ts
// NOTE: care_event_comments table is new in migration 20260422. Until supabase-types is
// regenerated, we cast .from() calls for this table with `as any` to bypass TypeScript's
// strict table-name check on the generated Database type.
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../supabaseAdmin.server";
import type { CareEventComment } from "@carelog/schemas";

/** List non-deleted comments for an event, oldest first, with author display name. */
export async function listComments(
  supabase: SupabaseClient,
  careEventId: string,
): Promise<CareEventComment[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("care_event_comments")
    .select(
      "id, author_id, body, edited_at, created_at, profiles!care_event_comments_author_id_fkey(display_name)",
    )
    .eq("care_event_id", careEventId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) throw error;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => ({
    id: row.id,
    authorId: row.author_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    authorName: (row.profiles as any)?.display_name ?? "Unknown",
    body: row.body,
    editedAt: row.edited_at ?? null,
    createdAt: row.created_at,
  }));
}

/** Insert a comment. RLS enforces author = auth.uid(). */
export async function insertComment(
  supabase: SupabaseClient,
  input: {
    careEventId: string;
    orgId: string;
    authorId: string;
    body: string;
  },
): Promise<{ id: string; createdAt: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("care_event_comments")
    .insert({
      care_event_id: input.careEventId,
      org_id: input.orgId,
      author_id: input.authorId,
      body: input.body,
    })
    .select("id, created_at")
    .single();

  if (error) throw error;
  return { id: data.id, createdAt: data.created_at };
}

/** Edit a comment's body; RLS enforces author-only. */
export async function editComment(
  supabase: SupabaseClient,
  commentId: string,
  body: string,
): Promise<{ editedAt: string }> {
  const editedAt = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("care_event_comments")
    .update({ body, edited_at: editedAt })
    .eq("id", commentId)
    .select("edited_at")
    .single();

  if (error) throw error;
  return { editedAt: data.edited_at };
}

/** Soft-delete a comment; RLS enforces author-only. */
export async function softDeleteComment(
  supabase: SupabaseClient,
  commentId: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("care_event_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId);
  if (error) throw error;
}

/**
 * Service-role: look up event org + actor, and distinct prior commenters.
 * care_events uses `actor_id` for the person who logged the event.
 */
export async function getFanoutTargets(
  careEventId: string,
  excludeUserId: string,
): Promise<{
  orgId: string;
  eventAuthorId: string;
  priorCommenterIds: string[];
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: event, error: eventErr } = await (supabaseAdmin as any)
    .from("care_events")
    .select("org_id, actor_id")
    .eq("id", careEventId)
    .single();
  if (eventErr) throw eventErr;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prior, error: priorErr } = await (supabaseAdmin as any)
    .from("care_event_comments")
    .select("author_id")
    .eq("care_event_id", careEventId)
    .neq("author_id", excludeUserId);
  if (priorErr) throw priorErr;

  const priorCommenterIds = Array.from(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new Set((prior ?? []).map((r: any) => r.author_id as string)),
  );
  return {
    orgId: event.org_id,
    eventAuthorId: event.actor_id,
    priorCommenterIds,
  };
}

/** Service-role: fetch the event's org_id for use in insert. */
export async function getEventOrgId(careEventId: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from("care_events")
    .select("org_id")
    .eq("id", careEventId)
    .single();
  if (error) throw error;
  return data.org_id as string;
}
