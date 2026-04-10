import { z } from "zod";
import { router, protectedProcedure } from "../trpc/index";
import { TRPCError } from "@trpc/server";
import { supabaseAdmin } from "../supabaseAdmin.server";
import { eolPlanUpsertInput } from "@carelog/schemas";

const getInput = z.object({
  org_id: z.string().uuid(),
  recipient_id: z.string().uuid(),
});

async function assertCoordinator(orgId: string, userId: string) {
  const { data: membership } = await supabaseAdmin
    .from("memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .not("accepted_at", "is", null)
    .single();
  if (!membership || membership.role !== "coordinator") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

export const eolPlanRouter = router({
  get: protectedProcedure.input(getInput).query(async ({ ctx, input }) => {
    await assertCoordinator(input.org_id, ctx.user.id);
    const { data, error } = await supabaseAdmin
      .from("eol_plans")
      .select("*")
      .eq("org_id", input.org_id)
      .eq("recipient_id", input.recipient_id)
      .single();
    if (error && error.code !== "PGRST116") {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message,
      });
    }
    return data ?? null;
  }),

  upsert: protectedProcedure
    .input(eolPlanUpsertInput)
    .mutation(async ({ ctx, input }) => {
      await assertCoordinator(input.org_id, ctx.user.id);
      const { error } = await supabaseAdmin.from("eol_plans").upsert(
        {
          ...input,
          created_by: ctx.user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "recipient_id" },
      );
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      return { ok: true };
    }),
});
