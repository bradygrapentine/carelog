import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/index";
import {
  getTimeline,
  insertEvent,
  getFlaggedEvents,
  insertEventIdempotent,
} from "../repositories/careEventsRepository";
import { supabaseAdmin } from "../supabaseAdmin.server";

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
        eventType: input.eventType as any,
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
        .from('care_recipients')
        .select('id')
        .eq('id', input.recipientId)
        .eq('org_id', input.orgId)
        .single();

      if (!recipient) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Recipient does not belong to the specified org' });
      }

      if (input.idempotencyKey) {
        return insertEventIdempotent(ctx.supabase, {
          orgId: input.orgId,
          recipientId: input.recipientId,
          actorId: ctx.user.id,
          eventType: input.eventType as any,
          entryKind: input.entryKind as any,
          payload: input.payload,
          occurredAt: input.occurredAt,
          flagged: input.flagged,
          idempotencyKey: input.idempotencyKey,
        });
      }

      return insertEvent(ctx.supabase, {
        orgId: input.orgId,
        recipientId: input.recipientId,
        actorId: ctx.user.id,
        eventType: input.eventType as any,
        entryKind: input.entryKind as any,
        payload: input.payload,
        occurredAt: input.occurredAt,
        flagged: input.flagged,
      });
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
        .from('care_events')
        .select('*')
        .eq('id', input.eventId)
        .single();
      if (error || !data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' });
      }
      return data;
    }),
});
