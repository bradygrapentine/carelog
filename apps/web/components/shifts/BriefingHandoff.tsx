"use client";

/**
 * UX-058 — Briefing handoff card (presentational).
 * UX-065 — BriefingHandoffPanel (connected, data-fetching wrapper).
 *
 * BriefingHandoff: pure presentational — renders the dark "live handoff"
 * banner plus three numbered-bullet sections (Sleep / Meds / Schedule).
 * Caller assembles the strings; this component does no data fetch.
 *
 * BriefingHandoffPanel: fetches careEvents.timeline via tRPC and computes
 * narrative strings via handoffNarrative helpers.
 */

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  summarizeSleep,
  summarizeMeds,
  summarizeSchedule,
} from "@/lib/handoffNarrative";
import { CardContent } from "@/components/ui/card";
import { TintedCard, TintedCardHeader } from "@/components/ui/tinted-card";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Presentational component (UX-058) ───────────────────────────────────────

export type HandoffSeverity = "good" | "okay" | "difficult";

export type HandoffLine = {
  severity: HandoffSeverity;
  text: string;
};

export type BriefingHandoffProps = {
  /** Handing off FROM this person. */
  from: string;
  /** Handing off TO this person. Use "you" for the viewer. */
  to: string;
  /** Minutes until handoff. Negative means already past. */
  minutesUntil: number;
  /** Headline summary, e.g. "Three doses missed overnight, one hard wake at 2a." */
  summary: string;
  /** Three sections — caller decides ordering and content. */
  sleep: HandoffLine;
  meds: HandoffLine;
  schedule: HandoffLine;
};

const SEVERITY_BADGE: Record<HandoffSeverity, string> = {
  good: "bg-[var(--color-success-subtle)] text-[var(--color-success)]",
  okay: "bg-[var(--color-warning-subtle)] text-[var(--color-warning)]",
  difficult: "bg-[var(--color-danger-subtle)] text-[var(--color-danger)]",
};

function formatHandoffWindow(minutesUntil: number): string {
  if (minutesUntil < 0) {
    const ago = Math.abs(minutesUntil);
    return `Handoff ${ago} min ago`;
  }
  if (minutesUntil < 60) return `Handoff in ${minutesUntil} min`;
  const hrs = Math.floor(minutesUntil / 60);
  const mins = minutesUntil % 60;
  return mins === 0 ? `Handoff in ${hrs}h` : `Handoff in ${hrs}h ${mins}m`;
}

export function BriefingHandoff({
  from,
  to,
  minutesUntil,
  summary,
  sleep,
  meds,
  schedule,
}: BriefingHandoffProps) {
  const sections: {
    key: "sleep" | "meds" | "schedule";
    label: string;
    line: HandoffLine;
  }[] = [
    { key: "sleep", label: "Sleep", line: sleep },
    { key: "meds", label: "Meds", line: meds },
    { key: "schedule", label: "Schedule", line: schedule },
  ];

  return (
    <article
      aria-labelledby="briefing-handoff-title"
      data-testid="briefing-handoff"
      className="space-y-4"
    >
      <header
        data-testid="briefing-handoff-banner"
        className="rounded-xl bg-[var(--color-app-shell)] px-6 py-5 text-[var(--color-app-shell-text)]"
      >
        <p className="eyebrow-mono text-[var(--color-app-shell-muted)]">
          {formatHandoffWindow(minutesUntil)}
        </p>
        <h2
          id="briefing-handoff-title"
          className="headline-display mt-1 text-2xl"
        >
          <em>{from}</em> is handing off to <em>{to}</em>.
        </h2>
        <p className="mt-3 text-sm text-[var(--color-app-shell-muted)]">
          {summary}
        </p>
      </header>

      <ol
        role="list"
        aria-label="Last shift in three lines"
        className="space-y-2"
      >
        {sections.map(({ key, label, line }, idx) => (
          <li
            key={key}
            data-testid={`briefing-section-${key}`}
            className="flex gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
          >
            <span
              aria-hidden="true"
              className={[
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                SEVERITY_BADGE[line.severity],
              ].join(" ")}
            >
              {idx + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="eyebrow-mono">{label}</p>
              <p className="mt-1 text-sm text-[var(--color-text-primary)]">
                {line.text}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}

// ─── Connected wrapper (UX-065) ───────────────────────────────────────────────

type BriefingHandoffPanelProps = {
  recipientId: string;
};

/**
 * Data-fetching wrapper. Calls careEvents.timeline for the recipient
 * (last 50 events) and computes 3 narrative strings via handoffNarrative.
 *
 * PHI rule: no narrative strings are passed to PostHog or Sentry.
 * Error state: surfaces a retry button — error object only, no user data.
 */
export function BriefingHandoffPanel({
  recipientId,
}: BriefingHandoffPanelProps) {
  const {
    data: events = [],
    isLoading,
    isError,
    refetch,
  } = trpc.careEvents.timeline.useQuery(
    { recipientId, limit: 50 },
    { enabled: Boolean(recipientId) },
  );

  // Narrative strings — deterministic, no Date.now() inside, React-19 safe.
  const sleepLine = useMemo(() => summarizeSleep(events), [events]);
  const medsLine = useMemo(() => summarizeMeds(events), [events]);
  const scheduleLine = useMemo(() => summarizeSchedule(events), [events]);

  if (isLoading) {
    return (
      <TintedCard>
        <TintedCardHeader title="Briefing" />
        <CardContent
          className="space-y-3 pt-3 pb-4"
          aria-label="Loading briefing…"
          aria-busy="true"
        >
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-5/6" />
        </CardContent>
      </TintedCard>
    );
  }

  if (isError) {
    return (
      <TintedCard>
        <TintedCardHeader title="Briefing" />
        <CardContent className="pt-3 pb-4">
          <p
            role="alert"
            className="text-sm text-[var(--color-danger)]"
            data-testid="briefing-error"
          >
            Could not load briefing data.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-2 min-h-[40px] min-w-[40px] rounded px-3 py-2 text-sm font-medium text-[var(--color-primary)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
            data-testid="briefing-retry"
          >
            Retry
          </button>
        </CardContent>
      </TintedCard>
    );
  }

  const panelSections: {
    key: "sleep" | "meds" | "schedule";
    label: string;
    text: string;
  }[] = [
    { key: "sleep", label: "Sleep", text: sleepLine },
    { key: "meds", label: "Meds", text: medsLine },
    { key: "schedule", label: "Schedule", text: scheduleLine },
  ];

  return (
    <TintedCard>
      <TintedCardHeader title="Briefing" />
      <CardContent className="pt-3 pb-4">
        <ol role="list" aria-label="Prior shift briefing" className="space-y-2">
          {panelSections.map(({ key, label, text }) => (
            <li
              key={key}
              data-testid={`briefing-panel-section-${key}`}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
            >
              <p className="eyebrow-mono">{label}</p>
              <p
                className="mt-1 text-sm text-[var(--color-text-primary)]"
                data-testid={`briefing-panel-line-${key}`}
              >
                {text}
              </p>
            </li>
          ))}
        </ol>
      </CardContent>
    </TintedCard>
  );
}
