import Link from "next/link";
import type { Metadata } from "next";
import { PricingCards } from "../../../components/marketing/PricingCards";

const BASE_URL = "https://care-log.org";

export const metadata: Metadata = {
  title: "Pricing — CareSync",
  description:
    "Simple pricing for families. $14/mo covers everyone on your care team.",
  alternates: { canonical: `${BASE_URL}/pricing` },
  openGraph: {
    title: "Pricing — CareSync",
    description:
      "Simple pricing for families. $14/mo covers everyone on your care team.",
    url: `${BASE_URL}/pricing`,
    siteName: "CareSync",
    images: [
      {
        url: `${BASE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "CareSync Pricing",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing — CareSync",
    description:
      "Simple pricing for families. $14/mo covers everyone on your care team.",
    images: [`${BASE_URL}/og-image.png`],
  },
};

export default function PricingPage() {
  return (
    <div className="py-20">
      <div className="mx-auto mb-12 max-w-2xl px-6 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">
          Pricing
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-[var(--color-ink)]">
          Simple pricing for the whole family
        </h1>
        <p className="mt-4 text-[var(--color-muted)]">
          One family plan covers every member of your care team — coordinators,
          caregivers, aides, and family supporters.
        </p>
      </div>
      <PricingCards />
      <div className="mt-12 text-center text-sm text-[var(--color-muted)]">
        Comparing alternatives?{" "}
        <Link
          href="/about#compare"
          className="font-medium text-[var(--color-primary)] underline underline-offset-4 hover:text-[var(--color-primary)]/80 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 rounded-sm"
        >
          See how CareSync measures up &rarr;
        </Link>
      </div>
    </div>
  );
}
