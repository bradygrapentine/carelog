// apps/web/server/repositories/careEventCommentsRepository.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../supabaseAdmin.server";
import type { CareEventComment } from "@carelog/schemas";
import type { Database } from "../../lib/database.types";

type CareEventCommentRow =
  Database["public"]["Tables"]["care_event_comments"]["Row"];
type CareEventCommentInsert =
  Database["public"]["Tables"]["care_event_comments"]["Insert"];

/** List non-deleted comments for an event, oldest first, with author display name. */
export async function listComments(
  supabase: SupabaseClient,
  careEventId: string,
): Promise<CareEventComment[]> {
  const { data, error } = await supabase
    .from("care_event_comments")
    .select(
      "id, author_id, body, edited_at, created_at, profiles!care_event_comments_author_id_fkey(display_name)",
    )
    .eq("care_event_id", careEventId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map(
    (
      row: CareEventCommentRow & { profiles: { display_name: string } | null },
    ) => ({
      id: row.id,
      authorId: row.author_id,
      authorName: row.profiles?.display_name ?? "Unknown",
      body: row.body,
      editedAt: row.edited_at ?? null,
      createdAt: row.created_at,
    }),
  );
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
  const { data, error } = await supabase
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
  const { data, error } = await supabase
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
  const { error } = await supabase
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
  const { data: event, error: eventErr } = await supabaseAdmin
    .from("care_events")
    .select("org_id, actor_id")
    .eq("id", careEventId)
    .single();
  if (eventErr) throw eventErr;

  const { data: prior, error: priorErr } = await supabaseAdmin
    .from("care_event_comments")
    .select("author_id")
    .eq("care_event_id", careEventId)
    .neq("author_id", excludeUserId);
  if (priorErr) throw priorErr;

  const priorCommenterIds = Array.from(
    new Set(
      (prior ?? []).map(
        (r: Pick<CareEventCommentRow, "author_id">) => r.author_id as string,
      ),
    ),
  );
  return {
    orgId: event.org_id,
    eventAuthorId: event.actor_id,
    priorCommenterIds,
  };
}

/** Service-role: fetch the event's org_id for use in insert. */
export async function getEventOrgId(careEventId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("care_events")
    .select("org_id")
    .eq("id", careEventId)
    .single();
  if (error) throw error;
  return data.org_id as string;
}
