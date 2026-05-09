/**
 * UX-102b — Shift open-questions tRPC router.
 *
 * Caregivers raise questions during/after a shift; any team member can resolve
 * them. Backed by the `shift_questions` table (UX-102a). RLS allows team-wide
 * SELECT and accepted-org-member INSERT/UPDATE; the migration's BEFORE UPDATE
 * trigger pins org_id / recipient_id / raised_by / raised_at / body as
 * immutable so this router only allows resolving (or unresolving via a future
 * follow-up).
 *
 * PHI: `body` is free-form caregiver text. Never log it to analytics. The
 * mutations here use shift_questions.id for posthog events only.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/index";

export const shiftQuestionsRouter = router({
  /**
   * List questions for a recipient. Pass `openOnly: true` to filter to
   * unresolved questions (uses the partial index on raised_at DESC for
   * O(log n) lookups).
   */
  list: protectedProcedure
    .input(
      z.object({
        recipientId: z.string().uuid(),
        openOnly: z.boolean().optional().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      let q = ctx.supabase
        .from("shift_questions")
        .select(
          "id, org_id, recipient_id, body, raised_by, raised_at, resolved_at, resolved_by",
        )
        .eq("recipient_id", input.recipientId)
        .order("raised_at", { ascending: false });

      if (input.openOnly) {
        q = q.is("resolved_at", null);
      }

      const { data, error } = await q;

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

      return data ?? [];
    }),

  /**
   * Create a new question. RLS WITH CHECK enforces:
   *   - caller is an accepted member of the org
   *   - raised_by = auth.uid() (no spoofing)
   *   - recipient_id belongs to org_id (no cross-org leak)
   */
  create: protectedProcedure
    .input(
      z.object({
        orgId: z.string().uuid(),
        recipientId: z.string().uuid(),
        body: z.string().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from("shift_questions")
        .insert({
          org_id: input.orgId,
          recipient_id: input.recipientId,
          body: input.body,
          raised_by: ctx.user.id,
        })
        .select(
          "id, org_id, recipient_id, body, raised_by, raised_at, resolved_at, resolved_by",
        )
        .single();

      if (error) {
        throw new TRPCError({
          code: error.code === "42501" ? "FORBIDDEN" : "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

      return data;
    }),

  /**
   * Resolve a question. Sets resolved_at + resolved_by atomically (the
   * column-level CHECK enforces both-or-neither). RLS allows any accepted
   * org member to resolve; the immutability trigger ensures only the
   * resolve-state columns can be mutated.
   */
  resolve: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from("shift_questions")
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: ctx.user.id,
        })
        .eq("id", input.id)
        .is("resolved_at", null)
        .select(
          "id, org_id, recipient_id, body, raised_by, raised_at, resolved_at, resolved_by",
        )
        .maybeSingle();

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

      // null → row not visible to caller (RLS) or already resolved.
      if (!data) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return data;
    }),
});
