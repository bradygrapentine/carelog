import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { router, protectedProcedure } from "../trpc/index";
import { TRPCError } from "@trpc/server";
import { supabaseAdmin, wrapAdminError } from "../supabaseAdmin.server";
import { updateEmergencyInfo } from "../repositories/identityRepository";

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

  // UX-105b: edit affordance for EmergencyFooterCard. Coordinator-only write
  // to identity_vault.contact_info. PHI rule: NO input/patch spreads into any
  // Sentry call site here (or in identityRepository) per ADR-0001 + the
  // pre-dispatch hardened acceptance in docs/plans/2026-05-17-ux-103b-105b-*.
  updateEmergencyInfo: protectedProcedure
    .input(
      z.object({
        org_id: z.string().uuid(),
        recipient_id: z.string().uuid(),
        // Empty string clears the field. Non-empty sets.
        dnr_status: z.string().trim().max(120),
        hospital: z.string().trim().max(120),
        // primary_contact.name="" clears the whole primary_contact object.
        primary_contact: z.object({
          name: z.string().trim().max(120),
          relationship: z.string().trim().max(60),
          // Permissive client/server validation per plan §Phone format.
          phone: z
            .string()
            .trim()
            .max(40)
            .regex(/^\+?[\d\s\-()]{7,20}$|^$/, "Invalid phone format"),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCoordinator(input.org_id, ctx.user.id);

      const primaryContact = input.primary_contact.name
        ? input.primary_contact
        : null;

      try {
        const result = await updateEmergencyInfo(
          input.org_id,
          input.recipient_id,
          {
            dnrStatus: input.dnr_status || null,
            hospital: input.hospital || null,
            primaryContact,
          },
        );
        return { ok: true, emergency: result };
      } catch (err) {
        // PHI guardrail: do NOT spread `input` or `patch` into the Sentry call.
        // Only the generic `component` + `path` tags + the bare error reach
        // Sentry; name/phone never leave the server.
        Sentry.captureException(err, {
          tags: {
            component: "recipients.updateEmergencyInfo",
            path: "repo.error",
          },
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update emergency info",
          cause: err instanceof Error ? err : new Error(String(err)),
        });
      }
    }),
});
