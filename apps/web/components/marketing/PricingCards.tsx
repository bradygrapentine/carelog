"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const FREE_FEATURES = ["1 caregiver account", "Care journal", "7-day history"];

const FAMILY_FEATURES = [
  "Unlimited team members",
  "Full care journal + reactions",
  "Medications & shifts",
  "Documents vault",
  "Weekly email digest",
  "Unlimited history",
];

export function PricingCards() {
  const router = useRouter();
  const [interval, setInterval] = useState<"month" | "year">("month");

  function handleSubscribe() {
    sessionStorage.setItem(
      "pendingPlan",
      JSON.stringify({ plan: "family", interval }),
    );
    router.push("/signin");
  }

  return (
    <div>
      {/* Toggle */}
      <div className="mx-auto mb-10 flex items-center justify-center gap-3">
        <button
          onClick={() => setInterval("month")}
          className={
            "rounded-lg px-4 py-2 text-sm font-semibold transition-colors " +
            (interval === "month"
              ? "bg-[var(--color-primary)] text-white"
              : "text-[var(--color-muted)] hover:text-[var(--color-ink)]")
          }
        >
          Monthly
        </button>
        <button
          onClick={() => setInterval("year")}
          className={
            "rounded-lg px-4 py-2 text-sm font-semibold transition-colors " +
            (interval === "year"
              ? "bg-[var(--color-primary)] text-white"
              : "text-[var(--color-muted)] hover:text-[var(--color-ink)]")
          }
        >
          Annual
          <span className="ml-1.5 rounded-full bg-[var(--color-primary-subtle)] px-2 py-0.5 text-xs font-bold text-[var(--color-primary)]">
            Save 29%
          </span>
        </button>
      </div>

      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 md:flex-row">
        {/* Free tier */}
        <div className="flex flex-1 flex-col rounded-2xl border border-[var(--color-muted)] bg-card p-8">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-[var(--color-ink)]">Free</h2>
            <div className="mt-2 flex items-end gap-1">
              <span className="text-4xl font-extrabold text-[var(--color-muted)]">
                $0
              </span>
              <span className="mb-1 text-sm text-[var(--color-muted)]">
                /mo
              </span>
            </div>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Get started, no commitment.
            </p>
          </div>
          <ul className="mb-8 flex flex-col gap-3" role="list">
            {FREE_FEATURES.map((f) => (
              <li
                key={f}
                className="flex items-center gap-2 text-sm text-[var(--color-muted)]"
              >
                <span
                  className="text-[var(--color-success)]"
                  aria-hidden="true"
                >
                  ✓
                </span>
                {f}
              </li>
            ))}
          </ul>
          <a
            href="/signin"
            className="mt-auto inline-flex items-center justify-center rounded-xl border-2 border-[var(--color-muted)] px-6 py-3 text-sm font-semibold text-[var(--color-muted)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
          >
            Get started
          </a>
        </div>

        {/* Family Plan */}
        <div className="relative flex flex-1 flex-col rounded-2xl border-2 border-[var(--color-primary)] bg-card p-8">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-primary)] px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
            Most popular
          </span>
          <div className="mb-6">
            <h2 className="text-lg font-bold text-[var(--color-ink)]">
              Family Plan
            </h2>
            <div className="mt-2 flex items-end gap-1">
              <span className="text-4xl font-extrabold text-[var(--color-primary)]">
                {interval === "month" ? "$14" : "$120"}
              </span>
              <span className="mb-1 text-sm text-[var(--color-muted)]">
                {interval === "month" ? "/mo" : "/yr"}
              </span>
            </div>
            {interval === "year" && (
              <p className="mt-1 text-sm font-medium text-[var(--color-success)]">
                $10/mo — save $48/yr
              </p>
            )}
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Everything for the whole family team.
            </p>
          </div>
          <ul className="mb-8 flex flex-col gap-3" role="list">
            {FAMILY_FEATURES.map((f) => (
              <li
                key={f}
                className="flex items-center gap-2 text-sm text-[var(--color-ink)]"
              >
                <span
                  className="text-[var(--color-success)]"
                  aria-hidden="true"
                >
                  ✓
                </span>
                {f}
              </li>
            ))}
          </ul>
          <button
            onClick={handleSubscribe}
            className="mt-auto inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]/90 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
          >
            Subscribe
          </button>
        </div>
      </div>
    </div>
  );
}
