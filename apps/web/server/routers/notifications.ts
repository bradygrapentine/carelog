import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/index";
import { supabaseAdmin } from "../supabaseAdmin.server";

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
});
