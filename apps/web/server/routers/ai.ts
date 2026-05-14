import { z } from "zod";
import { TRPCError } from "@trpc/server";
import Anthropic from "@anthropic-ai/sdk";
import * as Sentry from "@sentry/nextjs";
import { router, protectedProcedure } from "../trpc/index";
import { supabaseAdmin } from "../supabaseAdmin.server";
import { formatContextBlob, type PageContext } from "../../lib/ai-context";
import { buildNameMap, deidentifyText } from "../../lib/ai-deidentify";
import { detectPhiSlip } from "../../lib/ai-phi-monitor";
import { getPostHogClient } from "../../lib/posthog-server";

const SYSTEM_PROMPT = `You are a helpful assistant for CareSync, a family caregiving coordination app.
You help caregivers stay on top of care data, draft communications, and manage schedules.

Rules:
- Be concise and practical. Caregivers are busy.
- Never reproduce names — use "care recipient" and "team member N" as provided in context.
- If you propose an action (sending a message, logging a dose, etc.), format it as:
  ACTION: <action_type> | <description>
  where action_type is one of: send_message, log_mood, suggest_shift, log_medication_dose
- Only propose actions that are explicitly supported. Never suggest deleting or overwriting records.
- If you don't know something, say so. Don't invent care data.`;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const aiRouter = router({
  query: protectedProcedure
    .input(
      z.object({
        prompt: z.string().min(1).max(2000),
        pageContext: z.enum([
          "dashboard",
          "medications",
          "schedule",
          "journal",
          "messages",
          "team",
          "education",
          "other",
        ] as const),
        orgId: z.string().uuid(),
        recipientId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Check consent
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("user_profiles")
        .select("ai_assistant_enabled")
        .eq("id", ctx.user.id)
        .single();

      if (profileError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to check AI assistant consent.",
        });
      }

      if (!profile?.ai_assistant_enabled) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "AI assistant not enabled. Please enable it in settings.",
        });
      }

      // 2. Fetch structured data for context (no free-text fields)
      const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const since7d = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const [
        moodRes,
        medRes,
        msgRes,
        membersRes,
        recipientRes,
        missedDosesRes,
        shiftsRes,
        journalRes,
      ] = await Promise.all([
        ctx.supabase
          .from("mood_entries")
          .select("mood")
          .eq("org_id", input.orgId)
          .gte("occurred_at", since48h),
        ctx.supabase
          .from("medications")
          .select("id")
          .eq("org_id", input.orgId)
          .eq("is_active", true),
        ctx.supabase
          .from("message_threads")
          .select("id")
          .eq("org_id", input.orgId),
        ctx.supabase
          .from("memberships")
          .select("display_name")
          .eq("org_id", input.orgId)
          .not("accepted_at", "is", null),
        input.recipientId
          ? ctx.supabase
              // care_recipients has no display_name column — names live in the
              // display_names PHI-vault table (full_name, keyed by recipient_id).
              .from("display_names")
              .select("full_name")
              .eq("recipient_id", input.recipientId)
              .single()
          : Promise.resolve({ data: null }),
        ctx.supabase
          .from("care_events")
          .select("id", { count: "exact", head: true })
          .eq("org_id", input.orgId)
          .eq("event_type", "medication")
          .contains("payload", { action: "missed" })
          .gte("occurred_at", since7d),
        ctx.supabase
          .from("shifts")
          .select("id", { count: "exact", head: true })
          .eq("org_id", input.orgId)
          .gte("start_at", new Date().toISOString())
          .lte(
            "start_at",
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          ),
        ctx.supabase
          .from("care_events")
          .select("id", { count: "exact", head: true })
          .eq("org_id", input.orgId)
          .eq("event_type", "journal")
          .gte("occurred_at", since7d),
      ]);

      // 3. Build de-identified context blob
      const teamNames = (membersRes.data ?? [])
        .map((m) => m.display_name)
        .filter((n): n is string => Boolean(n));
      const recipientName =
        (recipientRes as { data: { full_name?: string } | null }).data
          ?.full_name ?? "care recipient";
      const nameMap = buildNameMap(recipientName, teamNames);
      const safePrompt = deidentifyText(input.prompt, nameMap);

      const contextBlob = formatContextBlob(input.pageContext as PageContext, {
        recentMoodScores: (moodRes.data ?? []).map((e) => e.mood),
        activeMedCount: medRes.data?.length ?? 0,
        unreadMessageCount: msgRes.data?.length ?? 0,
        missedDosesThisWeek: missedDosesRes.count ?? 0,
        upcomingShiftCount: shiftsRes.count ?? 0,
        recentJournalCount: journalRes.count ?? 0,
        nameMap,
      });

      // 4. Call Claude API
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Context:\n${contextBlob}\n\nQuestion: ${safePrompt}`,
          },
        ],
      });

      const responseText =
        message.content[0]?.type === "text" ? message.content[0].text : "";

      // 5. Parse optional action proposal
      const ALLOWED_ACTION_TYPES = new Set([
        "send_message",
        "log_mood",
        "suggest_shift",
        "log_medication_dose",
      ]);

      const actionMatch = responseText.match(
        /ACTION:\s*(\w+)\s*\|\s*(.+?)(?:\n|$)/i,
      );
      const action =
        actionMatch && ALLOWED_ACTION_TYPES.has(actionMatch[1]!)
          ? { type: actionMatch[1]!, description: actionMatch[2]!.trim() }
          : null;

      // Strip the ACTION line from the displayed response
      const displayText = responseText
        .replace(/ACTION:\s*.+?(?:\n|$)/i, "")
        .trim();

      // 6. PHI-slip observability — detect if LLM echoed a raw PHI name.
      // ADR-0001: only count + UUID identifiers go to Sentry/PostHog. The
      // `matchedKeys` array (raw PHI strings from the response) is intentionally
      // NOT included in either payload. `ctx.user.id` is the Supabase auth UUID
      // (Supabase guarantees uuid for auth.users.id) — safe as distinctId.
      // `input.orgId` is the org UUID and stands in for conversation scope here
      // (no per-thread id exists yet); event property is named `org_id` to be
      // honest about what it is, not `thread_id`.
      const phiResult = detectPhiSlip(displayText, nameMap);
      if (phiResult.slipped) {
        Sentry.captureMessage("ai_phi_slip", {
          level: "warning",
          extra: {
            matchedKeyCount: phiResult.matchedKeys.length,
            orgId: input.orgId,
          },
        });
        getPostHogClient().capture({
          distinctId: ctx.user.id,
          event: "ai_phi_slip",
          properties: {
            matched_key_count: phiResult.matchedKeys.length,
            org_id: input.orgId,
          },
        });
      }

      return { response: displayText, action };
    }),

  enableConsent: protectedProcedure.mutation(async ({ ctx }) => {
    const { error } = await ctx.supabase
      .from("user_profiles")
      .update({ ai_assistant_enabled: true })
      .eq("id", ctx.user.id);
    if (error)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to enable consent.",
      });
    return { ok: true };
  }),

  revokeConsent: protectedProcedure.mutation(async ({ ctx }) => {
    const { error: updateError } = await ctx.supabase
      .from("user_profiles")
      .update({ ai_assistant_enabled: false })
      .eq("id", ctx.user.id);
    if (updateError)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to revoke consent.",
      });
    await ctx.supabase
      .from("ai_conversations")
      .delete()
      .eq("user_id", ctx.user.id);
    return { ok: true };
  }),
});
