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
import { buildShiftLanesData, buildTeamNowBoard } from "@/lib/shiftLayouts";

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
        <NarrativeHandoff
          mode="view"
          entries={[]}
          author={{ name: "—" }}
          when="—"
        />
      )}

      {layout === "week-grid" && (
        <TintedCard>
          <TintedCardHeader title="This week" />
          <CardContent className="pt-2 pb-4">
            <ShiftWeekGrid blocks={[]} />
          </CardContent>
        </TintedCard>
      )}

      {layout === "team-list" && <ShiftTeamList members={teamListMembers} />}

      {layout === "questions" && <OpenQuestionsCard questions={[]} />}

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
