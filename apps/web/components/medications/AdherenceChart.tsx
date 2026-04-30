"use client";

/**
 * UX-057 — 7-day medication adherence bar chart.
 *
 * Pure presentational. Caller pre-computes per-day expected vs taken counts
 * (typically via `lib/medAdherence.ts` against `care_events`) and passes them
 * in. Renders one stacked bar per day with a percent label below.
 */

export type AdherenceDay = {
  /** ISO date "YYYY-MM-DD". Used as the React key + aria-label root. */
  date: string;
  /** Short weekday label, e.g. "Mon". */
  weekday: string;
  /** Doses actually logged. */
  taken: number;
  /** Doses scheduled. */
  expected: number;
};

export type AdherenceChartProps = {
  days: AdherenceDay[];
};

function pct(taken: number, expected: number): number | null {
  if (expected <= 0) return null;
  return Math.round((Math.min(taken, expected) / expected) * 100);
}

export function AdherenceChart({ days }: AdherenceChartProps) {
  if (days.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted)]" role="status">
        No adherence data yet.
      </p>
    );
  }

  const totalTaken = days.reduce((s, d) => s + d.taken, 0);
  const totalExpected = days.reduce((s, d) => s + d.expected, 0);
  const overall = pct(totalTaken, totalExpected);

  return (
    <section
      aria-labelledby="adherence-chart-heading"
      className="space-y-3"
      data-testid="adherence-chart"
    >
      <header className="flex items-baseline justify-between">
        <h3
          id="adherence-chart-heading"
          className="text-sm font-semibold text-[var(--color-ink)]"
        >
          7-day adherence
        </h3>
        {overall !== null && (
          <span
            className="eyebrow-mono"
            data-testid="adherence-overall"
            aria-label={`Overall adherence ${overall}%`}
          >
            {overall}%
          </span>
        )}
      </header>

      <ol
        role="list"
        className="grid grid-cols-7 gap-2"
        aria-label="Daily adherence for the past 7 days"
      >
        {days.map((d) => {
          const dayPct = pct(d.taken, d.expected);
          const fillHeight = dayPct ?? 0;
          const stateColor =
            dayPct === null
              ? "var(--color-border)"
              : dayPct >= 80
                ? "var(--color-success)"
                : dayPct >= 50
                  ? "var(--color-secondary)"
                  : "var(--color-danger)";
          const aria =
            dayPct === null
              ? `${d.weekday}: no scheduled doses`
              : `${d.weekday}: ${d.taken} of ${d.expected} doses (${dayPct}%)`;
          return (
            <li
              key={d.date}
              data-testid="adherence-day"
              data-pct={dayPct ?? "n/a"}
              className="flex flex-col items-center gap-1"
            >
              <div
                role="img"
                aria-label={aria}
                className="relative flex h-16 w-full items-end overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)]"
              >
                <span
                  data-testid="adherence-day-fill"
                  data-color={stateColor}
                  style={{
                    height: `${fillHeight}%`,
                    backgroundColor: stateColor,
                  }}
                  className="w-full transition-[height] duration-300"
                />
              </div>
              <span className="eyebrow-mono">{d.weekday}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
