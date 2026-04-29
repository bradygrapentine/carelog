import Link from "next/link";
import type { Metadata } from "next";
import { Check, X } from "lucide-react";
import { CompareTable } from "../../../components/marketing/CompareTable";
import { CareZoneMedicationImport } from "../../../components/marketing/CareZoneMedicationImport";

const BASE_URL = "https://care-log.org";

export const metadata: Metadata = {
  title: "About — CareSync",
  description:
    "CareSync — built by a caregiver, for caregivers. How we compare to CaringBridge, Lotsa Helping Hands, and CareZone.",
  alternates: { canonical: `${BASE_URL}/about` },
  openGraph: {
    title: "About — CareSync",
    description:
      "CareSync — built by a caregiver, for caregivers. How we compare to CaringBridge, Lotsa Helping Hands, and CareZone.",
    url: `${BASE_URL}/about`,
    siteName: "CareSync",
    images: [
      {
        url: `${BASE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "About CareSync",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "About — CareSync",
    description:
      "CareSync — built by a caregiver, for caregivers. How we compare to CaringBridge, Lotsa Helping Hands, and CareZone.",
    images: [`${BASE_URL}/og-image.png`],
  },
};

const VALUES = [
  {
    icon: "🔒",
    title: "Privacy-first",
    description:
      "Your family's health data is never sold, never shown to advertisers, and never leaves your care team.",
  },
  {
    icon: "💜",
    title: "Family-centered",
    description:
      "Every feature is designed around the reality of coordinating care across family members, aides, and professionals.",
  },
  {
    icon: "🌱",
    title: "Bootstrapped & independent",
    description:
      "No VC funding, no growth-at-all-costs pressure. We grow sustainably because we care about longevity.",
  },
] as const;

const PICK_CARDS: ReadonlyArray<{
  product: string;
  description: string;
  colorClass: string;
  labelClass: string;
  cta?: boolean;
}> = [
  {
    product: "CaringBridge",
    description:
      "Pick CaringBridge if you only need to broadcast health updates to a wide circle of friends and family.",
    colorClass: "bg-[var(--color-surface)] border-[var(--color-border)]",
    labelClass: "text-[var(--color-muted)]",
  },
  {
    product: "Lotsa Helping Hands",
    description:
      "Pick Lotsa Helping Hands if your need is short-term meal-train or ride sign-ups around a single event.",
    colorClass: "bg-[var(--color-surface)] border-[var(--color-border)]",
    labelClass: "text-[var(--color-muted)]",
  },
  {
    product: "CareSync",
    description:
      "Pick CareSync if you're managing the day-to-day across medications, shifts, journal, and a multi-role care team.",
    colorClass:
      "bg-[var(--color-primary-subtle)] border-[var(--color-primary)]/30",
    labelClass: "text-[var(--color-primary)]",
    cta: true,
  },
];

type CareZoneRow = {
  feature: string;
  careZone: boolean | string;
  carelog: boolean | string;
};

const CAREZONE_ROWS: CareZoneRow[] = [
  { feature: "Medication catalog", careZone: true, carelog: true },
  { feature: "Prescription label scanning", careZone: false, carelog: true },
  { feature: "Refill alerts", careZone: true, carelog: true },
  { feature: "Care journal", careZone: true, carelog: true },
  { feature: "Shared with full family", careZone: true, carelog: true },
  { feature: "Professional aide coordination", careZone: false, carelog: true },
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

function CareZoneCellIcon({ value }: { value: boolean | string }) {
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

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-20">
      {/* Hero */}
      <div className="mb-16 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">
          Our story
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-[var(--color-ink)] md:text-5xl">
          Built by a caregiver,
          <br />
          for caregivers
        </h1>
      </div>

      {/* Origin story */}
      <div className="mb-16 rounded-3xl bg-[var(--color-primary-subtle)] p-10">
        <p className="text-lg leading-relaxed text-[var(--color-ink)]">
          CareSync started because coordinating care for a family member meant
          endless group texts, lost medication lists, and no shared memory of
          what happened during the night shift. We built the tool we wished
          existed — simple enough for the whole family, structured enough for
          the professionals on the team.
        </p>
      </div>

      {/* Values */}
      <div className="mb-16">
        <h2 className="mb-8 text-2xl font-bold text-[var(--color-ink)]">
          What we believe
        </h2>
        <ul className="grid gap-6 sm:grid-cols-3" role="list">
          {VALUES.map(({ icon, title, description }) => (
            <li
              key={title}
              className="rounded-2xl border border-[var(--color-border)] bg-card p-6"
            >
              <span className="text-2xl" aria-hidden="true">
                {icon}
              </span>
              <h3 className="mt-3 text-base font-semibold text-[var(--color-ink)]">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
                {description}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {/* How CareSync compares */}
      <section
        id="compare"
        aria-labelledby="compare-heading"
        className="mb-16 scroll-mt-20"
      >
        <h2
          id="compare-heading"
          className="mb-3 text-2xl font-bold text-[var(--color-ink)]"
        >
          How CareSync compares
        </h2>
        <p className="mb-8 text-[var(--color-muted)]">
          Most caregiving tools are built for broadcasting updates or rallying
          volunteers. CareSync is built for the people doing the daily work.
        </p>
        <CompareTable />

        {/* Pick ___ if… cards */}
        <div className="mt-12">
          <h3 className="mb-6 text-center text-lg font-bold text-[var(--color-ink)]">
            Find your fit
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {PICK_CARDS.map(
              ({ product, description, colorClass, labelClass, cta }) => (
                <div
                  key={product}
                  className={`rounded-2xl border p-6 ${colorClass}`}
                >
                  <p
                    className={`mb-2 text-xs font-semibold uppercase tracking-wider ${labelClass}`}
                  >
                    Pick {product} if…
                  </p>
                  <p className="text-sm leading-relaxed text-[var(--color-ink)]">
                    {description}
                  </p>
                  {cta && (
                    <Link
                      href="/signin"
                      className="mt-4 inline-block rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]/90 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
                    >
                      Get started free
                    </Link>
                  )}
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      {/* For CareZone users */}
      <section
        id="carezone"
        aria-labelledby="carezone-heading"
        className="mb-16 scroll-mt-20"
      >
        <div className="mb-8 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">
            For CareZone users
          </p>
          <h2
            id="carezone-heading"
            className="text-2xl font-bold tracking-tight text-[var(--color-ink)]"
          >
            CareZone shut down. Your data deserves a new home.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[var(--color-text-secondary)]">
            CareZone helped families manage medications. CareSync goes further —
            coordinating your full team of family caregivers, professional
            aides, and supporters.
          </p>
        </div>

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
              {CAREZONE_ROWS.map((row, i) => (
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
                    <CareZoneCellIcon value={row.careZone} />
                  </td>
                  <td className="px-5 py-3 text-center">
                    <CareZoneCellIcon value={row.carelog} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8">
          <CareZoneMedicationImport />
        </div>
      </section>

      {/* CTA */}
      <div className="text-center">
        <Link
          href="/signin"
          className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-[var(--color-app-shell-text)] transition-colors hover:bg-[var(--color-primary)]/90 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
        >
          Start your family&rsquo;s log
        </Link>
      </div>
    </div>
  );
}
