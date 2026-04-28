"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Pill, BookOpen, Users, CalendarDays, Copy, Check } from "lucide-react";

const SIGNUP_URL = "https://yourcarelog.com/signup";

const features = [
  {
    icon: Pill,
    title: "Medication tracking and refill alerts",
    description:
      "Families track every medication, dosage, and schedule in one place — with alerts before refills run out.",
  },
  {
    icon: BookOpen,
    title: "Shared care journal",
    description:
      "The whole care team logs daily observations, moods, and incidents. No more piecing together the picture from scattered texts.",
  },
  {
    icon: Users,
    title: "Professional aide coordination",
    description:
      "Shift scheduling and handoff notes for paid caregivers and family volunteers — all in the same app.",
  },
  {
    icon: CalendarDays,
    title: "Weekly digest",
    description:
      "A summary of the past week delivered to every team member — so no one is left out of the loop.",
  },
];

const steps = [
  {
    number: "1",
    title: "Share the link",
    detail: SIGNUP_URL,
  },
  {
    number: "2",
    title: "Family creates an account",
    detail: "Free to start — no credit card required.",
  },
  {
    number: "3",
    title: "They start logging care the same day",
    detail: "Onboarding takes minutes. The team can be set up in under an hour.",
  },
];

function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(SIGNUP_URL);
    } catch {
      // Fallback for environments where clipboard API is unavailable
      const ta = document.createElement("textarea");
      ta.value = SIGNUP_URL;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy signup link to clipboard"
      className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[var(--color-primary)]/90 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 min-h-[44px]"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4" aria-hidden="true" />
          Copied!
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" aria-hidden="true" />
          Copy link
        </>
      )}
    </button>
  );
}

export function ForReferrersPage() {
  return (
    <>
      {/* ── Hero ──────────────────────────────────────────────── */}
      <section
        aria-labelledby="referrers-hero-heading"
        className="relative mx-auto max-w-4xl px-6 pb-16 text-center"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
          <div className="absolute -top-16 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[var(--color-primary-subtle)] opacity-60 blur-3xl" />
        </div>

        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">
          For professionals
        </p>
        <h1
          id="referrers-hero-heading"
          className="text-4xl font-extrabold leading-tight tracking-tight text-[var(--color-ink)] md:text-5xl"
        >
          The family caregiving platform you can recommend with confidence
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-[var(--color-text-secondary)]">
          CareSync helps families coordinate care for aging parents and loved
          ones. When a family you work with is juggling medications, aide
          schedules, and a scattered care team — CareSync brings it all together.
        </p>
      </section>

      {/* ── Who it's for ──────────────────────────────────────── */}
      <section
        aria-labelledby="referrers-audience-heading"
        className="mx-auto max-w-4xl px-6 pb-16"
      >
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-primary-subtle)] px-6 py-5 text-center">
          <h2
            id="referrers-audience-heading"
            className="sr-only"
          >
            Who this page is for
          </h2>
          <p className="text-base font-medium text-[var(--color-ink)]">
            You&apos;re in the right place if you&apos;re a{" "}
            <span className="text-[var(--color-primary)]">social worker</span>
            {", "}
            <span className="text-[var(--color-primary)]">
              hospital discharge planner
            </span>
            {", "}
            <span className="text-[var(--color-primary)]">
              elder law attorney
            </span>
            {", or "}
            <span className="text-[var(--color-primary)]">
              geriatric care manager
            </span>
            {"."}
          </p>
        </div>
      </section>

      {/* ── What families get ─────────────────────────────────── */}
      <section
        aria-labelledby="referrers-features-heading"
        className="mx-auto max-w-4xl px-6 pb-16"
      >
        <h2
          id="referrers-features-heading"
          className="mb-8 text-center text-2xl font-bold tracking-tight text-[var(--color-ink)]"
        >
          What families get
        </h2>
        <ul
          className="grid gap-4 sm:grid-cols-2"
          role="list"
        >
          {features.map(({ icon: Icon, title, description }) => (
            <li
              key={title}
              className="rounded-2xl border border-[var(--color-border)] bg-card p-5 shadow-sm"
            >
              <div className="mb-3 flex items-center gap-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-subtle)]"
                  aria-hidden="true"
                >
                  <Icon className="h-5 w-5 text-[var(--color-primary)]" />
                </span>
                <h3 className="text-sm font-semibold text-[var(--color-ink)]">
                  {title}
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {description}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── How to refer ──────────────────────────────────────── */}
      <section
        aria-labelledby="referrers-steps-heading"
        className="mx-auto max-w-4xl px-6 pb-16"
      >
        <h2
          id="referrers-steps-heading"
          className="mb-8 text-center text-2xl font-bold tracking-tight text-[var(--color-ink)]"
        >
          How to refer a family
        </h2>

        <ol className="mb-8 space-y-4" role="list">
          {steps.map(({ number, title, detail }) => (
            <li
              key={number}
              className="flex items-start gap-4 rounded-2xl border border-[var(--color-border)] bg-card p-5 shadow-sm"
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-white"
                aria-label={`Step ${number}`}
              >
                {number}
              </span>
              <div>
                <p className="font-semibold text-[var(--color-ink)]">{title}</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  {detail}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <code className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm font-mono text-[var(--color-ink)] break-all">
            {SIGNUP_URL}
          </code>
          <CopyLinkButton />
        </div>
      </section>

      {/* ── Trust signals ─────────────────────────────────────── */}
      <section
        aria-labelledby="referrers-trust-heading"
        className="mx-auto max-w-4xl px-6 pb-16"
      >
        <div className="rounded-2xl border border-[var(--color-border)] bg-card p-6 text-center shadow-sm">
          <h2
            id="referrers-trust-heading"
            className="mb-2 text-lg font-bold text-[var(--color-ink)]"
          >
            Built for families who take care seriously
          </h2>
          <p className="text-[var(--color-text-secondary)]">
            No ads. No data selling. Full data export always available.{" "}
            <Link
              href="/trust"
              className="font-medium text-[var(--color-primary)] underline underline-offset-2 hover:text-[var(--color-primary)]/80 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1"
            >
              Learn more about our privacy commitments
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────── */}
      <section
        aria-labelledby="referrers-cta-heading"
        className="mx-auto max-w-4xl px-6 pb-20 text-center"
      >
        <h2
          id="referrers-cta-heading"
          className="mb-2 text-lg font-bold text-[var(--color-ink)]"
        >
          Questions?
        </h2>
        <p className="text-[var(--color-text-secondary)]">
          Contact us at{" "}
          <a
            href="mailto:hello@care-log.org"
            className="font-medium text-[var(--color-primary)] underline underline-offset-2 hover:text-[var(--color-primary)]/80 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1"
          >
            hello@care-log.org
          </a>
        </p>
      </section>
    </>
  );
}
