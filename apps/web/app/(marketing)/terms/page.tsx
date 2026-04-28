import type { Metadata } from "next";
import { LegalPageLayout } from "../../../components/marketing/LegalPageLayout";

const BASE_URL = "https://care-log.org";

export const metadata: Metadata = {
  title: "Terms of Service — Carelog",
  description:
    "Carelog terms of service. Review the terms that govern your use of the platform.",
  alternates: { canonical: `${BASE_URL}/terms` },
  openGraph: {
    title: "Terms of Service — Carelog",
    description:
      "Carelog terms of service. Review the terms that govern your use of the platform.",
    url: `${BASE_URL}/terms`,
    siteName: "Carelog",
    images: [
      {
        url: `${BASE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Carelog Terms of Service",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Service — Carelog",
    description:
      "Carelog terms of service. Review the terms that govern your use of the platform.",
    images: [`${BASE_URL}/og-image.png`],
  },
};

const SECTIONS = [
  { id: "acceptance", title: "Acceptance" },
  { id: "service", title: "The service" },
  { id: "accounts", title: "Accounts" },
  { id: "payment", title: "Payment" },
  { id: "termination", title: "Termination" },
  { id: "liability", title: "Limitation of liability" },
];

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      lastUpdated="April 10, 2026"
      sections={SECTIONS}
    >
      <h2 id="acceptance">Acceptance</h2>
      <p>
        By using CareSync you agree to these terms. If you do not agree, do not
        use the service.
      </p>

      <h2 id="service">The service</h2>
      <p>
        CareSync is a care coordination tool for families. We provide it as-is
        and may update features over time. We are not a medical provider and
        CareSync is not a substitute for professional medical advice.
      </p>

      <h2 id="accounts">Accounts</h2>
      <p>
        You are responsible for maintaining the security of your account. Notify
        us immediately at{" "}
        <a
          href="mailto:hello@care-log.org"
          className="text-[var(--color-primary)]"
        >
          hello@care-log.org
        </a>{" "}
        if you suspect unauthorized access.
      </p>

      <h2 id="payment">Payment</h2>
      <p>
        The Family Plan is billed monthly at $14/mo. You may cancel at any time
        from the Subscriptions page. Cancellation takes effect at the end of the
        current billing period. We do not offer partial refunds.
      </p>

      <h2 id="termination">Termination</h2>
      <p>
        We may suspend or terminate accounts that violate these terms. You may
        delete your account at any time from the Team Admin page. Your data is
        retained for 30 days after deletion before permanent removal.
      </p>

      <h2 id="liability">Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, CareSync is not liable for
        indirect, incidental, or consequential damages arising from your use of
        the service. Our total liability is limited to the amount you paid us in
        the 12 months before the claim.
      </p>
    </LegalPageLayout>
  );
}
