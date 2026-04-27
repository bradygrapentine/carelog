"use client";

// TODO(UX-24+): replace mock bars with aggregated mood-per-day over last 13
// days from care_events. Presentation-only v1.

const MOCK_BARS: number[] = [
  0.55, 0.6, 0.45, 0.7, 0.65, 0.35, 0.5, 0.55, 0.7, 0.6, 0.75, 0.65, 0.85,
];
const MOCK_TODAY_LABEL = "Calm";
const MOCK_TREND_SUMMARY =
  "Mood trending calm over the last 13 days — today's reading is the highest in that window.";

export function MoodCard() {
  return (
    <section
      aria-labelledby="mood-card-heading"
      className="rounded-xl border border-[var(--color-border)] bg-card p-5 shadow-sm"
    >
      <div className="mb-3 flex items-baseline justify-between">
        <h2
          id="mood-card-heading"
          className="text-sm font-semibold text-[var(--color-ink)]"
        >
          Mood
        </h2>
        <span className="eyebrow-mono">last 13 days</span>
      </div>

      <p
        data-testid="mood-label"
        className="headline-display text-[28px] leading-[1.1] text-[var(--color-ink)]"
      >
        {MOCK_TODAY_LABEL}
      </p>

      <div
        data-testid="mood-sparkline"
        role="img"
        aria-label={MOCK_TREND_SUMMARY}
        className="mt-4 flex h-20 items-end gap-1"
      >
        {MOCK_BARS.map((value, idx) => {
          const isToday = idx === MOCK_BARS.length - 1;
          const heightPct = Math.max(6, Math.round(value * 100));
          return (
            <span
              key={idx}
              data-testid="mood-bar"
              data-today={isToday ? "true" : "false"}
              style={{ height: `${heightPct}%` }}
              className={[
                "flex-1 rounded-sm",
                isToday
                  ? "bg-[var(--color-primary)]"
                  : "bg-[var(--color-primary-subtle)]",
              ].join(" ")}
            />
          );
        })}
      </div>
    </section>
  );
}
