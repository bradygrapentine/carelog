"use client";

/**
 * MoodSpectrum — UX-059 segmented-control variant of the mood picker.
 *
 * Drop-in replacement for the badge/chip mood picker in JournalEntryForm.
 * Same callback signature (`value` + `onChange`) so it can be swapped in
 * without touching the parent form's data flow.
 *
 * Drawn from /tmp/caresync-design/caresync-2-0/project/proto-rest.jsx
 * "moodStyle === 'spectrum'" branch.
 */

import type { Mood } from "@/lib/mood";

const ORDER: { value: Mood; label: string; tokenVar: string }[] = [
  { value: "good", label: "Good", tokenVar: "var(--color-mood-good)" },
  { value: "okay", label: "Okay", tokenVar: "var(--color-mood-okay)" },
  {
    value: "difficult",
    label: "Difficult",
    tokenVar: "var(--color-mood-difficult)",
  },
  { value: "crisis", label: "Hard", tokenVar: "var(--color-mood-crisis)" },
];

type Props = {
  value: Mood | "";
  onChange: (mood: Mood | "") => void;
  /** Optional aria-label override; defaults to "Mood". */
  ariaLabel?: string;
};

export function MoodSpectrum({ value, onChange, ariaLabel = "Mood" }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      data-testid="mood-spectrum"
      className="grid grid-cols-4 gap-1.5 w-full"
    >
      {ORDER.map((m) => {
        const active = value === m.value;
        return (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={active}
            data-mood={m.value}
            onClick={() => onChange(active ? "" : m.value)}
            className={`px-2 py-2 rounded-md text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1 ${
              active
                ? "text-white border-2"
                : "border text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-primary-subtle)]"
            }`}
            style={
              active
                ? { background: m.tokenVar, borderColor: m.tokenVar }
                : undefined
            }
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
