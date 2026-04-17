import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Commitment — CareSync",
  description:
    "Our data stewardship commitment. Your family's health data is protected.",
};

const COMMITMENTS = [
  {
    title: "12 months notice",
    description:
      "If this platform ever shuts down, we will give families 12 months notice before any shutdown.",
  },
  {
    title: "Full data export",
    description:
      "A complete export of your family's data will always be available, with no fees or barriers.",
  },
  {
    title: "Never sold",
    description:
      "Your data will never be sold to third parties, advertisers, or data brokers under any circumstance.",
  },
  {
    title: "Ad-free always",
    description:
      "We will never run ads in this product. Ever. Your family's focus stays on care, not marketing.",
  },
] as const;

export default function TrustPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-20">
      {/* Hero */}
      <div className="mb-16 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">
          Data stewardship
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-[var(--color-ink)] md:text-5xl">
          We protect your
          <br />
          family's data
        </h1>
      </div>

      {/* Trust context */}
      <div className="mb-16 rounded-3xl bg-[var(--color-primary-subtle)] p-10">
        <p className="text-lg leading-relaxed text-[var(--color-ink)]">
          Families have been hurt before. When CareZone shut down, families lost
          years of health records with little warning. That won't happen here.
          We're bootstrapped, independent, and built to last. Your trust in us
          comes with concrete commitments.
        </p>
      </div>

      {/* Commitments */}
      <div className="mb-16">
        <h2 className="mb-8 text-2xl font-bold text-[var(--color-ink)]">
          Our commitment to you
        </h2>
        <ul className="grid gap-6 sm:grid-cols-2" role="list">
          {COMMITMENTS.map(({ title, description }) => (
            <li
              key={title}
              className="rounded-2xl border border-[var(--color-border)] bg-white p-6"
            >
              <h3 className="text-base font-semibold text-[var(--color-ink)]">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
                {description}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {/* Closing */}
      <div className="mb-8 text-center">
        <p className="text-sm text-[var(--color-muted)]">
          Have questions about how we handle your data?{" "}
          <Link
            href="/contact"
            className="text-[var(--color-primary)] underline underline-offset-2 transition-colors hover:text-[var(--color-primary)]/80"
          >
            Get in touch
          </Link>
        </p>
      </div>

      {/* CTA */}
      <div className="text-center">
        <Link
          href="/signin"
          className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]/90 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
        >
          Start free trial
        </Link>
      </div>
    </div>
  );
}
