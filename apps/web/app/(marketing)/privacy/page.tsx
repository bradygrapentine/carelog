import type { Metadata } from "next";
import { LegalPageLayout } from "../../../components/marketing/LegalPageLayout";

export const metadata: Metadata = {
  title: "Privacy Policy — Carelog",
};

const SECTIONS = [
  { id: "information",  title: "Information we collect" },
  { id: "use",          title: "How we use it" },
  { id: "sharing",      title: "Sharing" },
  { id: "security",     title: "Security" },
  { id: "contact",      title: "Contact" },
];

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="April 10, 2026" sections={SECTIONS}>
      <h2 id="information">Information we collect</h2>
      <p>
        We collect the email address you use to sign in, and the care information
        your team logs in Carelog (journal entries, medications, shifts, documents).
        We do not collect payment information directly — billing is handled by Stripe.
      </p>

      <h2 id="use">How we use your information</h2>
      <p>
        We use your information to operate Carelog: to authenticate you, to deliver
        the weekly digest email, and to provide support when you contact us. We do
        not use your information for advertising.
      </p>

      <h2 id="sharing">Sharing</h2>
      <p>
        We do not sell your information. We share data with service providers
        (Supabase for database hosting, Resend for email, Stripe for billing) only
        to the extent necessary to operate the service.
      </p>

      <h2 id="security">Security</h2>
      <p>
        All data is encrypted in transit (TLS) and at rest. Access is limited to
        members of your care team. Row-level security in the database ensures
        one family&#39;s data cannot be accessed by another family&#39;s account.
      </p>

      <h2 id="contact">Contact</h2>
      <p>
        Questions about privacy? Email{" "}
        <a href="mailto:privacy@carelog.app" className="text-[var(--color-primary)]">
          privacy@carelog.app
        </a>
        .
      </p>
    </LegalPageLayout>
  );
}
