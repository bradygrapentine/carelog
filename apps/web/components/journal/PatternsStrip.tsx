"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import type { Pattern } from "@/lib/detectPattern";

// TD-110: subscribes to briefs.patterns; renders nothing when no pattern
// crosses its detection threshold. Each card matches a real Pattern shape
// (eyebrow / headline / detail / trend) — same data BriefSection's footer
// uses, just rendered as a horizontal scroller of every signal that fired
// rather than just the top one.

type PatternsStripProps = {
  recipientId: string;
  orgId: string;
};

// Tint palette cycles in priority order (med → sleep → mood). detectPatterns
// returns at most three results, so this covers every case without
// embedding tint as a server-side concern.
const TINT_BY_INDEX = [
  "bg-[var(--color-mood-okay)]/15",
  "bg-[var(--color-primary-subtle)]",
  "bg-[var(--color-secondary-subtle)]",
] as const;

function tintFor(index: number): string {
  return TINT_BY_INDEX[index % TINT_BY_INDEX.length] ?? TINT_BY_INDEX[0];
}

// Map a Pattern to the journal filter param the "View entries →" button
// should hand to the journal route. Med misses → medications filter,
// mood cluster → mood filter, sleep dip → sleep filter.
function filterFor(p: Pattern): string {
  if (p.headline.toLowerCase().includes("medication")) return "medication";
  if (p.headline.toLowerCase().includes("sleep")) return "sleep";
  return "mood";
}

export function PatternsStrip({ recipientId, orgId }: PatternsStripProps) {
  const router = useRouter();
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const { data } = trpc.briefs.patterns.useQuery({ recipientId, orgId });
  const patterns = data ?? [];

  if (patterns.length === 0) return null;

  const scrollBehaviorClass = reducedMotion
    ? "scroll-behavior-auto"
    : "scroll-smooth";

  return (
    <section aria-labelledby="patterns-heading" className="space-y-2">
      <div className="flex items-baseline gap-2">
        <h2
          id="patterns-heading"
          className="text-xs font-mono uppercase tracking-widest text-[var(--color-ink)]"
        >
          PATTERNS WE&apos;VE NOTICED
        </h2>
        <span className="text-xs text-[var(--color-muted)]">
          (early experiment)
        </span>
      </div>

      <div
        data-testid="patterns-scroll-container"
        data-reduced-motion={reducedMotion ? "true" : "false"}
        className={[
          "flex gap-3 overflow-x-auto pb-2",
          "snap-x snap-mandatory",
          "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
          scrollBehaviorClass,
        ].join(" ")}
      >
        {patterns.map((pattern, i) => (
          <article
            key={`${pattern.headline}-${i}`}
            data-testid="pattern-card"
            data-pattern-headline={pattern.headline}
            className={[
              tintFor(i),
              "snap-start shrink-0",
              "w-[280px] min-h-[110px]",
              "rounded-lg p-4",
              "flex flex-col justify-between",
              "border border-[var(--color-border)]",
            ].join(" ")}
          >
            <div className="space-y-1">
              <p
                className="text-xs font-mono uppercase tracking-widest opacity-60 text-[var(--color-ink)]"
                aria-hidden="true"
              >
                {pattern.eyebrow}
              </p>
              <p className="text-sm font-medium text-[var(--color-ink)]">
                {pattern.headline}
              </p>
              <p className="text-sm leading-snug text-[var(--color-text-primary)]">
                {pattern.detail}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                router.push(
                  `/journal/${recipientId}?filter=${filterFor(pattern)}`,
                )
              }
              className="mt-2 self-start text-xs text-[var(--color-primary)] hover:text-[var(--color-primary)]/80 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 rounded"
            >
              View entries →
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
