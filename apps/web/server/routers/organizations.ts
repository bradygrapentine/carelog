import { z } from "zod";
import { router, protectedProcedure } from "../trpc/index";
import {
  getOrganization,
  createOrganization,
  getUserOrganizations,
} from "../repositories/organizationsRepository";
import { createIdentity } from "../repositories/identityRepository";
import { supabaseAdmin } from "../supabaseAdmin.server";

export const organizationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getUserOrganizations(ctx.supabase, ctx.user.id);
  }),

  get: protectedProcedure
    .input(z.object({ orgId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return getOrganization(ctx.supabase, input.orgId);
    }),

  create: protectedProcedure
    .input(
      z.object({
        orgName: z.string().min(1).max(100),
        orgType: z
          .enum(["family", "agency", "institution", "employer"])
          .default("family"),
        recipientName: z.string().min(1),
        recipientDob: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const org = await createOrganization({
        name: input.orgName,
        orgType: input.orgType,
      });

      const identityToken = await createIdentity({
        orgId: org.id,
        fullName: input.recipientName,
        dob: input.recipientDob,
      });

      const { data: recipient, error: rError } = await supabaseAdmin
        .from("care_recipients")
        .insert({
          org_id: org.id,
          identity_token: identityToken,
        })
        .select("id")
        .single();

      if (rError || !recipient) {
        throw new Error(`Recipient creation failed: ${rError?.message}`);
      }

      const { error: mError } = await supabaseAdmin.from("memberships").insert({
        org_id: org.id,
        user_id: ctx.user.id,
        recipient_id: null,
        role: "coordinator",
        accepted_at: new Date().toISOString(),
      });

      if (mError) {
        throw new Error(`Membership creation failed: ${mError.message}`);
      }

      return { org, recipientId: recipient.id };
    }),
});
