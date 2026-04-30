"use client";

/**
 * UX-057 — 24h day-strip showing scheduled doses with state.
 *
 * Pure presentational. Caller computes the dose list (typically by joining
 * medication_schedules with today's care_events of type='medication') and
 * passes already-resolved state values. The strip renders a horizontal
 * timeline with a NOW marker and a positioned dot per dose.
 */

export type DoseState = "done" | "due" | "upcoming" | "missed" | "prn";

export type StripDose = {
  /** Stable id for the React key. Typically the schedule row id. */
  id: string;
  /** "HH:MM" 24h. PRN doses use the keyword "prn" (no positioning). */
  time: string;
  /** Short label rendered as a tooltip / aria-label. e.g. "Levothyroxine 50mcg". */
  label: string;
  state: DoseState;
};

export type MedScheduleStripProps = {
  doses: StripDose[];
  /** Hour of day for the NOW marker (0–24, may be fractional). */
  now: number;
};

const STATE_DOT_CLASS: Record<DoseState, string> = {
  done: "bg-[var(--color-success)] border-[var(--color-success)]",
  due: "bg-[var(--color-secondary)] border-[var(--color-secondary)]",
  upcoming: "bg-[var(--color-surface)] border-[var(--color-primary-light)]",
  missed: "bg-[var(--color-danger)] border-[var(--color-danger)]",
  prn: "bg-[var(--color-tertiary-subtle)] border-[var(--color-tertiary)]",
};

function parseHour(time: string): number | null {
  if (time.toLowerCase() === "prn") return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h + mm / 60;
}

export function MedScheduleStrip({ doses, now }: MedScheduleStripProps) {
  const positioned = doses
    .map((d) => ({ dose: d, hour: parseHour(d.time) }))
    .filter((p): p is { dose: StripDose; hour: number } => p.hour !== null);
  const prnDoses = doses.filter((d) => parseHour(d.time) === null);

  const clampedNow = Math.min(Math.max(now, 0), 24);

  return (
    <div
      role="group"
      aria-label="Today's medication schedule"
      className="space-y-2"
    >
      <div
        data-testid="med-schedule-strip-track"
        className="relative h-10 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)]"
      >
        {/* Hour ticks every 6h */}
        {[0, 6, 12, 18, 24].map((h) => (
          <span
            key={h}
            aria-hidden="true"
            style={{ left: `${(h / 24) * 100}%` }}
            className="absolute top-0 h-full w-px bg-[var(--color-border)]"
          />
        ))}

        {/* NOW marker */}
        <span
          data-testid="med-schedule-strip-now"
          aria-label="Current time marker"
          style={{ left: `${(clampedNow / 24) * 100}%` }}
          className="absolute -top-1 bottom-[-0.25rem] w-px bg-[var(--color-primary)]"
        />

        {/* Dose dots */}
        {positioned.map(({ dose, hour }) => (
          <span
            key={dose.id}
            data-testid="med-schedule-dot"
            data-state={dose.state}
            aria-label={`${dose.label} at ${dose.time} — ${dose.state}`}
            title={`${dose.label} · ${dose.time}`}
            style={{ left: `${(hour / 24) * 100}%` }}
            className={[
              "absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2",
              STATE_DOT_CLASS[dose.state],
            ].join(" ")}
          />
        ))}
      </div>

      {/* Hour labels */}
      <div
        aria-hidden="true"
        className="flex justify-between text-[10px] text-[var(--color-muted)] eyebrow-mono"
      >
        <span>12a</span>
        <span>6a</span>
        <span>12p</span>
        <span>6p</span>
        <span>12a</span>
      </div>

      {/* PRN doses (off-timeline) */}
      {prnDoses.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="As-needed doses">
          {prnDoses.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-1.5 rounded-full border border-[var(--color-tertiary)] bg-[var(--color-tertiary-subtle)] px-2 py-0.5 text-[11px] text-[var(--color-text-primary)]"
            >
              <span className="eyebrow-mono">PRN</span>
              <span>{d.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
