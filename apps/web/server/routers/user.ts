import { z } from "zod";
import { router, protectedProcedure } from "../trpc/index";

const IANA_TIMEZONE_PATTERN =
  /^[A-Za-z_]+(?:\/[A-Za-z_]+){1,2}$|^UTC$|^GMT$/;

export const userRouter = router({
  /** Get the current user's profile metadata stored in auth.users user_metadata */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase.auth.getUser();
    if (error || !data.user) return null;

    const meta = data.user.user_metadata ?? {};
    return {
      email: data.user.email ?? "",
      displayName: (meta.display_name as string | undefined) ?? "",
      timezone: (meta.timezone as string | undefined) ?? "",
      language: (meta.language as string | undefined) ?? "en",
      emailDigest: (meta.email_digest as boolean | undefined) ?? true,
      emailMentions: (meta.email_mentions as boolean | undefined) ?? true,
      emailShiftReminders:
        (meta.email_shift_reminders as boolean | undefined) ?? true,
    };
  }),

  /** Update display name / timezone / language */
  updateProfile: protectedProcedure
    .input(
      z.object({
        displayName: z.string().max(80).optional(),
        timezone: z
          .string()
          .regex(IANA_TIMEZONE_PATTERN)
          .max(64)
          .optional()
          .or(z.literal("")),
        language: z.enum(["en"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updates: Record<string, string> = {};
      if (input.displayName !== undefined)
        updates.display_name = input.displayName;
      if (input.timezone !== undefined) updates.timezone = input.timezone;
      if (input.language !== undefined) updates.language = input.language;

      const { error } = await ctx.supabase.auth.updateUser({
        data: updates,
      });
      if (error) throw new Error(error.message);
      return { ok: true };
    }),

  /** Dismiss the education tip widget for 7 days */
  dismissEducationTip: protectedProcedure.mutation(async ({ ctx }) => {
    const dismissUntil = new Date();
    dismissUntil.setDate(dismissUntil.getDate() + 7);

    const { error } = await ctx.supabase
      .from("user_profiles")
      .update({ education_tip_dismissed_until: dismissUntil.toISOString() })
      .eq("user_id", ctx.user.id);

    if (error) throw new Error(error.message);
    return { ok: true };
  }),

  /** Update notification preferences stored in user_metadata and notification_preferences table */
  updateNotifications: protectedProcedure
    .input(
      z.object({
        emailDigest: z.boolean().optional(),
        emailMentions: z.boolean().optional(),
        emailShiftReminders: z.boolean().optional(),
        webPushEnabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const metaUpdates: Record<string, boolean> = {};
      if (input.emailDigest !== undefined)
        metaUpdates.email_digest = input.emailDigest;
      if (input.emailMentions !== undefined)
        metaUpdates.email_mentions = input.emailMentions;
      if (input.emailShiftReminders !== undefined)
        metaUpdates.email_shift_reminders = input.emailShiftReminders;

      if (Object.keys(metaUpdates).length > 0) {
        const { error } = await ctx.supabase.auth.updateUser({
          data: metaUpdates,
        });
        if (error) throw new Error(error.message);
      }

      if (input.webPushEnabled !== undefined) {
        const { error } = await ctx.supabase
          .from("notification_preferences")
          .upsert(
            { user_id: ctx.user.id, web_push_enabled: input.webPushEnabled },
            { onConflict: "user_id" },
          );
        if (error) throw new Error(error.message);
      }

      return { ok: true };
    }),
});
