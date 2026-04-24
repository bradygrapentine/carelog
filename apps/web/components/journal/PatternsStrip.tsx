"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// TODO(UX-24): replace with real aggregation from care_events.
type Pattern = {
  id: string;
  text: string;
  bgClass: string;
  filterParam: string;
};

const MOCK_PATTERNS: Pattern[] = [
  {
    id: "anxiety-tuesdays",
    text: "Eleanor has been more anxious on Tuesdays (4 of last 5).",
    bgClass: "bg-[var(--color-mood-okay)]/15",
    filterParam: "mood",
  },
  {
    id: "sleep-pt-days",
    text: "Sleep drops by ~90 minutes after PT days.",
    bgClass: "bg-[var(--color-primary-subtle)]",
    filterParam: "mood",
  },
  {
    id: "mood-priya",
    text: "Mood is highest when Priya visits.",
    bgClass: "bg-[var(--color-secondary-subtle)]",
    filterParam: "mood",
  },
];

type PatternsStripProps = {
  recipientId: string;
};

export function PatternsStrip({ recipientId }: PatternsStripProps) {
  const router = useRouter();
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

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
        {MOCK_PATTERNS.map((pattern) => (
          <article
            key={pattern.id}
            data-testid="pattern-card"
            data-pattern-id={pattern.id}
            className={[
              pattern.bgClass,
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
                PATTERN
              </p>
              <p className="text-sm leading-snug text-[var(--color-text-primary)]">
                {pattern.text}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                router.push(
                  `/journal/${recipientId}?filter=${pattern.filterParam}`,
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
