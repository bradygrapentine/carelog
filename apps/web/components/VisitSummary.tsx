"use client";

import { useMemo } from "react";
import { computeAdherence, type MedForAdherence, type DoseEvent } from "@/lib/medAdherence";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Medication = MedForAdherence & {
  dosage: string;
  form: string | null;
  prescriber: string | null;
  active: boolean;
};

export type SymptomReading = {
  id: string;
  pain_level: number | null;
  mood: string | null;
  appetite: string | null;
  mobility: string | null;
  notes: string | null;
  recorded_at: string;
};

export type CareEventRow = DoseEvent & {
  entry_kind: string;
  flagged: boolean;
  payload: Record<string, unknown>;
};

export type RecipientInfo = {
  name: string;
  dob: string | null;
};

export type VisitSummaryProps = {
  recipient: RecipientInfo;
  medications: Medication[];
  doseEvents: CareEventRow[];
  symptomReadings: SymptomReading[];
  journalEntries: CareEventRow[];
  /** Pre-filled questions from ?questions= query param */
  questions?: string;
  /** ISO timestamp for "Generated on" label */
  generatedAt?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function calculateAge(dob: string | null): string | null {
  if (!dob) return null;
  const born = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const m = today.getMonth() - born.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < born.getDate())) age--;
  return age >= 0 ? String(age) : null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Build SVG sparkline from an array of numeric values (min–max normalized). */
function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 3) return null;

  const W = 120;
  const H = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg
      width={W}
      height={H}
      aria-label={label}
      role="img"
      className="inline-block align-middle"
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Section headers ───────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-semibold text-[var(--color-ink)] border-b border-[var(--color-border)] pb-1 mb-3 print:border-black">
      {children}
    </h2>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function VisitSummary({
  recipient,
  medications,
  doseEvents,
  symptomReadings,
  journalEntries,
  questions = "",
  generatedAt,
}: VisitSummaryProps) {
  const WINDOW = 28;

  // § Medications with adherence
  const medsWithAdherence = useMemo(
    () =>
      medications
        .filter((m) => m.active)
        .map((m) => ({
          med: m,
          adherence: computeAdherence(m, doseEvents, WINDOW),
        })),
    [medications, doseEvents],
  );

  // § Vitals from symptom_readings
  const painValues = useMemo(
    () =>
      symptomReadings
        .map((r) => r.pain_level)
        .filter((v): v is number => v !== null),
    [symptomReadings],
  );

  const moodMap: Record<string, number> = {
    good: 4,
    okay: 3,
    difficult: 2,
    crisis: 1,
  };
  const moodValues = useMemo(
    () =>
      symptomReadings
        .map((r) => (r.mood ? (moodMap[r.mood] ?? null) : null))
        .filter((v): v is number => v !== null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [symptomReadings],
  );

  // § Recent symptoms — top 5 symptom readings with notes
  const recentSymptoms = useMemo(
    () =>
      [...symptomReadings]
        .sort(
          (a, b) =>
            new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime(),
        )
        .slice(0, 5),
    [symptomReadings],
  );

  // § Journal highlights — flagged entries, or top 3 most recent
  const journalHighlights = useMemo(() => {
    const flagged = journalEntries.filter((e) => e.flagged);
    const source = flagged.length >= 3 ? flagged : journalEntries;
    return [...source]
      .sort(
        (a, b) =>
          new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
      )
      .slice(0, 3);
  }, [journalEntries]);

  const age = calculateAge(recipient.dob);
  const generated = generatedAt ? formatDate(generatedAt) : formatDate(new Date().toISOString());

  return (
    <article
      className="visit-summary max-w-[720px] mx-auto px-8 py-10 print:px-6 print:py-8 font-sans text-[var(--color-ink)] bg-white"
      aria-label="Visit summary"
    >
      {/* ── Header ── */}
      <header className="mb-8 print:mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-ink)]">
          Visit Summary
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Generated {generated} · Last 4 weeks of care data
        </p>
      </header>

      {/* ── § 1: Patient info ── */}
      <section
        aria-labelledby="section-patient"
        className="mb-8 page-break-inside-avoid"
      >
        <SectionHeading>
          <span id="section-patient">Patient Information</span>
        </SectionHeading>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div>
            <dt className="text-[var(--color-muted)] text-xs uppercase tracking-wide">
              Name
            </dt>
            <dd className="font-medium">{recipient.name}</dd>
          </div>
          {recipient.dob && (
            <div>
              <dt className="text-[var(--color-muted)] text-xs uppercase tracking-wide">
                Date of Birth
              </dt>
              <dd className="font-medium">
                {formatDate(recipient.dob)}
                {age ? ` (age ${age})` : ""}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* ── § 2: Medications ── */}
      <section
        aria-labelledby="section-meds"
        className="mb-8 page-break-inside-avoid"
      >
        <SectionHeading>
          <span id="section-meds">Medications &amp; Adherence (last 28 days)</span>
        </SectionHeading>
        {medsWithAdherence.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">
            No active medications on record.
          </p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs text-[var(--color-muted)] uppercase tracking-wide">
                <th className="pb-2 font-medium">Medication</th>
                <th className="pb-2 font-medium">Dosage</th>
                <th className="pb-2 font-medium">Prescriber</th>
                <th className="pb-2 font-medium text-right">Adherence</th>
              </tr>
            </thead>
            <tbody>
              {medsWithAdherence.map(({ med, adherence }) => (
                <tr
                  key={med.id}
                  className="border-t border-[var(--color-border)] print:border-gray-200"
                >
                  <td className="py-2 font-medium">{med.drug_name}</td>
                  <td className="py-2 text-[var(--color-muted)]">
                    {med.dosage}
                    {med.form ? ` ${med.form}` : ""}
                  </td>
                  <td className="py-2 text-[var(--color-muted)]">
                    {med.prescriber ?? "—"}
                  </td>
                  <td className="py-2 text-right">
                    {adherence.pct !== null ? (
                      <span className="font-medium">{adherence.pct}%</span>
                    ) : (
                      <span className="text-[var(--color-muted)] italic">
                        Adherence unavailable
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ── § 3: Vitals trends ── */}
      <section
        aria-labelledby="section-vitals"
        className="mb-8 page-break-inside-avoid"
      >
        <SectionHeading>
          <span id="section-vitals">Vitals Trends (last 28 days)</span>
        </SectionHeading>
        {painValues.length < 3 && moodValues.length < 3 ? (
          <p className="text-sm text-[var(--color-muted)]">
            Not enough data to show trends (fewer than 3 readings recorded).
          </p>
        ) : (
          <div className="flex flex-wrap gap-8">
            {painValues.length >= 3 && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium w-20">Pain level</span>
                <Sparkline values={painValues} label="Pain level trend over last 28 days" />
                <span className="text-xs text-[var(--color-muted)]">
                  avg {(painValues.reduce((s, v) => s + v, 0) / painValues.length).toFixed(1)}/10
                </span>
              </div>
            )}
            {moodValues.length >= 3 && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium w-20">Mood</span>
                <Sparkline values={moodValues} label="Mood trend over last 28 days" />
                <span className="text-xs text-[var(--color-muted)]">
                  {moodValues[moodValues.length - 1] >= 3 ? "Stable" : "Watch"}
                </span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── § 4: Recent symptoms ── */}
      <section
        aria-labelledby="section-symptoms"
        className="mb-8 page-break-inside-avoid"
      >
        <SectionHeading>
          <span id="section-symptoms">Recent Symptoms (last 28 days)</span>
        </SectionHeading>
        {recentSymptoms.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No symptoms recorded.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {recentSymptoms.map((r) => (
              <li key={r.id} className="flex gap-3">
                <time
                  dateTime={r.recorded_at}
                  className="shrink-0 text-[var(--color-muted)] w-24"
                >
                  {formatDate(r.recorded_at)}
                </time>
                <span>
                  {[
                    r.pain_level !== null ? `Pain ${r.pain_level}/10` : null,
                    r.mood ? `Mood: ${r.mood}` : null,
                    r.notes ?? null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No details"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── § 5: Journal highlights ── */}
      <section
        aria-labelledby="section-journal"
        className="mb-8 page-break-inside-avoid"
      >
        <SectionHeading>
          <span id="section-journal">Journal Highlights</span>
        </SectionHeading>
        {journalHighlights.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No journal entries recorded.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {journalHighlights.map((e) => {
              const note =
                typeof e.payload["note"] === "string"
                  ? e.payload["note"]
                  : typeof e.payload["notes"] === "string"
                    ? e.payload["notes"]
                    : null;
              const excerpt = note ? note.slice(0, 180) + (note.length > 180 ? "…" : "") : "No details";
              return (
                <li key={e.id} className="flex gap-3">
                  <time
                    dateTime={e.occurred_at}
                    className="shrink-0 text-[var(--color-muted)] w-24"
                  >
                    {formatDate(e.occurred_at)}
                  </time>
                  <span className="text-[var(--color-muted)]">{excerpt}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── § 6: Questions for the doctor ── */}
      <section
        aria-labelledby="section-questions"
        className="mb-8 page-break-inside-avoid"
      >
        <SectionHeading>
          <span id="section-questions">Questions for the Doctor</span>
        </SectionHeading>
        <label
          htmlFor="doctor-questions"
          className="block text-xs text-[var(--color-muted)] mb-2"
        >
          Write your questions below before printing, or leave blank to fill in by hand.
        </label>
        <textarea
          id="doctor-questions"
          name="doctor-questions"
          defaultValue={questions}
          rows={6}
          className="w-full border border-[var(--color-border)] rounded p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 print:border-black print:bg-white"
          placeholder="e.g. Should we adjust the Lisinopril dose? …"
          aria-label="Questions for the doctor"
        />
      </section>

      {/* ── Footer ── */}
      <footer className="mt-8 pt-4 border-t border-[var(--color-border)] print:border-gray-300 text-xs text-[var(--color-muted)]">
        <p>
          Generated by CareSync · {generated} · This summary is for informational
          purposes only and does not replace professional medical advice.
        </p>
      </footer>
    </article>
  );
}
