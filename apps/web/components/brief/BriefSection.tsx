"use client";

/**
 * UX-095 finalize — owns the dashboard "brief" surface end-to-end.
 *
 * Subscribes once to `briefs.dashboardSummary` and runs the four Wave-8
 * adapters (sleepFromEvents, comingUpEvents, deriveOnShift, detectPattern)
 * in `useMemo`. The `now` anchor is captured once at mount via
 * `useState(() => new Date())` to satisfy React 19's `react-hooks/purity`
 * rule — no `Date.now()` / `new Date()` in render or `useMemo` bodies.
 *
 * Renders five brief components: SleepSparkline (only when 7 nights),
 * ComingUpRows (own empty state), OnShiftSidebar, PatternCard (only when
 * non-null), and ShiftQuoteNote (only when shifts.getLatestHandoff returns
 * a non-empty narrative — wired in UX-101c).
 */

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { SleepSparkline } from "@/components/brief/SleepSparkline";
import { ComingUpRows } from "@/components/brief/ComingUpRows";
import { OnShiftSidebar } from "@/components/brief/OnShiftSidebar";
import { PatternCard } from "@/components/brief/PatternCard";
import { ShiftQuoteNote } from "@/components/brief/ShiftQuoteNote";
import { sleepFromEvents } from "@/lib/sleepFromEvents";
import { comingUpEvents } from "@/lib/comingUpEvents";
import { deriveOnShift } from "@/lib/deriveOnShift";
import { detectPattern } from "@/lib/detectPattern";

type Props = {
  recipientId: string;
  orgId: string;
};

type Slot = "primary" | "sidebar" | "footer";

/**
 * Render the brief surface. The `slot` prop lets DashboardClient mount
 * different pieces in different layout columns without duplicating the
 * tRPC subscription (TanStack Query dedupes calls with identical inputs).
 *
 *   - "primary"  → SleepSparkline + ComingUpRows
 *   - "sidebar"  → OnShiftSidebar
 *   - "footer"   → PatternCard
 */
export function BriefSection({
  recipientId,
  orgId,
  slot,
}: Props & { slot: Slot }) {
  const [now] = useState(() => new Date());

  const { data, isLoading } = trpc.briefs.dashboardSummary.useQuery({
    recipientId,
    orgId,
  });

  const sleepNights = useMemo(
    () => (data ? sleepFromEvents(data.careEvents, now) : []),
    [data, now],
  );

  const comingUp = useMemo(
    () =>
      data
        ? comingUpEvents({
            scheduledMeds: data.scheduledMeds,
            appointments: data.appointments,
            now,
          })
        : [],
    [data, now],
  );

  const onShift = useMemo(
    () =>
      data
        ? deriveOnShift({
            shifts: data.shifts,
            members: data.members,
            latestMood: data.latestMood,
            now,
          })
        : { onNow: null, upNext: null, latestMood: null },
    [data, now],
  );

  const pattern = useMemo(
    () => (data ? detectPattern(data.careEvents, now) : null),
    [data, now],
  );

  // UX-101c — most-recent past shift's narrative handoff.
  // Independent tRPC query (different cache key); subscribed only when
  // the primary slot is rendered, so sidebar/footer slots don't pay the
  // cost on dashboards that re-mount BriefSection multiple times.
  const { data: latestHandoff } = trpc.shifts.getLatestHandoff.useQuery(
    { recipientId },
    { enabled: slot === "primary" },
  );

  // Build the quote string from the first entry's body. Inner shape
  // {heading?, body} matches the tRPC output and the migration's CHECK
  // (array of objects); we defensively narrow.
  const handoffQuote = useMemo<{
    quote: string;
    by: string;
    when: string;
  } | null>(() => {
    if (!latestHandoff) return null;
    const raw = latestHandoff.handoff_entries;
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const first = raw[0];
    if (
      !first ||
      typeof first !== "object" ||
      !("body" in first) ||
      typeof (first as { body: unknown }).body !== "string"
    ) {
      return null;
    }
    const body = (first as { body: string }).body.trim();
    if (!body) return null;

    // Caregiver name resolution from members lookup if available.
    const caregiver = data?.members.find(
      (m) => m.user_id === latestHandoff.assignee_user_id,
    );
    const by = caregiver?.display_name ?? "Previous shift";
    const when = latestHandoff.end_at
      ? new Date(latestHandoff.end_at).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "—";

    return { quote: body, by, when };
  }, [latestHandoff, data]);

  if (slot === "primary") {
    return (
      <>
        {sleepNights.length === 7 && <SleepSparkline nights={sleepNights} />}
        {handoffQuote && (
          <ShiftQuoteNote
            quote={handoffQuote.quote}
            by={handoffQuote.by}
            when={handoffQuote.when}
          />
        )}
        <ComingUpRows events={comingUp} />
      </>
    );
  }

  if (slot === "sidebar") {
    if (isLoading && !data) {
      return <OnShiftSidebar onNow={null} upNext={null} latestMood={null} />;
    }
    return (
      <OnShiftSidebar
        onNow={onShift.onNow}
        upNext={onShift.upNext}
        latestMood={onShift.latestMood}
      />
    );
  }

  // footer
  if (!pattern) return null;
  return <PatternCard {...pattern} />;
}
