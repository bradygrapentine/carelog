"use client";

import { trpc } from "@/lib/trpc";

type Props = {
  recipientId?: string;
  orgId?: string;
};

export function MoodCard({ recipientId, orgId }: Props) {
  const enabled = !!recipientId && !!orgId;
  const { data, isLoading, isError } = trpc.moodEntries.sparkline.useQuery(
    { recipientId: recipientId ?? "", orgId: orgId ?? "", days: 13 },
    { enabled, staleTime: 60_000 },
  );

  // ── Loading state ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <section
        aria-labelledby="mood-card-heading"
        aria-busy="true"
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
        <div
          data-testid="mood-loading"
          className="mt-2 h-7 w-28 animate-pulse rounded bg-[var(--color-primary-subtle)]"
          aria-hidden="true"
        />
        <div
          data-testid="mood-sparkline"
          role="img"
          aria-label="Loading mood sparkline"
          className="mt-4 flex h-20 items-end gap-1"
        >
          {Array.from({ length: 13 }).map((_, idx) => (
            <span
              key={idx}
              data-testid="mood-bar"
              data-today={idx === 12 ? "true" : "false"}
              style={{ height: `${30 + ((idx * 13) % 40)}%` }}
              className="flex-1 animate-pulse rounded-sm bg-[var(--color-primary-subtle)]"
            />
          ))}
        </div>
      </section>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (isError) {
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
          data-testid="mood-error"
          className="text-sm text-[var(--color-danger)]"
        >
          Unable to load mood data. Please try refreshing.
        </p>
      </section>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!data?.hasData) {
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
          data-testid="mood-empty"
          className="text-sm text-[var(--color-muted)]"
        >
          No mood entries yet. Log one from the journal.
        </p>
      </section>
    );
  }

  // ── Data state ───────────────────────────────────────────────────────────
  const bars = data.bars;
  const todayLabel = data.todayLabel ?? "—";
  const trendSummary = data.trendSummary;

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
        {todayLabel}
      </p>

      <div
        data-testid="mood-sparkline"
        role="img"
        aria-label={trendSummary}
        className="mt-4 flex h-20 items-end gap-1"
      >
        {bars.map((value, idx) => {
          const isToday = idx === bars.length - 1;
          // Min 6% so empty days are a tiny placeholder rather than invisible.
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
