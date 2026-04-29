import type { Metadata } from "next";
import Link from "next/link";
import { CompareTable } from "../../../components/marketing/CompareTable";

const BASE_URL = "https://carelog.app";

export const metadata: Metadata = {
  title:
    "CareSync vs CaringBridge vs Lotsa Helping Hands — Family Caregiving Compared",
  description:
    "Side-by-side comparison of CareSync, CaringBridge, and Lotsa Helping Hands. Find the right tool for your family's caregiving situation.",
  alternates: { canonical: `${BASE_URL}/compare` },
  openGraph: {
    title:
      "CareSync vs CaringBridge vs Lotsa Helping Hands — Family Caregiving Compared",
    description:
      "Side-by-side comparison of CareSync, CaringBridge, and Lotsa Helping Hands. Find the right tool for your family's caregiving situation.",
    url: `${BASE_URL}/compare`,
    siteName: "CareSync",
    images: [
      {
        url: `${BASE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "CareSync vs CaringBridge vs Lotsa Helping Hands",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title:
      "CareSync vs CaringBridge vs Lotsa Helping Hands — Family Caregiving Compared",
    description:
      "Side-by-side comparison of CareSync, CaringBridge, and Lotsa Helping Hands. Find the right tool for your family's caregiving situation.",
    images: [`${BASE_URL}/og-image.png`],
  },
};

const pickCards = [
  {
    product: "CaringBridge",
    description:
      "Pick CaringBridge if you only need to broadcast health updates to a wide circle of friends and family.",
    colorClass:
      "bg-[var(--color-surface)] border-[var(--color-border)]",
    labelClass: "text-[var(--color-muted)]",
  },
  {
    product: "Lotsa Helping Hands",
    description:
      "Pick Lotsa Helping Hands if your need is short-term meal-train or ride sign-ups around a single event.",
    colorClass:
      "bg-[var(--color-surface)] border-[var(--color-border)]",
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

export default function ComparePage() {
  return (
    <div className="py-20">
      {/* Header */}
      <div className="mx-auto mb-12 max-w-2xl px-6 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">
          Compare
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-[var(--color-ink)]">
          CareSync vs. CaringBridge vs. Lotsa Helping Hands
        </h1>
        <p className="mt-4 text-[var(--color-muted)]">
          Which one fits your family?
        </p>
      </div>

      {/* Comparison table */}
      <CompareTable />

      {/* Pick ___ if… cards */}
      <div className="mx-auto mt-16 max-w-5xl px-4 lg:px-8">
        <h2 className="mb-8 text-center text-xl font-bold text-[var(--color-ink)]">
          Find your fit
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {pickCards.map(({ product, description, colorClass, labelClass, cta }) => (
            <div
              key={product}
              className={`rounded-2xl border p-6 ${colorClass}`}
            >
              <p className={`mb-2 text-xs font-semibold uppercase tracking-wider ${labelClass}`}>
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
          ))}
        </div>
      </div>
    </div>
  );
}
