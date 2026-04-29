import Link from "next/link";
import { Check, X } from "lucide-react";

type ComparisonRow = {
  feature: string;
  careZone: boolean | string;
  carelog: boolean | string;
};

const comparisonRows: ComparisonRow[] = [
  { feature: "Medication catalog", careZone: true, carelog: true },
  { feature: "Prescription label scanning", careZone: false, carelog: true },
  { feature: "Refill alerts", careZone: true, carelog: true },
  { feature: "Care journal", careZone: true, carelog: true },
  { feature: "Shared with full family", careZone: true, carelog: true },
  {
    feature: "Professional aide coordination",
    careZone: false,
    carelog: true,
  },
  { feature: "Shift scheduling", careZone: false, carelog: true },
  { feature: "Caregiver burnout tracker", careZone: false, carelog: true },
  { feature: "Document vault", careZone: false, carelog: true },
  { feature: "Weekly team digest", careZone: false, carelog: true },
  {
    feature: "Data export (always available)",
    careZone: "Discontinued",
    carelog: true,
  },
  { feature: "Still active", careZone: "Shut down 2024", carelog: true },
];

function CellIcon({ value }: { value: boolean | string }) {
  if (value === true) {
    return (
      <span className="flex items-center justify-center">
        <Check
          className="h-5 w-5 text-[var(--color-primary)]"
          aria-label="Yes"
        />
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="flex items-center justify-center">
        <X className="h-5 w-5 text-[var(--color-muted)]" aria-label="No" />
      </span>
    );
  }
  return (
    <span className="flex items-center justify-center gap-1 text-xs text-[var(--color-muted)]">
      <X className="h-4 w-4 shrink-0" aria-hidden="true" />
      {value}
    </span>
  );
}

export function CareZoneAlternativePage() {
  return (
    <>
      {/* ── Hero ──────────────────────────────────────────── */}
      <section
        aria-labelledby="cz-hero-heading"
        className="relative mx-auto max-w-4xl px-6 pb-16 text-center"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">
          CareZone users, your data deserves a new home
        </p>
        <h1
          id="cz-hero-heading"
          className="text-4xl font-extrabold leading-tight tracking-tight text-[var(--color-ink)] md:text-5xl"
        >
          The CareZone alternative built for the whole care team
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-[var(--color-text-secondary)]">
          CareZone helped families manage medications. CareSync goes further,
          coordinating your full team of family caregivers, professional aides,
          and supporters.{" "}
          <span className="font-semibold text-[var(--color-ink)]">
            $14/month for everyone.
          </span>
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signin"
            className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-[var(--color-app-shell-text)] shadow-sm transition-all hover:bg-[var(--color-primary)]/90 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
          >
            Start free, no credit card
          </Link>
          <Link
            href="/#features"
            className="inline-flex items-center justify-center rounded-xl border-2 border-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
          >
            See how it works
          </Link>
        </div>

        <p className="mt-4 text-xs text-[var(--color-muted)]">
          Migrating from CareZone? Import your medication list below{" "}
          <a
            href="#import"
            className="font-medium text-[var(--color-primary)] underline underline-offset-2 hover:text-[var(--color-primary)]/80 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1"
          >
            →
          </a>
        </p>
      </section>

      {/* ── Comparison Table ───────────────────────────────── */}
      <section
        aria-labelledby="cz-comparison-heading"
        className="mx-auto max-w-4xl px-6 pb-16"
      >
        <h2
          id="cz-comparison-heading"
          className="mb-8 text-center text-2xl font-bold tracking-tight text-[var(--color-ink)]"
        >
          How CareSync compares to CareZone
        </h2>

        <div className="overflow-x-auto rounded-2xl border border-[var(--color-border)] shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-primary-subtle)]">
                <th
                  scope="col"
                  className="px-5 py-4 text-left font-semibold text-[var(--color-ink)]"
                >
                  Feature
                </th>
                <th
                  scope="col"
                  className="px-5 py-4 text-center font-semibold text-[var(--color-ink)]"
                >
                  CareZone
                  <span className="block text-xs font-normal text-[var(--color-muted)]">
                    (shut down 2024)
                  </span>
                </th>
                <th
                  scope="col"
                  className="px-5 py-4 text-center font-semibold text-[var(--color-primary)]"
                >
                  CareSync
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, i) => (
                <tr
                  key={row.feature}
                  className={
                    i % 2 === 0 ? "bg-card" : "bg-[var(--color-surface)]"
                  }
                >
                  <td className="px-5 py-3 font-medium text-[var(--color-ink)]">
                    {row.feature}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <CellIcon value={row.careZone} />
                  </td>
                  <td className="px-5 py-3 text-center">
                    <CellIcon value={row.carelog} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Migration Callout ──────────────────────────────── */}
      <section
        aria-labelledby="cz-migrate-heading"
        className="mx-auto max-w-2xl px-6 pb-16"
      >
        <div
          id="import"
          className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-primary-subtle)] p-6"
        >
          <h2
            id="cz-migrate-heading"
            className="text-xl font-bold text-[var(--color-ink)]"
          >
            Your CareZone medications aren&apos;t lost
          </h2>
          <p className="mt-2 text-[var(--color-text-secondary)]">
            Paste your medication list below and we&apos;ll show you what
            CareSync will import when you sign up.
          </p>
        </div>
      </section>
    </>
  );
}
