import type { Metadata } from "next";
import { ContactForm } from "../../../components/marketing/ContactForm";

export const metadata: Metadata = {
  title: "Contact — Carelog",
  description: "Get in touch. We reply within 24 hours.",
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

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-20">
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
                  className="rounded-2xl border border-[var(--color-border)] bg-white p-5"
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
                href="mailto:hello@carelog.app"
                className="text-[var(--color-primary)] underline underline-offset-2"
              >
                hello@carelog.app
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
