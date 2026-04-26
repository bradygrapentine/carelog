"use client";

// TODO(UX-24+): wire to real brief generation output (currently served by
// /api/brief/[shareToken] for external share links). Presentation-only v1.

type StatusPill = {
  id: string;
  label: string;
  tone: "primary" | "success" | "warning";
};

const MOCK_PILLS: StatusPill[] = [
  { id: "meds", label: "3 of 4 meds", tone: "success" },
  { id: "mood", label: "Mood: calm", tone: "primary" },
  { id: "appts", label: "Next appt · PT 2p", tone: "warning" },
];

const PILL_TONE_CLASS: Record<StatusPill["tone"], string> = {
  primary: "bg-[var(--color-primary-subtle)] text-[var(--color-ink)]",
  success:
    "bg-[color-mix(in_oklab,var(--color-success)_15%,white)] text-[var(--color-ink)]",
  warning:
    "bg-[color-mix(in_oklab,var(--color-warning)_18%,white)] text-[var(--color-ink)]",
};

export function BriefHero() {
  return (
    <section
      aria-label="Today's brief"
      className="relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-card p-6 shadow-sm sm:p-8"
    >
      <div
        data-testid="brief-blob"
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 -right-16 h-64 w-64 rounded-full bg-[var(--color-primary-subtle)] opacity-70 blur-3xl"
      />

      <div className="relative space-y-5">
        <span
          data-testid="brief-eyebrow"
          className="eyebrow-mono inline-flex rounded-full border border-[var(--color-border)] bg-white/80 px-2.5 py-1"
        >
          Today&apos;s brief · auto-generated 7:02a
        </span>

        <p
          data-testid="brief-headline"
          className="headline-display text-[26px] leading-[1.2] text-[var(--color-ink)] sm:text-[28px]"
        >
          Eleanor had a <em>settled</em> night — sleep held for seven hours and
          the morning routine is on pace.
        </p>

        <ul className="flex flex-wrap gap-2">
          {MOCK_PILLS.map((pill) => (
            <li key={pill.id}>
              <span
                data-testid="brief-status-pill"
                className={[
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
                  PILL_TONE_CLASS[pill.tone],
                ].join(" ")}
              >
                {pill.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
