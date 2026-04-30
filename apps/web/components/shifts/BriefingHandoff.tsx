"use client";

/**
 * UX-058 — Briefing handoff card.
 *
 * Pure presentational. Renders the dark "live handoff" banner from the
 * CareSync 2.0 design plus three numbered-bullet sections (Sleep / Meds /
 * Schedule) that summarize the prior shift in 3 lines.
 *
 * Caller assembles the strings; this component does no data fetch.
 */

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
