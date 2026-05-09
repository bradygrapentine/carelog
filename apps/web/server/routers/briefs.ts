import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc/index";
import { supabaseAdmin } from "../supabaseAdmin.server";
import { detectPatterns, type Pattern } from "@/lib/detectPattern";

export const briefsRouter = router({
  /**
   * Returns the most-recent non-revoked care_brief for a given
   * (recipientId, orgId) pair — used by BriefHero on the dashboard.
   *
   * The user must be a team member for the recipient (enforced by the
   * RLS policy "briefs readable by team" — user_can_access_recipient).
   * We use ctx.supabase (anon key, RLS on) rather than supabaseAdmin so
   * PHI only flows to callers who are authorized coordinators/helpers.
   */
  latestForRecipient: protectedProcedure
    .input(
      z.object({
        recipientId: z.string().uuid(),
        orgId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from("care_briefs")
        .select("id, title, content, includes, created_at")
        .eq("recipient_id", input.recipientId)
        .eq("org_id", input.orgId)
        .eq("revoked", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

      // null → no brief exists yet (not an error — caller renders empty state)
      return data ?? null;
    }),

  /**
   * UX-095 finalize — bundled brief surface payload.
   *
   * Returns everything the dashboard's brief surface needs in one call:
   *   - careEvents (last 14 days; covers sleep 7-day + pattern 14-day)
   *   - scheduledMeds (today's medication schedule, joined with med name + dosage)
   *   - appointments (care_events with event_type='appointment', now → +7 days)
   *   - shifts (current week)
   *   - members (org members with display name + email)
   *   - latestMood (most recent care_event with event_type='mood')
   *
   * RLS via ctx.supabase scopes care_events / shifts / med tables to orgs the
   * caller belongs to. Members are read via supabaseAdmin against auth.users
   * metadata (membership row already gates "is the caller in this org").
   */
  dashboardSummary: protectedProcedure
    .input(
      z.object({
        recipientId: z.string().uuid(),
        orgId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { recipientId, orgId } = input;

      // Confirm the caller belongs to this org before any reads. RLS will also
      // filter, but an explicit gate gives a cleaner 403 vs an empty payload.
      const { data: membership } = await ctx.supabase
        .from("memberships")
        .select("role")
        .eq("org_id", orgId)
        .eq("user_id", ctx.user.id)
        .not("accepted_at", "is", null)
        .maybeSingle();

      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const now = new Date();
      const fourteenDaysAgo = new Date(
        now.getTime() - 14 * 24 * 60 * 60 * 1000,
      );
      const sevenDaysAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      // Week window for shifts: previous Sunday 00:00 → next Saturday 23:59.
      const weekStart = new Date(now);
      weekStart.setUTCHours(0, 0, 0, 0);
      weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

      // ── Parallel reads (RLS-scoped via ctx.supabase) ─────────────────────
      const [careEventsRes, schedulesRes, shiftsRes] = await Promise.all([
        ctx.supabase
          .from("care_events")
          .select("event_type, occurred_at, payload")
          .eq("org_id", orgId)
          .eq("recipient_id", recipientId)
          .gte("occurred_at", fourteenDaysAgo.toISOString())
          .order("occurred_at", { ascending: false })
          .limit(500),
        ctx.supabase
          .from("medication_schedules")
          .select(
            "id, time_of_day, days_of_week, medications:medication_id(drug_name, dosage)",
          )
          .eq("recipient_id", recipientId)
          .eq("active", true),
        ctx.supabase
          .from("shifts")
          .select("id, assignee_user_id, start_at, end_at")
          .eq("org_id", orgId)
          .eq("recipient_id", recipientId)
          .gte("start_at", weekStart.toISOString())
          .lt("start_at", weekEnd.toISOString())
          .order("start_at", { ascending: true }),
      ]);

      if (careEventsRes.error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: careEventsRes.error.message,
        });
      }
      if (schedulesRes.error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: schedulesRes.error.message,
        });
      }
      if (shiftsRes.error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: shiftsRes.error.message,
        });
      }

      const careEvents = careEventsRes.data ?? [];

      // Filter scheduled meds to today's day-of-week. medication_schedules
      // is RLS-scoped on recipient_id; today filter is application-layer.
      const todayDow = now.getUTCDay();
      const scheduledMeds = (schedulesRes.data ?? [])
        .filter((m) => m.days_of_week.includes(todayDow))
        .map((m) => ({
          id: m.id,
          scheduled_time: m.time_of_day,
          medications: m.medications,
        }));

      // Appointments: care_events with event_type='appointment' in the next
      // 7 days. Map payload → {title, detail}; occurred_at → starts_at.
      type AppointmentPayload = { title?: string; detail?: string | null };
      const appointments = careEvents
        .filter(
          (e) =>
            e.event_type === "appointment" &&
            new Date(e.occurred_at) >= now &&
            new Date(e.occurred_at) <= sevenDaysAhead,
        )
        .map((e) => {
          const payload = (e.payload as AppointmentPayload | null) ?? {};
          return {
            id:
              // appointment care_events are read above without `id` — backfill
              // a stable key from occurred_at if id absent (it isn't selected).
              `appt-${e.occurred_at}`,
            starts_at: e.occurred_at,
            title: payload.title ?? "Appointment",
            detail: payload.detail ?? null,
          };
        });

      // Map shifts → { id, user_id, starts_at, ends_at } expected by deriveOnShift.
      const shifts = (shiftsRes.data ?? [])
        .filter((s) => s.assignee_user_id !== null)
        .map((s) => ({
          id: s.id,
          user_id: s.assignee_user_id as string,
          starts_at: s.start_at,
          ends_at: s.end_at,
        }));

      // Latest mood — most recent care_event with event_type='mood'.
      type MoodPayload = { mood?: string; note?: string };
      const moodEvent = careEvents.find((e) => e.event_type === "mood");
      let latestMood: {
        label: "good" | "steady" | "difficult";
        occurredAt: string;
        by: string;
        note?: string;
      } | null = null;
      if (moodEvent) {
        const payload = (moodEvent.payload as MoodPayload | null) ?? {};
        const raw = payload.mood ?? "steady";
        const label: "good" | "steady" | "difficult" =
          raw === "good" || raw === "difficult" ? raw : "steady";
        latestMood = {
          label,
          occurredAt: moodEvent.occurred_at,
          by: "—",
          ...(payload.note ? { note: payload.note } : {}),
        };
      }

      // ── Members (org-scoped) ──────────────────────────────────────────────
      // Fetch via supabaseAdmin: memberships → user_ids → auth.users metadata.
      // Membership existence already gated above; this is read-only enrichment.
      const { data: orgMemberships } = await supabaseAdmin
        .from("memberships")
        .select("user_id")
        .eq("org_id", orgId)
        .not("accepted_at", "is", null);

      const memberUserIds = (orgMemberships ?? [])
        .map((m) => m.user_id)
        .filter((id): id is string => id !== null);

      const members: Array<{
        user_id: string;
        display_name: string | null;
        email: string | null;
      }> = [];
      for (const userId of memberUserIds) {
        const { data: userRes } =
          await supabaseAdmin.auth.admin.getUserById(userId);
        const meta = userRes?.user?.user_metadata as
          | { display_name?: string; full_name?: string }
          | undefined;
        members.push({
          user_id: userId,
          display_name: meta?.display_name ?? meta?.full_name ?? null,
          email: userRes?.user?.email ?? null,
        });
      }

      return {
        careEvents,
        scheduledMeds,
        appointments,
        shifts,
        members,
        latestMood,
      };
    }),

  /**
   * TD-110 — derived patterns surface for PatternsStrip.
   *
   * Reads the same 14-day care_events window dashboardSummary uses, runs
   * detectPatterns() (priority-ordered: med-misses > sleep dip > mood
   * cluster), and returns whichever fired. RLS via ctx.supabase. No
   * supabaseAdmin needed — this query is org-scoped read-only.
   */
  patterns: protectedProcedure
    .input(
      z.object({
        recipientId: z.string().uuid(),
        orgId: z.string().uuid(),
        limit: z.number().int().min(1).max(10).optional(),
      }),
    )
    .query(async ({ ctx, input }): Promise<Pattern[]> => {
      const { recipientId, orgId, limit } = input;

      const { data: membership } = await ctx.supabase
        .from("memberships")
        .select("role")
        .eq("org_id", orgId)
        .eq("user_id", ctx.user.id)
        .not("accepted_at", "is", null)
        .maybeSingle();

      if (!membership) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const now = new Date();
      const fourteenDaysAgo = new Date(
        now.getTime() - 14 * 24 * 60 * 60 * 1000,
      );

      const { data, error } = await ctx.supabase
        .from("care_events")
        .select("event_type, occurred_at, payload")
        .eq("org_id", orgId)
        .eq("recipient_id", recipientId)
        .gte("occurred_at", fourteenDaysAgo.toISOString())
        .limit(500);

      if (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      }

      const patterns = detectPatterns(data ?? [], now);
      return limit ? patterns.slice(0, limit) : patterns;
    }),
});
