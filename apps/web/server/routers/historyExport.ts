import { z } from "zod";
import { router, protectedProcedure } from "../trpc/index";
import { TRPCError } from "@trpc/server";
import { supabaseAdmin } from "../supabaseAdmin.server";
import {
  buildHistoryExport,
  buildExportCounts,
} from "@/lib/buildHistoryExport";

const exportInput = z.object({
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

export const historyExportRouter = router({
  /**
   * preview — returns row counts so the UI can show
   * "This will export 312 journal entries, 18 medications…"
   */
  preview: protectedProcedure
    .input(exportInput)
    .query(async ({ ctx, input }) => {
      await assertCoordinator(input.org_id, ctx.user.id);

      const snapshot = await buildHistoryExport({
        orgId: input.org_id,
        recipientId: input.recipient_id,
        supabaseAdmin,
      }).catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Failed to build export";
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      });

      return buildExportCounts(snapshot);
    }),

  /**
   * generate — returns the full JSON snapshot.
   * PDF generation is handled by a separate API route.
   */
  generate: protectedProcedure
    .input(exportInput)
    .mutation(async ({ ctx, input }) => {
      await assertCoordinator(input.org_id, ctx.user.id);

      const snapshot = await buildHistoryExport({
        orgId: input.org_id,
        recipientId: input.recipient_id,
        supabaseAdmin,
      }).catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Failed to build export";
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      });

      return { snapshot };
    }),
});
