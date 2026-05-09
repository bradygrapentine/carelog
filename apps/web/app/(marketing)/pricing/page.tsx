import Link from "next/link";
import type { Metadata } from "next";
import { PricingCards } from "../../../components/marketing/PricingCards";

const BASE_URL = "https://care-log.org";

// SEO-001: anchor on the price + the "covers the whole family" angle —
// "$14/mo" is the literal search query for pricing-shoppers. ≤60 chars.
const TITLE = "CareSync Pricing — $14/mo for Your Whole Care Team";
const DESCRIPTION =
  "One family plan covers every member of your care team — coordinators, caregivers, aides, and family supporters. $14/mo, no per-seat charges, cancel anytime.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${BASE_URL}/pricing` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${BASE_URL}/pricing`,
    siteName: "CareSync",
    images: [
      {
        url: `${BASE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: TITLE,
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [`${BASE_URL}/og-image.png`],
  },
};

// SEO-002: pricing FAQ — three real questions families ask before
// subscribing. Visible content + FAQPage JSON-LD so Google can surface
// these as rich-result answers.
const PRICING_FAQ = [
  {
    q: "How much does CareSync cost?",
    a: "$14 per month for the whole family — coordinators, caregivers, aides, and family supporters all included. No per-seat fees, no add-ons.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from the Subscriptions page in your account at any time — no phone call required, and your data stays accessible during the wind-down.",
  },
  {
    q: "Is there a free trial?",
    a: "Yes — start free with no credit card required. Upgrade when you're ready, and only when you're convinced CareSync earns the $14.",
  },
] as const;

const pricingFaqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: PRICING_FAQ.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
};

export default function PricingPage() {
  return (
    <div className="py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingFaqJsonLd) }}
      />
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

      <section
        aria-labelledby="pricing-faq-heading"
        className="mx-auto mt-20 max-w-2xl px-6"
      >
        <h2
          id="pricing-faq-heading"
          className="mb-8 text-center text-2xl font-bold text-[var(--color-ink)]"
        >
          Pricing FAQ
        </h2>
        <dl className="space-y-6">
          {PRICING_FAQ.map(({ q, a }) => (
            <div key={q}>
              <dt className="text-base font-semibold text-[var(--color-ink)]">
                {q}
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {a}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
