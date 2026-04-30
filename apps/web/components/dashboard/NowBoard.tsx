"use client";

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { moodBorderClass, type Mood } from "@/lib/mood";

/**
 * UX-056 — Now Board timeline layout.
 *
 * A vertical timeline grouped into "Past", "Now", and "Up Next" relative to
 * the current moment, with a NOW marker rule between Now and Up Next. Each
 * event card has a mood-coloured left border (or the neutral border token
 * when the underlying event has no mood payload).
 *
 * Reference: /tmp/caresync-design/caresync-2-0/project/proto-today.jsx
 */

export type NowBoardProps = {
  recipientId: string | undefined;
  /** Override "now" — only used by tests for deterministic grouping. */
  now?: Date;
};

const VALID_MOODS: ReadonlySet<string> = new Set([
  "good",
  "okay",
  "difficult",
  "crisis",
]);

/** Pull a mood key off a CareEvent payload, returning null if unrecognised. */
function pickMood(payload: Record<string, unknown> | null | undefined): Mood | null {
  if (!payload || typeof payload !== "object") return null;
  const raw = (payload as { mood?: unknown }).mood;
  if (typeof raw !== "string") return null;
  return VALID_MOODS.has(raw) ? (raw as Mood) : null;
}

/** Format the time portion of an ISO string in the user's locale (12h). */
function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/** Human-readable label for an event type. */
const EVENT_TYPE_LABEL: Record<string, string> = {
  journal: "Note",
  medication: "Medication",
  shift: "Shift",
  appointment: "Appointment",
  symptom: "Symptom",
  task: "Task",
  expense: "Expense",
  handoff: "Handoff",
};

/** Cheap title extraction from an event payload. */
function eventTitle(event: TimelineEvent): string {
  const p = event.payload as Record<string, unknown> | null | undefined;
  const summary =
    (p?.["summary"] as string | undefined) ??
    (p?.["title"] as string | undefined) ??
    (p?.["note"] as string | undefined) ??
    (p?.["drug_name"] as string | undefined);
  if (typeof summary === "string" && summary.trim().length > 0) {
    return summary.length > 80 ? summary.slice(0, 77) + "…" : summary;
  }
  return EVENT_TYPE_LABEL[event.event_type] ?? "Event";
}

type TimelineEvent = {
  id: string;
  event_type: string;
  occurred_at: string;
  payload: Record<string, unknown> | null;
};

/** Window (ms) around `now` that counts as "happening now". */
const NOW_WINDOW_MS = 30 * 60 * 1000; // ±30 min

type Bucket = {
  past: TimelineEvent[];
  now: TimelineEvent[];
  upNext: TimelineEvent[];
};

export function bucketEvents(
  events: ReadonlyArray<TimelineEvent>,
  reference: Date,
): Bucket {
  const refMs = reference.getTime();
  const past: TimelineEvent[] = [];
  const now: TimelineEvent[] = [];
  const upNext: TimelineEvent[] = [];
  for (const ev of events) {
    const t = new Date(ev.occurred_at).getTime();
    if (Number.isNaN(t)) {
      past.push(ev);
      continue;
    }
    const delta = t - refMs;
    if (Math.abs(delta) <= NOW_WINDOW_MS) now.push(ev);
    else if (delta < 0) past.push(ev);
    else upNext.push(ev);
  }
  // Past: most-recent first; Up next: soonest first; Now: chronological.
  past.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  upNext.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  now.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  return { past, now, upNext };
}

function EventCard({ event }: { event: TimelineEvent }) {
  const mood = pickMood(event.payload);
  const borderCls = mood
    ? moodBorderClass(mood)
    : "border-l-[var(--color-border)]";
  const typeLabel = EVENT_TYPE_LABEL[event.event_type] ?? event.event_type;
  return (
    <li
      className={
        "rounded-md border border-[var(--color-border)] border-l-4 bg-card px-3 py-2 " +
        borderCls
      }
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wide text-[var(--color-muted)]">
          {typeLabel}
        </span>
        <time
          dateTime={event.occurred_at}
          className="font-mono text-[11px] text-[var(--color-muted)]"
        >
          {formatTime(event.occurred_at)}
        </time>
      </div>
      <div className="mt-1 text-sm text-[var(--color-ink)]">
        {eventTitle(event)}
      </div>
    </li>
  );
}

function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-mono text-[11px] uppercase tracking-wide text-[var(--color-muted)] mb-2">
      {children}
    </h3>
  );
}

function NowMarker({ label }: { label: string }) {
  return (
    <div
      className="flex items-center gap-2 my-2"
      role="separator"
      aria-label={label}
    >
      <span className="h-2 w-2 rounded-full bg-[var(--color-primary)]" aria-hidden="true" />
      <span className="font-mono text-[11px] uppercase tracking-wide font-semibold text-[var(--color-primary)]">
        {label}
      </span>
      <span
        className="flex-1 h-px bg-[var(--color-primary)]/40"
        aria-hidden="true"
      />
    </div>
  );
}

export function NowBoard({ recipientId, now }: NowBoardProps) {
  const referenceTime = useMemo(() => now ?? new Date(), [now]);

  const { data: events, isLoading } = trpc.careEvents.timeline.useQuery(
    { recipientId: recipientId ?? "", limit: 50 },
    { enabled: Boolean(recipientId) },
  );

  const buckets = useMemo(() => {
    if (!events) return { past: [], now: [], upNext: [] };
    return bucketEvents(events as TimelineEvent[], referenceTime);
  }, [events, referenceTime]);

  const nowLabel = `NOW · ${formatTime(referenceTime.toISOString())}`;

  if (!recipientId) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-6 text-center text-sm text-[var(--color-muted)]">
          No recipient selected.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="shadow-sm gap-2">
        <CardHeader className="-mt-4 px-4 py-3 bg-[var(--color-primary-subtle)] border-b border-[var(--color-border)]">
          <CardTitle className="text-sm">Now Board</CardTitle>
        </CardHeader>
        <CardContent className="pt-2 space-y-2">
          <Skeleton className="h-12 w-full rounded" />
          <Skeleton className="h-12 w-full rounded" />
          <Skeleton className="h-12 w-full rounded" />
        </CardContent>
      </Card>
    );
  }

  const totalEvents =
    buckets.past.length + buckets.now.length + buckets.upNext.length;

  return (
    <Card className="shadow-sm gap-2">
      <CardHeader className="-mt-4 px-4 py-3 bg-[var(--color-primary-subtle)] border-b border-[var(--color-border)]">
        <CardTitle className="text-sm">Now Board</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        {totalEvents === 0 ? (
          <p className="text-sm text-[var(--color-muted)] py-6 text-center">
            Nothing logged yet today. Add a note from the journal to start your
            timeline.
          </p>
        ) : (
          <ol
            aria-label="Now Board timeline"
            className="space-y-4 list-none"
          >
            {buckets.past.length > 0 && (
              <li>
                <GroupHeading>Past</GroupHeading>
                <ul className="space-y-2 list-none">
                  {buckets.past.map((ev) => (
                    <EventCard key={ev.id} event={ev} />
                  ))}
                </ul>
              </li>
            )}

            {buckets.now.length > 0 && (
              <li>
                <GroupHeading>Now</GroupHeading>
                <ul className="space-y-2 list-none">
                  {buckets.now.map((ev) => (
                    <EventCard key={ev.id} event={ev} />
                  ))}
                </ul>
              </li>
            )}

            {/* NOW marker — between Now (or Past, if Now is empty) and Up Next */}
            {buckets.upNext.length > 0 && (
              <>
                <li aria-hidden="true">
                  <NowMarker label={nowLabel} />
                </li>
                <li>
                  <GroupHeading>Up next</GroupHeading>
                  <ul className="space-y-2 list-none">
                    {buckets.upNext.map((ev) => (
                      <EventCard key={ev.id} event={ev} />
                    ))}
                  </ul>
                </li>
              </>
            )}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
