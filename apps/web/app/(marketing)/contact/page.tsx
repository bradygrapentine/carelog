import type { Metadata } from "next";
import { ContactForm } from "../../../components/marketing/ContactForm";

const BASE_URL = "https://care-log.org";

// SEO-001: lead with the action verb + the brand. ≤60 chars.
const TITLE = "Contact CareSync — Caregiver Support, 24-hour Reply";
const DESCRIPTION =
  "Reach the CareSync team directly. We answer questions about caregiving coordination, pricing, and your family's data within 24 hours.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${BASE_URL}/contact` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${BASE_URL}/contact`,
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

const FAQ = [
  {
    q: "Is my family's data private?",
    a: "Yes. Your data is never sold, never shown to advertisers, and is accessible only to the people you invite.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from the Subscriptions page in your account — no phone call required.",
  },
  {
    q: "Do you offer a free trial?",
    a: "Yes — start free with no credit card required. Upgrade when you're ready.",
  },
] as const;

// SEO-002: FAQPage JSON-LD. Wraps the same Q&A content rendered visibly
// below — Google requires the schema text to match what users see, so
// these stay in sync via the FAQ const above.
const contactFaqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactFaqJsonLd) }}
      />
      <div className="mb-12 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">
          Get in touch
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-[var(--color-ink)]">
          We&#39;d love to hear from you
        </h1>
      </div>

      <div className="grid gap-12 md:grid-cols-2">
        {/* Left — form */}
        <div>
          <h2 className="mb-6 text-lg font-semibold text-[var(--color-ink)]">
            Send us a message
          </h2>
          <ContactForm />
        </div>

        {/* Right — FAQ first, then contact details */}
        <div className="flex flex-col gap-8">
          <div>
            <h2 className="mb-4 text-lg font-semibold text-[var(--color-ink)]">
              Frequently asked
            </h2>
            <ul className="flex flex-col gap-4" role="list">
              {FAQ.map(({ q, a }) => (
                <li
                  key={q}
                  className="rounded-2xl border border-[var(--color-muted)] bg-card p-5"
                >
                  <p className="text-sm font-semibold text-[var(--color-ink)]">
                    {q}
                  </p>
                  <p className="mt-1.5 text-sm text-[var(--color-muted)]">
                    {a}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold text-[var(--color-ink)]">
              Contact details
            </h2>
            <p className="text-sm text-[var(--color-muted)]">
              Email:{" "}
              <a
                href="mailto:hello@care-log.org"
                className="text-[var(--color-primary)] underline underline-offset-2"
              >
                hello@care-log.org
              </a>
            </p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Response time: within 24 hours
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
