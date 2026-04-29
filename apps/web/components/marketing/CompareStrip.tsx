import Link from "next/link";
import { Check, X, Minus } from "lucide-react";

type StripRow = {
  feature: string;
  caresync: string;
  caringbridge: string;
  lotsa: string;
  carebridgeSymbol: "cross" | "partial";
  lotsaSymbol: "cross" | "partial";
};

const STRIP_ROWS: StripRow[] = [
  {
    feature: "Medication tracking",
    caresync: "Full schedule + reminders",
    caringbridge: "Not available",
    lotsa: "Not available",
    carebridgeSymbol: "cross",
    lotsaSymbol: "cross",
  },
  {
    feature: "Caregiver shift schedule",
    caresync: "Built-in shift handoffs",
    caringbridge: "Not available",
    lotsa: "Calendar only",
    carebridgeSymbol: "cross",
    lotsaSymbol: "partial",
  },
  {
    feature: "Roles: caregiver, aide, family",
    caresync: "Full role-based access",
    caringbridge: "Not available",
    lotsa: "Volunteers only",
    carebridgeSymbol: "cross",
    lotsaSymbol: "partial",
  },
];

function CompetitorCell({
  label,
  value,
  symbol,
}: {
  label: string;
  value: string;
  symbol: "cross" | "partial";
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-[var(--color-surface)] px-4 py-3 border border-[var(--color-border)]">
      <span className="text-xs font-medium text-[var(--color-muted)] tracking-wide">
        {label}
      </span>
      <span className="flex items-center gap-1.5 text-sm text-[var(--color-muted)]">
        {symbol === "cross" ? (
          <X
            className="h-3.5 w-3.5 shrink-0 text-[var(--color-danger)]"
            aria-hidden="true"
          />
        ) : (
          <Minus
            className="h-3.5 w-3.5 shrink-0 text-[var(--color-secondary)]"
            aria-hidden="true"
          />
        )}
        {value}
      </span>
    </div>
  );
}

export function CompareStrip() {
  return (
    <section
      aria-labelledby="compare-strip-heading"
      className="mx-auto max-w-6xl px-6 py-16"
    >
      {/* Eyebrow + heading */}
      <div className="mb-10">
        <p className="eyebrow-mono mb-2">WHY CARESYNC</p>
        <h2
          id="compare-strip-heading"
          className="text-2xl font-semibold tracking-tight text-[var(--color-ink)] max-w-lg"
        >
          The things group texts and generic care portals can&rsquo;t do.
        </h2>
      </div>

      {/* Strip rows */}
      <div className="space-y-4">
        {STRIP_ROWS.map((row) => (
          <div
            key={row.feature}
            className="grid grid-cols-1 gap-2 md:grid-cols-3 md:gap-3"
          >
            {/* CareSync cell — violet tint, spans full width on mobile */}
            <div className="rounded-xl bg-[var(--color-primary-subtle)] px-4 py-3 border border-[var(--color-border)] md:col-span-1">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                CareSync
              </p>
              <p className="text-xs font-medium text-[var(--color-muted)] mb-1">
                {row.feature}
              </p>
              <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-ink)]">
                <Check
                  className="h-3.5 w-3.5 shrink-0 text-[var(--color-success)]"
                  aria-hidden="true"
                />
                {row.caresync}
              </span>
            </div>

            {/* Competitor cells — stacked on mobile, side-by-side on md+ */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:col-span-2 md:grid-cols-2 md:gap-3">
              <CompetitorCell
                label="CaringBridge"
                value={row.caringbridge}
                symbol={row.carebridgeSymbol}
              />
              <CompetitorCell
                label="Lotsa Helping Hands"
                value={row.lotsa}
                symbol={row.lotsaSymbol}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Trailing CTA */}
      <div className="mt-8">
        <Link
          href="/about#compare"
          className="text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary)]/80 underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 rounded-sm"
        >
          See the full comparison &rarr;
        </Link>
      </div>
    </section>
  );
}
