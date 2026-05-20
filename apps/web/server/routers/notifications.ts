import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/index";
import { supabaseAdmin } from "../supabaseAdmin.server";
import { taskNotificationPrefsPayload } from "@carelog/schemas";

export const notificationsRouter = router({
  registerToken: protectedProcedure
    .input(
      z.object({
        token: z.string().min(1),
        platform: z.enum(["ios", "android"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { token, platform } = input;

      const { error } = await supabaseAdmin
        .from("push_tokens")
        .upsert(
          { auth_user_id: ctx.user.id, token, platform },
          { onConflict: "token" },
        );

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save push token",
        });
      }

      return { success: true as const };
    }),

  // ON-81: in-app task-notification feed. ctx.supabase is RLS-scoped — the
  // owner-only policy on in_app_notifications guarantees a caller sees only
  // their own rows (FIND-004); no manual user_id filter needed for safety.
  listInApp: protectedProcedure
    .input(z.object({ unreadOnly: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      let q = ctx.supabase
        .from("in_app_notifications")
        .select(
          "id, type, task_id, recipient_id, title, body, read_at, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (input?.unreadOnly) q = q.is("read_at", null);
      const { data, error } = await q;
      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load notifications",
        });
      }
      return data ?? [];
    }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // RLS owner-only UPDATE: a non-owner update affects 0 rows.
      const { data, error } = await ctx.supabase
        .from("in_app_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", input.id)
        .select("id");
      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to mark read",
        });
      }
      if (!data || data.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Not found" });
      }
      return { success: true as const };
    }),

  // Task notification preferences — owner-only via the notification_preferences
  // RLS (user_id = auth.uid(), FIND-003). No client-supplied user_id.
  taskPrefs: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from("notification_preferences")
      .select("task_assigned, task_completed, task_created")
      .eq("user_id", ctx.user.id)
      .maybeSingle();
    if (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to load preferences",
      });
    }
    // No row = the DB column defaults.
    return (
      data ?? { task_assigned: true, task_completed: true, task_created: false }
    );
  }),

  setTaskPrefs: protectedProcedure
    .input(taskNotificationPrefsPayload)
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from("notification_preferences")
        .upsert({ user_id: ctx.user.id, ...input }, { onConflict: "user_id" });
      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to save preferences",
        });
      }
      return { success: true as const };
    }),
});
