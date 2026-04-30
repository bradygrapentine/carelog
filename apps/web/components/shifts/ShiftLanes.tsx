"use client";

/**
 * UX-058 — Per-person swim-lane week schedule.
 *
 * Pure presentational. Caller assembles the days list, the band labels, and
 * a 2-D assignment grid where each cell is either an aide name or null
 * (open / uncovered). Today's column gets the primary color; today's
 * "live now" band gets bold.
 */

export type ShiftLanesProps = {
  /** 7 day labels — e.g. "Mon 27", "Tue 28", … */
  days: string[];
  /** Band labels — e.g. ["Day 8a–2p", "Aft 2p–6p", "Eve 6p–10p", "Night 10p–8a"]. */
  bands: string[];
  /** assignments[bandIndex][dayIndex] — name string or null for an open shift. */
  assignments: (string | null)[][];
  /** Index into days[] for "today". Out-of-range disables the highlight. */
  todayIndex: number;
  /** Index into bands[] for the live-now band. -1 disables. */
  liveBandIndex: number;
};

export function ShiftLanes({
  days,
  bands,
  assignments,
  todayIndex,
  liveBandIndex,
}: ShiftLanesProps) {
  return (
    <section
      aria-labelledby="shift-lanes-heading"
      data-testid="shift-lanes"
      className="space-y-3"
    >
      <h3
        id="shift-lanes-heading"
        className="text-sm font-semibold text-[var(--color-ink)]"
      >
        This week
      </h3>

      <div
        role="grid"
        aria-rowcount={bands.length + 1}
        aria-colcount={days.length + 1}
        className="overflow-hidden rounded-md border border-[var(--color-border)] text-xs"
        style={{
          display: "grid",
          gridTemplateColumns: `90px repeat(${days.length}, minmax(0, 1fr))`,
        }}
      >
        {/* header row */}
        <div role="rowheader" aria-hidden="true" />
        {days.map((d, i) => (
          <div
            key={`head-${i}`}
            role="columnheader"
            data-testid={`day-header-${i}`}
            data-today={i === todayIndex ? "true" : undefined}
            className={[
              "eyebrow-mono border-b border-[var(--color-border)] px-2 py-1.5",
              i === todayIndex
                ? "font-semibold text-[var(--color-primary)]"
                : "text-[var(--color-muted)]",
            ].join(" ")}
          >
            {d}
          </div>
        ))}

        {/* body rows */}
        {bands.map((band, r) => {
          const isLiveBand = r === liveBandIndex;
          return (
            <div
              key={band}
              role="row"
              data-testid={`band-row-${r}`}
              className="contents"
            >
              <div
                role="rowheader"
                className={[
                  "eyebrow-mono self-center border-b border-[var(--color-border)] px-2 py-3 text-[var(--color-muted)]",
                  isLiveBand ? "font-semibold" : "",
                ].join(" ")}
              >
                {band}
              </div>
              {days.map((_, c) => {
                const who = assignments[r]?.[c] ?? null;
                const isToday = c === todayIndex;
                const liveNow = isToday && isLiveBand;
                if (who === null) {
                  return (
                    <div
                      key={`${r}-${c}`}
                      role="gridcell"
                      data-testid={`cell-${r}-${c}`}
                      data-state="open"
                      aria-label={`Open shift on ${days[c]}, ${band}`}
                      className="border-b border-l border-[var(--color-border)] p-2"
                    >
                      <span className="block rounded-md border border-dashed border-[var(--color-secondary-light)] bg-[var(--color-secondary-subtle)] px-2 py-1 text-center text-[11px] text-[var(--color-secondary)]">
                        Open · cover?
                      </span>
                    </div>
                  );
                }
                return (
                  <div
                    key={`${r}-${c}`}
                    role="gridcell"
                    data-testid={`cell-${r}-${c}`}
                    data-state={liveNow ? "live" : "assigned"}
                    aria-label={`${who} on ${days[c]}, ${band}`}
                    className="flex items-center gap-1.5 border-b border-l border-[var(--color-border)] px-2 py-2"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-subtle)] text-[10px] font-semibold text-[var(--color-primary)]"
                    >
                      {who.slice(0, 1).toUpperCase()}
                    </span>
                    <span
                      className={[
                        "truncate text-[12.5px]",
                        liveNow ? "font-semibold" : "",
                      ].join(" ")}
                    >
                      {who}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
