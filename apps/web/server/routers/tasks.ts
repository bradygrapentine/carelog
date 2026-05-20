import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/index";
import { supabaseAdmin } from "../supabaseAdmin.server";
import { createTaskPayload, updateTaskPayload } from "@carelog/schemas";

// ON-79: Task CRUD tRPC router.
//
// AUTHZ IS DELEGATED TO ON-77's RLS + tasks_update_guard trigger. Every CRUD
// call uses ctx.supabase (RLS-scoped, carries the caller's JWT) — NOT
// supabaseAdmin — so auth.uid() resolves to the real user inside the policies
// and the trigger. supabaseAdmin would set auth.uid()=NULL, which BREAKS the
// trigger's completion gate + completed_by stamping (see plan + ADR-0007).
// There is intentionally no TS re-implementation of the permission predicates;
// the single source of truth stays in SQL. The only supabaseAdmin use is the
// cross-user assignee-membership read in `assign`.

// Trigger RAISE constants (PHI-free). An RLS WITH CHECK violation surfaces as
// SQLSTATE 42501, handled by code in isForbidden — no message-substring needed.
const FORBIDDEN_MARKERS = [
  "tasks_complete_forbidden",
  "tasks_edit_forbidden",
  "tasks_cancel_forbidden",
  "tasks_revive_forbidden",
  "tasks_decomplete_forbidden",
  "tasks_immutable_column",
];

type PgError = { code?: string; message?: string } | null;

function isForbidden(error: PgError): boolean {
  if (!error) return false;
  if (error.code === "42501") return true; // RLS WITH CHECK / insufficient_privilege
  const msg = error.message ?? "";
  return FORBIDDEN_MARKERS.some((m) => msg.includes(m));
}

// Map a write result to a thrown error. A pure RLS USING denial returns NO
// error but ZERO rows (the row is invisible to the caller) — that must be
// FORBIDDEN, not silent success. Never surface a raw Postgres message.
function assertWriteAllowed(error: PgError, rows: unknown[] | null): void {
  if (isForbidden(error)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not allowed" });
  }
  if (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Task write failed",
    });
  }
  if (!rows || rows.length === 0) {
    // RLS USING-denial path: row not visible to the caller.
    throw new TRPCError({ code: "FORBIDDEN", message: "Not allowed" });
  }
}

const taskIdInput = z.object({ id: z.string().uuid() });

export const tasksRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        recipient_id: z.string().uuid(),
        shift_id: z.string().uuid().optional(),
        assigned_to: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // ctx.supabase is RLS-scoped — a caller outside the recipient's org sees zero rows.
      let q = ctx.supabase
        .from("tasks")
        .select("*")
        .eq("recipient_id", input.recipient_id)
        .order("created_at", { ascending: false });
      if (input.shift_id) q = q.eq("shift_id", input.shift_id);
      if (input.assigned_to) q = q.eq("assigned_to", input.assigned_to);

      const { data, error } = await q;
      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Task list failed",
        });
      }
      return data ?? [];
    }),

  create: protectedProcedure
    .input(createTaskPayload)
    .mutation(async ({ ctx, input }) => {
      // org_id must match the recipient's org (the INSERT policy checks
      // user_can_create_task(org_id) + user_can_access_recipient(recipient_id)).
      // Resolve it RLS-scoped — caller must be able to see the recipient.
      const { data: recip, error: recipErr } = await ctx.supabase
        .from("care_recipients")
        .select("org_id")
        .eq("id", input.recipient_id)
        .maybeSingle();
      if (recipErr || !recip) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not allowed" });
      }

      // RLS tasks_insertable_by_creator enforces create-permission + recipient access.
      const { data, error } = await ctx.supabase
        .from("tasks")
        .insert({
          recipient_id: input.recipient_id,
          title: input.title,
          instructions: input.instructions ?? null,
          checklist: input.checklist ?? [],
          assigned_to: input.assigned_to ?? null,
          shift_id: input.shift_id ?? null,
          due_at: input.due_at ?? null,
          org_id: recip.org_id,
          created_by: ctx.user.id,
          requested_by: ctx.user.id,
          status: "todo",
        })
        .select()
        .single();
      if (isForbidden(error)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not allowed" });
      }
      if (error || !data) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Task create failed",
        });
      }
      return data;
    }),

  update: protectedProcedure
    .input(updateTaskPayload)
    .mutation(async ({ ctx, input }) => {
      // Content edits only. completed_by/at are owned by the trigger — never sent.
      const patch: Record<string, unknown> = {};
      if (input.title !== undefined) patch.title = input.title;
      if (input.instructions !== undefined)
        patch.instructions = input.instructions;
      if (input.checklist !== undefined) patch.checklist = input.checklist;
      if (input.assigned_to !== undefined)
        patch.assigned_to = input.assigned_to;
      if (input.shift_id !== undefined) patch.shift_id = input.shift_id;
      if (input.due_at !== undefined) patch.due_at = input.due_at;
      if (input.status !== undefined) patch.status = input.status;

      const { data, error } = await ctx.supabase
        .from("tasks")
        .update(patch)
        .eq("id", input.id)
        .select();
      assertWriteAllowed(error, data);
      return data![0];
    }),

  complete: protectedProcedure
    .input(taskIdInput)
    .mutation(async ({ ctx, input }) => {
      // Trigger gates completion + server-stamps completed_by = auth.uid().
      const { data, error } = await ctx.supabase
        .from("tasks")
        .update({ status: "done" })
        .eq("id", input.id)
        .select();
      assertWriteAllowed(error, data);
      return data![0];
    }),

  cancel: protectedProcedure
    .input(taskIdInput)
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from("tasks")
        .update({ status: "cancelled" })
        .eq("id", input.id)
        .select();
      assertWriteAllowed(error, data);
      return data![0];
    }),

  assign: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        assignee_user_id: z.string().uuid().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Read the task RLS-scoped first to get its org/recipient — never trust a
      // client-supplied org. (If the caller can't see the task, 0 rows → FORBIDDEN.)
      const { data: task, error: readErr } = await ctx.supabase
        .from("tasks")
        .select("org_id, recipient_id")
        .eq("id", input.id)
        .maybeSingle();
      if (readErr) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Task read failed",
        });
      }
      if (!task) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not allowed" });
      }

      if (input.assignee_user_id) {
        // Cross-user membership lookup needs the admin client; validate the
        // assignee can access THIS task's recipient (org from the server-read row).
        const { data: m, error: mErr } = await supabaseAdmin
          .from("memberships")
          .select("user_id, recipient_id")
          .eq("org_id", task.org_id)
          .eq("user_id", input.assignee_user_id)
          .not("accepted_at", "is", null);
        if (mErr) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Assignee check failed",
          });
        }
        const ok = (m ?? []).some(
          (row) =>
            row.recipient_id === null || row.recipient_id === task.recipient_id,
        );
        if (!ok) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Assignee is not on this care team",
          });
        }
      }

      // The trigger's content-edit gate governs WHO may assign.
      const { data, error } = await ctx.supabase
        .from("tasks")
        .update({ assigned_to: input.assignee_user_id })
        .eq("id", input.id)
        .select();
      assertWriteAllowed(error, data);
      return data![0];
    }),
});
