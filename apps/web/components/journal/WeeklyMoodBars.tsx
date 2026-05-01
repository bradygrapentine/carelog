type MoodBucket = "good" | "steady" | "difficult";

type MoodCount = {
  mood: MoodBucket;
  count: number;
};

type WeeklyMoodBarsProps = {
  counts: MoodCount[];
  topTags?: { tag: string; count: number }[];
  className?: string;
};

const MOOD_LABEL: Record<MoodBucket, string> = {
  good: "Good",
  steady: "Steady",
  difficult: "Difficult",
};

const MOOD_TOKEN: Record<MoodBucket, string> = {
  good: "var(--color-mood-good)",
  steady: "var(--color-mood-okay)",
  difficult: "var(--color-mood-difficult)",
};

export function WeeklyMoodBars({
  counts,
  topTags,
  className,
}: WeeklyMoodBarsProps) {
  const totalCount = counts.reduce((s, c) => s + c.count, 0);
  const totalTags = topTags?.length ?? 0;

  if (totalCount === 0 && totalTags === 0) {
    return (
      <section
        className={[
          "rounded-xl border border-[var(--color-border)] bg-card p-4",
          className ?? "",
        ]
          .join(" ")
          .trim()}
      >
        <p className="eyebrow-mono mb-2">Mood this week</p>
        <p className="text-sm text-[var(--color-muted)]">
          Not enough entries yet.
        </p>
      </section>
    );
  }

  const max = counts.reduce((m, c) => Math.max(m, c.count), 0) || 1;

  return (
    <section
      className={[
        "rounded-xl border border-[var(--color-border)] bg-card p-4",
        className ?? "",
      ]
        .join(" ")
        .trim()}
      role="figure"
      aria-label="Weekly mood distribution"
    >
      <p className="eyebrow-mono mb-3">Mood this week</p>

      <ul className="space-y-2">
        {counts.map((c) => {
          const widthPct = (c.count / max) * 100;
          return (
            <li
              key={c.mood}
              className="flex items-center gap-3"
              aria-label={`Mood ${c.mood}: ${c.count} ${c.count === 1 ? "entry" : "entries"}`}
            >
              <span className="w-16 shrink-0 text-xs text-[var(--text-secondary)]">
                {MOOD_LABEL[c.mood]}
              </span>
              <span className="flex-1 h-2 rounded-full bg-[var(--color-surface-muted)] overflow-hidden">
                <span
                  data-testid={`mood-bar-${c.mood}`}
                  className="block h-full rounded-full"
                  style={{
                    width: `${widthPct}%`,
                    background: MOOD_TOKEN[c.mood],
                  }}
                />
              </span>
              <span className="w-6 shrink-0 font-mono text-xs text-[var(--color-muted)] text-right">
                {c.count}
              </span>
            </li>
          );
        })}
      </ul>

      {topTags && topTags.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
          <p className="eyebrow-mono mb-2">Top tags</p>
          <ul className="flex flex-wrap gap-1.5">
            {topTags.map((t) => (
              <li
                key={t.tag}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-xs"
              >
                <span className="text-[var(--text-primary)]">{t.tag}</span>
                <span className="font-mono text-[var(--color-muted)]">
                  {t.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
