import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — CareSync",
  description: "CareSync — built by a caregiver, for caregivers.",
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
              className="rounded-2xl border border-[var(--color-border)] bg-white p-6"
            >
              <span className="text-2xl" aria-hidden="true">{icon}</span>
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
