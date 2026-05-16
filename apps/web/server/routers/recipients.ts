import { z } from "zod";
import { router, protectedProcedure } from "../trpc/index";
import { TRPCError } from "@trpc/server";
import { supabaseAdmin, wrapAdminError } from "../supabaseAdmin.server";

// Write-side schema. Intentionally stricter than the read-side
// PreferencesSchema in recipientsRepository.ts:4-7 (which is permissive
// with defaults to tolerate legacy jsonb blobs). Don't consolidate —
// permissive read + strict write is the correct asymmetry for jsonb.
// TODO(ux-104b-followup): dedup likes/dislikes case-insensitively if
// duplicate-entry friction surfaces.
const updatePreferencesInput = z.object({
  org_id: z.string().uuid(),
  recipient_id: z.string().uuid(),
  likes: z.array(z.string().trim().min(1).max(120)).max(50),
  dislikes: z.array(z.string().trim().min(1).max(120)).max(50),
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

export const recipientsRouter = router({
  updatePreferences: protectedProcedure
    .input(updatePreferencesInput)
    .mutation(async ({ ctx, input }) => {
      await assertCoordinator(input.org_id, ctx.user.id);
      const { data: recipient, error: recipientError } = await supabaseAdmin
        .from("care_recipients")
        .select("id")
        .eq("id", input.recipient_id)
        .eq("org_id", input.org_id)
        .single();
      if (recipientError || !recipient) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { error } = await supabaseAdmin
        .from("care_recipients")
        .update({
          preferences: { likes: input.likes, dislikes: input.dislikes },
        })
        .eq("id", input.recipient_id)
        .eq("org_id", input.org_id);
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: wrapAdminError(error).message,
          cause: error,
        });
      return { ok: true, likes: input.likes, dislikes: input.dislikes };
    }),
});
