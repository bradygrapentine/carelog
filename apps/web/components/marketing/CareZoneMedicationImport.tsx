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
  const hasMeds = medications.length > 0;

  return (
    <section
      aria-labelledby="cz-import-heading"
      className="mx-auto max-w-4xl px-6 pb-20"
    >
      <div className="rounded-2xl border border-[var(--color-border)] bg-card p-6 shadow-sm sm:p-8">
        <h2
          id="cz-import-heading"
          className="mb-1 text-lg font-bold text-[var(--color-ink)]"
        >
          Preview your medication import
        </h2>
        <p className="mb-6 text-sm text-[var(--color-muted)]">
          Paste your CareZone medication list, one medication per line. We'll
          show you exactly what we'll bring over before you sign up.
        </p>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* LEFT — paste input */}
          <div className="flex flex-col">
            <label
              htmlFor="cz-med-textarea"
              className="mb-1.5 block text-sm font-medium text-[var(--color-ink)]"
            >
              Medication list
            </label>
            <textarea
              id="cz-med-textarea"
              rows={10}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={
                "Paste your medication list, one per line:\nMetformin 500mg\nLisinopril 10mg\n..."
              }
              className="min-h-[12rem] w-full flex-1 resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1"
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

            {!hasMeds && !overLimit && (
              <p
                id="cz-med-helper"
                className="mt-2 text-xs text-[var(--color-muted)]"
              >
                Type or paste your medications above to see a live preview.
              </p>
            )}
          </div>

          {/* RIGHT — preview + CTA */}
          <div className="flex flex-col">
            <div className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-primary-subtle)] p-5">
              {hasMeds ? (
                <>
                  <p className="mb-3 text-sm font-medium text-[var(--color-ink)]">
                    Ready to import{" "}
                    <span className="text-[var(--color-primary-deep)]">
                      {medications.length}
                    </span>{" "}
                    medication{medications.length === 1 ? "" : "s"}
                  </p>
                  <ul
                    role="list"
                    className="flex flex-wrap gap-2"
                    aria-label="Parsed medications"
                  >
                    {medications.map((med, i) => (
                      <li
                        key={i}
                        className="rounded-full border border-[var(--color-border)] bg-card px-3 py-1 text-xs font-medium text-[var(--color-ink)]"
                      >
                        {med}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  <p className="mb-2 text-sm font-medium text-[var(--color-ink)]">
                    Live preview
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Each line you paste appears here as a medication chip. We
                    keep your list local in this browser — nothing is uploaded
                    until you create your account.
                  </p>
                </>
              )}
            </div>

            {/* CTA block */}
            <div className="mt-6">
              <p className="mb-1 text-base font-semibold text-[var(--color-ink)]">
                Ready to start logging?
              </p>
              <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
                We'll create your care team and seed today's brief from your
                medications.
              </p>
              <Link
                href="/signin"
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-[var(--color-app-shell-text)] shadow-sm transition-all hover:bg-[var(--color-primary-hover)] hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 active:bg-[var(--color-primary-pressed)] sm:w-auto"
              >
                {hasMeds
                  ? `Import ${medications.length} medication${medications.length === 1 ? "" : "s"}, sign up free`
                  : "Start your family's log"}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
