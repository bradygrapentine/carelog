import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/index";
import { careEventCommentsRouter } from "./careEventComments";
import {
  getTimeline,
  insertEvent,
  getFlaggedEvents,
  insertEventIdempotent,
} from "../repositories/careEventsRepository";
import { autoTagCareEvent } from "../repositories/medicationTaggingRepository";
import { supabaseAdmin, wrapAdminError } from "../supabaseAdmin.server";
import type { EventType, EntryKind } from "@carelog/types";
import { getPostHogClient } from "@/lib/posthog-server";

const eventTypeEnum = z.enum([
  "journal",
  "medication",
  "shift",
  "appointment",
  "symptom",
  "task",
  "expense",
  "handoff",
]);

export const careEventsRouter = router({
  timeline: protectedProcedure
    .input(
      z.object({
        recipientId: z.string().uuid(),
        eventType: eventTypeEnum.optional(),
        limit: z.number().min(1).max(100).default(50),
        before: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return getTimeline(ctx.supabase, {
        recipientId: input.recipientId,
        eventType: input.eventType as EventType,
        limit: input.limit,
        before: input.before,
      });
    }),

  insert: protectedProcedure
    .input(
      z.object({
        orgId: z.string().uuid(),
        recipientId: z.string().uuid(),
        eventType: eventTypeEnum,
        entryKind: z.enum(["human", "system"]).default("system"),
        payload: z.record(z.unknown()),
        occurredAt: z.string().optional(),
        flagged: z.boolean().default(false),
        idempotencyKey: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { data: recipient } = await supabaseAdmin
        .from("care_recipients")
        .select("id")
        .eq("id", input.recipientId)
        .eq("org_id", input.orgId)
        .single();

      if (!recipient) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Recipient does not belong to the specified org",
        });
      }

      // Check org event count before insert to detect the first care event
      const { count: priorCount } = await supabaseAdmin
        .from("care_events")
        .select("id", { count: "exact", head: true })
        .eq("org_id", input.orgId);

      if (input.idempotencyKey) {
        const event = await insertEventIdempotent(ctx.supabase, {
          orgId: input.orgId,
          recipientId: input.recipientId,
          actorId: ctx.user.id,
          eventType: input.eventType as EventType,
          entryKind: input.entryKind as EntryKind,
          payload: input.payload,
          occurredAt: input.occurredAt,
          flagged: input.flagged,
          idempotencyKey: input.idempotencyKey,
        });
        if (event) {
          void autoTagCareEvent(event.id, input.orgId, input.recipientId);
          if ((priorCount ?? 1) === 0) {
            const posthog = getPostHogClient();
            posthog.capture({
              distinctId: ctx.user.id,
              event: "first_care_event_created",
              properties: { org_id: input.orgId, event_type: input.eventType },
            });
            posthog.capture({
              distinctId: ctx.user.id,
              event: "onboarding_step_completed",
              properties: { step: "first_care_event", org_id: input.orgId },
            });
          }
        }
        return event;
      }

      const event = await insertEvent(ctx.supabase, {
        orgId: input.orgId,
        recipientId: input.recipientId,
        actorId: ctx.user.id,
        eventType: input.eventType as EventType,
        entryKind: input.entryKind as EntryKind,
        payload: input.payload,
        occurredAt: input.occurredAt,
        flagged: input.flagged,
      });
      void autoTagCareEvent(event.id, input.orgId, input.recipientId);
      if ((priorCount ?? 1) === 0) {
        const posthog = getPostHogClient();
        posthog.capture({
          distinctId: ctx.user.id,
          event: "first_care_event_created",
          properties: { org_id: input.orgId, event_type: input.eventType },
        });
        posthog.capture({
          distinctId: ctx.user.id,
          event: "onboarding_step_completed",
          properties: { step: "first_care_event", org_id: input.orgId },
        });
      }
      return event;
    }),

  flagged: protectedProcedure
    .input(z.object({ recipientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return getFlaggedEvents(ctx.supabase, input.recipientId);
    }),

  getOne: protectedProcedure
    .input(z.object({ eventId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from("care_events")
        .select("*")
        .eq("id", input.eventId)
        .single();
      if (error || !data) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      }
      return data;
    }),

  react: protectedProcedure
    .input(
      z.object({
        eventId: z.string().uuid(),
        reaction: z.enum(["heart", "thinking_of_you", "strong", "grateful"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase.from("journal_reactions").upsert(
        {
          event_id: input.eventId,
          user_id: ctx.user.id,
          reaction: input.reaction,
        },
        { onConflict: "event_id,user_id" },
      );
      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: wrapAdminError(error).message,
          cause: error,
        });
      }
    }),

  unreact: protectedProcedure
    .input(z.object({ eventId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from("journal_reactions")
        .delete()
        .eq("event_id", input.eventId)
        .eq("user_id", ctx.user.id);
      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: wrapAdminError(error).message,
          cause: error,
        });
      }
    }),

  reactions: protectedProcedure
    .input(z.object({ eventId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from("journal_reactions")
        .select("reaction, user_id")
        .eq("event_id", input.eventId);
      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: wrapAdminError(error).message,
          cause: error,
        });
      }
      const counts: Record<string, number> = {};
      let myReaction: string | null = null;
      for (const row of data ?? []) {
        counts[row.reaction] = (counts[row.reaction] ?? 0) + 1;
        if (row.user_id === ctx.user.id) {
          myReaction = row.reaction;
        }
      }
      return { counts, myReaction };
    }),

  flag: protectedProcedure
    .input(z.object({ eventId: z.string().uuid(), flagged: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      // Verify the event exists and get its org
      const { data: event } = await ctx.supabase
        .from("care_events")
        .select("id, org_id")
        .eq("id", input.eventId)
        .single();
      if (!event) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Event not found" });
      }

      // Only coordinators may flag
      const { data: membership } = await supabaseAdmin
        .from("memberships")
        .select("role")
        .eq("user_id", ctx.user.id)
        .eq("org_id", event.org_id)
        .single();
      if (!membership || membership.role !== "coordinator") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only coordinators can flag events",
        });
      }

      const { error } = await ctx.supabase
        .from("care_events")
        .update({ flagged: input.flagged })
        .eq("id", input.eventId);
      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: wrapAdminError(error).message,
          cause: error,
        });
      }
    }),

  comments: careEventCommentsRouter,
});
