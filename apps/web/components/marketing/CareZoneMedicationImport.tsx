"use client";

import { useState } from "react";
import Link from "next/link";

const MAX_MEDICATIONS = 50;

function parseMedications(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, MAX_MEDICATIONS);
}

export function CareZoneMedicationImport() {
  const [value, setValue] = useState("");

  const medications = parseMedications(value);
  const rawLineCount = value
    .split("\n")
    .filter((l) => l.trim().length > 0).length;
  const overLimit = rawLineCount > MAX_MEDICATIONS;

  return (
    <section
      aria-labelledby="cz-import-heading"
      className="mx-auto max-w-2xl px-6 pb-20"
    >
      <div className="rounded-2xl border border-[var(--color-border)] bg-card p-6 shadow-sm">
        <h2
          id="cz-import-heading"
          className="mb-1 text-lg font-bold text-[var(--color-ink)]"
        >
          Preview your medication import
        </h2>
        <p className="mb-5 text-sm text-[var(--color-muted)]">
          Paste your CareZone medication list — one medication per line.
        </p>

        <label
          htmlFor="cz-med-textarea"
          className="mb-1.5 block text-sm font-medium text-[var(--color-ink)]"
        >
          Medication list
        </label>
        <textarea
          id="cz-med-textarea"
          rows={6}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={
            "Paste your medication list, one per line:\nMetformin 500mg\nLisinopril 10mg\n..."
          }
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1 resize-y"
          aria-describedby={
            overLimit ? "cz-med-limit-warning" : "cz-med-helper"
          }
        />

        {overLimit && (
          <p
            id="cz-med-limit-warning"
            role="alert"
            className="mt-2 text-xs text-[var(--color-danger)]"
          >
            Only the first {MAX_MEDICATIONS} medications will be imported.
          </p>
        )}

        {medications.length === 0 && !overLimit && (
          <p
            id="cz-med-helper"
            className="mt-2 text-xs text-[var(--color-muted)]"
          >
            Type or paste your medications above to see a preview.
          </p>
        )}

        {medications.length > 0 && (
          <div className="mt-5">
            <p className="mb-3 text-sm font-medium text-[var(--color-ink)]">
              Ready to import{" "}
              <span className="text-[var(--color-primary)]">
                {medications.length}
              </span>{" "}
              medication{medications.length === 1 ? "" : "s"} when you sign up
            </p>

            <ul
              role="list"
              className="flex flex-wrap gap-2"
              aria-label="Parsed medications"
            >
              {medications.map((med, i) => (
                <li
                  key={i}
                  className="rounded-full border border-[var(--color-border)] bg-[var(--color-primary-subtle)] px-3 py-1 text-xs font-medium text-[var(--color-ink)]"
                >
                  {med}
                </li>
              ))}
            </ul>

            <Link
              href="/signin"
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[var(--color-primary)]/90 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
            >
              Import {medications.length} medication
              {medications.length === 1 ? "" : "s"} — sign up free
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
