"use client";

import { useState } from "react";
import { Check } from "lucide-react";

// TODO(UX-24+): replace mock meds with real medications query keyed by
// recipient. Dashboard currently shows multiple orgs; v1 shows a single
// illustrative list (Eleanor — matches PatternsStrip/handoff conventions).

type Med = {
  id: string;
  name: string;
  dose: string;
  timeLabel: string;
  taken: boolean;
};

const INITIAL_MEDS: Med[] = [
  { id: "donepezil", name: "Donepezil", dose: "5 mg", timeLabel: "8:00a", taken: true },
  { id: "metformin", name: "Metformin", dose: "500 mg", timeLabel: "8:00a", taken: true },
  { id: "lisinopril", name: "Lisinopril", dose: "10 mg", timeLabel: "12:00p", taken: false },
  { id: "atorvastatin", name: "Atorvastatin", dose: "20 mg", timeLabel: "8:00p", taken: false },
];

export function MedCard() {
  const [meds, setMeds] = useState<Med[]>(INITIAL_MEDS);

  const log = (id: string) =>
    setMeds((prev) =>
      prev.map((m) => (m.id === id ? { ...m, taken: true } : m)),
    );

  return (
    <section
      aria-labelledby="meds-card-heading"
      className="rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm"
    >
      <div className="mb-3 flex items-baseline justify-between">
        <h2
          id="meds-card-heading"
          className="text-sm font-semibold text-[var(--color-ink)]"
        >
          Medications
        </h2>
        <span className="eyebrow-mono">
          {meds.filter((m) => m.taken).length} / {meds.length} logged
        </span>
      </div>

      <ul className="space-y-2">
        {meds.map((med) => (
          <li
            key={med.id}
            data-testid="med-row"
            data-med-id={med.id}
            data-taken={med.taken ? "true" : "false"}
            className={[
              "flex items-center gap-3 rounded-lg border border-[var(--color-border)] px-3 py-2",
              med.taken ? "opacity-60" : "bg-white",
            ].join(" ")}
          >
            <span
              aria-hidden="true"
              className={[
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                med.taken
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                  : "border-[var(--color-border)]",
              ].join(" ")}
            >
              {med.taken && <Check className="h-3 w-3" aria-hidden="true" />}
            </span>

            <span className="eyebrow-mono w-12 shrink-0">{med.timeLabel}</span>

            <span
              data-testid="med-name"
              className={[
                "flex-1 text-sm text-[var(--color-ink)]",
                med.taken ? "line-through" : "",
              ].join(" ")}
            >
              {med.name}{" "}
              <span className="text-[var(--color-muted)]">· {med.dose}</span>
            </span>

            {!med.taken && (
              <button
                type="button"
                data-testid="med-log-btn"
                onClick={() => log(med.id)}
                aria-label={`Log ${med.name} ${med.dose} as taken`}
                className="shrink-0 rounded-md bg-[var(--color-primary-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)] hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
              >
                Log
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
