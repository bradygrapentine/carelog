"use client";

/**
 * UX-062 — owns the layout toggle on the shifts route. Default is the
 * existing ShiftCalendar/ShiftList view. Lanes and Now-board derive from
 * the same `shifts.list` query via pure adapters in `lib/shiftLayouts.ts`.
 *
 * Briefing layout is intentionally not wired here — the existing
 * "What did I miss?" handoff modal (UX-19) covers that surface; a
 * narrative adapter for BriefingHandoff sleep/meds/schedule lines is a
 * separate row.
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "../../../../lib/trpc";
import { ShiftLanes } from "@/components/shifts/ShiftLanes";
import { TeamNowBoard } from "@/components/shifts/TeamNowBoard";
import { NarrativeHandoff } from "@/components/shifts/NarrativeHandoff";
import { ShiftWeekGrid } from "@/components/shifts/ShiftWeekGrid";
import { ShiftTeamList } from "@/components/shifts/ShiftTeamList";
import { OpenQuestionsCard } from "@/components/shifts/OpenQuestionsCard";
import { TintedCard, TintedCardHeader } from "@/components/ui/tinted-card";
import { CardContent } from "@/components/ui/card";
import { ShiftList } from "./ShiftList";
import {
  buildShiftLanesData,
  buildShiftWeekGridBlocks,
  buildTeamNowBoard,
} from "@/lib/shiftLayouts";

type Member = {
  id: string;
  role: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
};

type Layout =
  | "narrative"
  | "week-grid"
  | "team-list"
  | "questions"
  | "calendar"
  | "lanes"
  | "now";

const LAYOUT_LABELS: Record<Layout, string> = {
  narrative: "Handoff",
  "week-grid": "Week",
  "team-list": "Team",
  questions: "Questions",
  calendar: "Calendar",
  lanes: "Lanes",
  now: "Now",
};

type Props = {
  orgId: string;
  recipientId: string;
  members: Member[];
  currentUserId: string;
  currentUserRole: string;
};

function getWeekRange(now: Date): { from: string; to: string } {
  const d = new Date(now);
  const dow = d.getDay();
  const monOffset = (dow + 6) % 7;
  const monday = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() - monOffset,
  );
  const sundayEnd = new Date(monday);
  sundayEnd.setDate(monday.getDate() + 7);
  return { from: monday.toISOString(), to: sundayEnd.toISOString() };
}

export function ShiftsPanel(props: Props) {
  const [layout, setLayout] = useState<Layout>("narrative");

  const teamListMembers = useMemo(
    () =>
      props.members.map((m) => ({
        id: m.id,
        name: m.display_name ?? m.email ?? "—",
        role: m.role,
        initials:
          (m.display_name ?? m.email ?? "?")
            .split(" ")
            .map((s) => s[0])
            .filter(Boolean)
            .slice(0, 2)
            .join("")
            .toUpperCase() || "?",
      })),
    [props.members],
  );

  const weekRange = useMemo(() => getWeekRange(new Date()), []);

  const { data: weekShifts = [] } = trpc.shifts.list.useQuery(
    {
      org_id: props.orgId,
      recipient_id: props.recipientId,
      from: weekRange.from,
      to: weekRange.to,
    },
    { enabled: layout !== "calendar" },
  );

  const memberLookup = useMemo(() => {
    const map = new Map(
      props.members.map((m) => [m.user_id, m.display_name ?? m.email ?? null]),
    );
    return { displayName: (id: string) => map.get(id) ?? null };
  }, [props.members]);

  const lanesData = useMemo(() => {
    if (layout !== "lanes") return null;
    return buildShiftLanesData(weekShifts, memberLookup);
  }, [layout, weekShifts, memberLookup]);

  const nowBoardMembers = useMemo(() => {
    if (layout !== "now") return null;
    return buildTeamNowBoard(weekShifts, props.members);
  }, [layout, weekShifts, props.members]);

  const weekGridBlocks = useMemo(() => {
    if (layout !== "week-grid") return [];
    const weekStart = new Date(weekRange.from);
    return buildShiftWeekGridBlocks(weekShifts, memberLookup, weekStart);
  }, [layout, weekShifts, memberLookup, weekRange.from]);

  // ─── Handoff (UX-101b) ────────────────────────────────────────────────────
  // Anchor `now` once per mount — purity-safe per React-19 rule.
  const [now] = useState(() => new Date());

  const utils = trpc.useUtils();

  const { data: latestHandoff } = trpc.shifts.getLatestHandoff.useQuery(
    { recipientId: props.recipientId },
    { enabled: layout === "narrative" },
  );

  // The shift to edit: the current user's most-recently-ended (or in-flight)
  // shift in the loaded week. Caregivers edit only their own shifts;
  // coordinators may edit any but the affordance is intentionally bounded
  // to the same window so the UI stays grounded in "the shift that just
  // happened."
  const editableShift = useMemo(() => {
    if (layout !== "narrative") return null;
    const nowMs = now.getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    const candidates = weekShifts
      .filter((s) => s.assignee_user_id === props.currentUserId)
      .filter((s) => {
        const endMs = Date.parse(s.end_at);
        // ended in last 24h, or currently in progress
        return endMs <= nowMs + dayMs && endMs >= nowMs - dayMs;
      })
      .sort((a, b) => Date.parse(b.end_at) - Date.parse(a.end_at));
    return candidates[0] ?? null;
  }, [layout, weekShifts, props.currentUserId, now]);

  const [editingHandoff, setEditingHandoff] = useState(false);

  const upsertHandoff = trpc.shifts.upsertHandoff.useMutation({
    onSuccess: () => {
      toast.success("Handoff saved");
      setEditingHandoff(false);
      utils.shifts.getLatestHandoff.invalidate({
        recipientId: props.recipientId,
      });
      utils.shifts.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Could not save handoff");
    },
  });

  const handoffEntries = useMemo<{ heading?: string; body: string }[]>(() => {
    if (!latestHandoff) return [];
    const raw = latestHandoff.handoff_entries;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (e): e is { heading?: string; body: string } =>
          !!e &&
          typeof e === "object" &&
          "body" in e &&
          typeof (e as { body: unknown }).body === "string",
      )
      .map((e) => ({
        ...(e.heading ? { heading: e.heading } : {}),
        body: e.body,
      }));
  }, [latestHandoff]);

  const handoffAuthorName = useMemo(() => {
    if (!latestHandoff?.assignee_user_id) return "—";
    return memberLookup.displayName(latestHandoff.assignee_user_id) ?? "—";
  }, [latestHandoff, memberLookup]);

  // ─── Questions (UX-102b) ──────────────────────────────────────────────────
  const { data: questionsRaw = [] } = trpc.shiftQuestions.list.useQuery(
    { recipientId: props.recipientId, openOnly: false },
    { enabled: layout === "questions" },
  );

  const createQuestion = trpc.shiftQuestions.create.useMutation({
    onSuccess: () => {
      toast.success("Question posted");
      setQuestionDraft("");
      utils.shiftQuestions.list.invalidate({
        recipientId: props.recipientId,
      });
    },
    onError: (err) => {
      toast.error(err.message || "Could not post question");
    },
  });

  const resolveQuestion = trpc.shiftQuestions.resolve.useMutation({
    onSuccess: () => {
      toast.success("Question resolved");
      utils.shiftQuestions.list.invalidate({
        recipientId: props.recipientId,
      });
    },
    onError: (err) => {
      toast.error(err.message || "Could not resolve question");
    },
  });

  const [questionDraft, setQuestionDraft] = useState("");

  const questionsView = useMemo(
    () =>
      questionsRaw.map((q) => ({
        id: q.id,
        text: q.body,
        by: memberLookup.displayName(q.raised_by) ?? "—",
        when: new Date(q.raised_at).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }),
        open: q.resolved_at === null,
      })),
    [questionsRaw, memberLookup],
  );

  const handoffWhen = useMemo(() => {
    if (!latestHandoff?.end_at) return "—";
    return new Date(latestHandoff.end_at).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }, [latestHandoff]);

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Shift schedule layout"
        className="flex w-full overflow-x-auto rounded-md border border-[var(--color-border)] bg-card p-1 text-xs"
      >
        {(Object.keys(LAYOUT_LABELS) as Layout[]).map((key) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={layout === key}
            data-state={layout === key ? "active" : "inactive"}
            onClick={() => setLayout(key)}
            className={[
              "flex-1 rounded-sm px-3 py-1.5 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1",
              layout === key
                ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
                : "text-[var(--color-muted)] hover:text-[var(--color-text-secondary)]",
            ].join(" ")}
          >
            {LAYOUT_LABELS[key]}
          </button>
        ))}
      </div>

      {layout === "narrative" && (
        <div className="space-y-2">
          {editingHandoff && editableShift ? (
            <NarrativeHandoff
              mode="edit"
              defaultEntries={handoffEntries}
              submitting={upsertHandoff.isPending}
              onSubmit={(next) =>
                upsertHandoff.mutate({
                  shiftId: editableShift.id,
                  entries: next,
                })
              }
            />
          ) : (
            <NarrativeHandoff
              mode="view"
              entries={handoffEntries}
              author={{ name: handoffAuthorName }}
              when={handoffWhen}
            />
          )}
          {!editingHandoff && editableShift && (
            <button
              type="button"
              onClick={() => setEditingHandoff(true)}
              className="text-xs font-medium text-[var(--color-primary)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 rounded"
            >
              + Write handoff for your last shift
            </button>
          )}
          {editingHandoff && (
            <button
              type="button"
              onClick={() => setEditingHandoff(false)}
              className="text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 rounded"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {layout === "week-grid" && (
        <TintedCard>
          <TintedCardHeader title="This week" />
          <CardContent className="pt-2 pb-4">
            <ShiftWeekGrid blocks={weekGridBlocks} />
          </CardContent>
        </TintedCard>
      )}

      {layout === "team-list" && <ShiftTeamList members={teamListMembers} />}

      {layout === "questions" && (
        <div className="space-y-3">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = questionDraft.trim();
              if (!trimmed) return;
              createQuestion.mutate({
                orgId: props.orgId,
                recipientId: props.recipientId,
                body: trimmed,
              });
            }}
          >
            <label htmlFor="shift-question-input" className="sr-only">
              Ask a question for the team
            </label>
            <input
              id="shift-question-input"
              type="text"
              value={questionDraft}
              onChange={(e) => setQuestionDraft(e.target.value)}
              maxLength={2000}
              placeholder="Ask the team a question…"
              className="flex-1 rounded-md border border-[var(--color-border)] bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
            />
            <button
              type="submit"
              disabled={
                createQuestion.isPending || questionDraft.trim().length === 0
              }
              className="rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary)]/90 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 disabled:opacity-50"
            >
              {createQuestion.isPending ? "Posting…" : "Post"}
            </button>
          </form>
          <OpenQuestionsCard
            questions={questionsView}
            onRespond={(id) => resolveQuestion.mutate({ id })}
          />
        </div>
      )}

      {layout === "calendar" && <ShiftList {...props} />}

      {layout === "lanes" && lanesData && (
        <TintedCard>
          <TintedCardHeader title="This week — by lane" />
          <CardContent className="pt-2 pb-4">
            <ShiftLanes {...lanesData} />
          </CardContent>
        </TintedCard>
      )}

      {layout === "now" && nowBoardMembers && (
        <TintedCard>
          <TintedCardHeader title="Care team — right now" />
          <CardContent className="pt-2 pb-4">
            <TeamNowBoard members={nowBoardMembers} />
          </CardContent>
        </TintedCard>
      )}
    </div>
  );
}
