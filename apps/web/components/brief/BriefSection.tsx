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
 * Renders the five brief components: SleepSparkline (only when 7 nights),
 * ComingUpRows (own empty state), OnShiftSidebar, PatternCard (only when
 * non-null). ShiftQuoteNote remains deferred until UX-101 ships
 * `shifts.getLatestHandoff`.
 */

import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { SleepSparkline } from "@/components/brief/SleepSparkline";
import { ComingUpRows } from "@/components/brief/ComingUpRows";
import { OnShiftSidebar } from "@/components/brief/OnShiftSidebar";
import { PatternCard } from "@/components/brief/PatternCard";
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

  if (slot === "primary") {
    return (
      <>
        {sleepNights.length === 7 && <SleepSparkline nights={sleepNights} />}
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
