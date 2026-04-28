"use client";

import { useState } from "react";
import { toast } from "sonner";
import posthog from "posthog-js";

const PLAN_FEATURES = [
  "Unlimited team members",
  "Full care journal + reactions + flagging",
  "Medications & shifts",
  "Documents vault",
  "Weekly email digest",
  "Unlimited history",
] as const;

const BILLING_HISTORY: Array<{
  date: string;
  amount: string;
  status: "paid" | "pending";
}> = [];

export default function SubscriptionsPage() {
  const [showCancelModal, setShowCancelModal] = useState(false);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-bold text-[var(--color-ink)]">
        Subscription
      </h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Manage your plan and billing.
      </p>

      {/* Current plan card */}
      <section className="mt-8 rounded-2xl border-2 border-[var(--color-primary)] bg-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-ink)]">
              Family Plan
            </h2>
            <p className="mt-1 text-3xl font-extrabold text-[var(--color-primary)]">
              $14
              <span className="text-sm font-normal text-[var(--color-muted)]">
                /mo
              </span>
            </p>
          </div>
          <span className="rounded-full bg-[var(--color-primary-subtle)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
            Active
          </span>
        </div>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Next renewal: —
        </p>

        <ul className="mt-4 flex flex-col gap-2" role="list">
          {PLAN_FEATURES.map((f) => (
            <li
              key={f}
              className="flex items-center gap-2 text-sm text-[var(--color-muted)]"
            >
              <span className="text-[var(--color-success)]" aria-hidden="true">
                ✓
              </span>
              {f}
            </li>
          ))}
        </ul>

        <p className="mt-6 rounded-xl bg-[var(--color-surface)] px-4 py-3 text-xs text-[var(--color-muted)]">
          Billing portal coming soon. To update payment details, email{" "}
          <a
            href="mailto:hello@care-log.org"
            className="text-[var(--color-primary)] underline underline-offset-2"
          >
            hello@care-log.org
          </a>
          .
        </p>
      </section>

      {/* Billing history */}
      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-[var(--color-ink)]">
          Billing history
        </h2>
        {BILLING_HISTORY.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">
            No billing history yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-muted)]">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-muted)]">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-[var(--color-muted)]">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {BILLING_HISTORY.map((item, i) => (
                  <tr
                    key={i}
                    className="border-b border-[var(--color-border)] last:border-0"
                  >
                    <td className="px-4 py-3 text-[var(--color-ink)]">
                      {item.date}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-ink)]">
                      {item.amount}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          item.status === "paid"
                            ? "text-[var(--color-success)]"
                            : "text-[var(--color-warning)]"
                        }
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Cancel */}
      <section className="mt-10">
        <button
          onClick={() => setShowCancelModal(true)}
          className="text-sm font-medium text-[var(--color-danger)] underline underline-offset-2 hover:no-underline focus:outline-none"
        >
          Cancel subscription
        </button>
      </section>

      {/* Cancel modal */}
      {showCancelModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCancelModal(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowCancelModal(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-card p-8 shadow-xl">
            <h2
              id="cancel-title"
              className="text-lg font-bold text-[var(--color-ink)]"
            >
              Cancel subscription?
            </h2>
            <p className="mt-3 text-sm text-[var(--color-muted)]">
              Your family&#39;s data is preserved for 30 days after
              cancellation. You can reactivate at any time. Cancellation takes
              effect at the end of your current billing period.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 rounded-xl border-2 border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold text-[var(--color-ink)] hover:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
              >
                Keep my subscription
              </button>
              <button
                onClick={() => {
                  posthog.capture("subscription_cancel_initiated", {
                    plan: "family",
                  });
                  setShowCancelModal(false);
                  toast.error(
                    "Cancellation: contact hello@care-log.org — Stripe not yet wired.",
                  );
                }}
                className="flex-1 rounded-xl bg-[var(--color-danger)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--color-danger)] focus:ring-offset-2"
              >
                Cancel subscription
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
