"use client";

import { useEffect, useState } from "react";

type RequestData = {
  id: string;
  title: string;
  description: string | null;
  request_type: string;
  slots_total: number;
  slots_filled: number;
  needed_by: string | null;
  active: boolean;
};

type PageState =
  | { status: "loading" }
  | { status: "not_found" }
  | { status: "ready"; data: RequestData }
  | { status: "claimed" }
  | { status: "full" };

const TYPE_LABELS: Record<string, string> = {
  meal: "Meal",
  transport: "Transport",
  errand: "Errand",
  visit: "Visit",
  other: "Other",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function OuterCirclePage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [slotDate, setSlotDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setShareToken(p.shareToken));
  }, [params]);

  useEffect(() => {
    if (!shareToken) return;
    const url = "/api/outer-circle/" + shareToken;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setState({ status: "not_found" });
        } else if (data.slots_filled >= data.slots_total) {
          setState({ status: "full" });
        } else {
          setState({ status: "ready", data });
        }
      })
      .catch(() => setState({ status: "not_found" }));
  }, [shareToken]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Read all form values synchronously before any await
    const n = name;
    const em = email;
    const no = note;
    const sd = slotDate;

    if (!n || !em) {
      setFormError("Please enter your name and email.");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const claimUrl = "/api/outer-circle/" + shareToken + "/claim";
    const res = await fetch(claimUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: n,
        email: em,
        note: no || undefined,
        slot_date: sd || undefined,
      }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (res.status === 409) {
      setState({ status: "full" });
    } else if (!res.ok) {
      setFormError(data.error ?? "Something went wrong. Please try again.");
    } else {
      setState({ status: "claimed" });
    }
  }

  if (state.status === "loading") {
    return (
      <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (state.status === "not_found") {
    return (
      <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <p className="text-foreground/80">
            This request is no longer available.
          </p>
        </div>
      </div>
    );
  }

  if (state.status === "claimed") {
    return (
      <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="text-3xl mb-4">&#10084;</div>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Thanks! You&apos;re helping out.
          </h1>
          <p className="text-muted-foreground">
            You&apos;ll receive a confirmation email shortly. Your support means
            everything to this family.
          </p>
        </div>
      </div>
    );
  }

  if (state.status === "full") {
    return (
      <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-foreground mb-2">
            All slots have been filled.
          </h1>
          <p className="text-muted-foreground">
            Thank you to everyone who helped!
          </p>
        </div>
      </div>
    );
  }

  const { data } = state;
  const slotsRemaining = data.slots_total - data.slots_filled;

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <div className="max-w-lg mx-auto py-12 px-4">
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-6 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-medium text-muted-foreground bg-[var(--color-surface)] rounded-full px-2 py-1">
                {TYPE_LABELS[data.request_type] ?? data.request_type}
              </span>
            </div>
            <h1 className="text-xl font-semibold text-foreground mb-2">
              {data.title}
            </h1>
            {data.description && (
              <p className="text-sm text-foreground/80 mb-3">
                {data.description}
              </p>
            )}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>
                {slotsRemaining} of {data.slots_total}{" "}
                {data.slots_total === 1 ? "slot" : "slots"} remaining
              </span>
              {data.needed_by && (
                <span>Needed by {formatDate(data.needed_by)}</span>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
            <p className="text-sm font-medium text-foreground/80">
              Claim a slot
            </p>

            <div>
              <label
                htmlFor="claimer-name"
                className="block text-xs text-muted-foreground mb-1"
              >
                Your name
              </label>
              <input
                id="claimer-name"
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setFormError(null);
                }}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
                placeholder="Jane Smith"
              />
            </div>

            <div>
              <label
                htmlFor="claimer-email"
                className="block text-xs text-muted-foreground mb-1"
              >
                Email address
              </label>
              <input
                id="claimer-email"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFormError(null);
                }}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
                placeholder="jane@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="claimer-date"
                className="block text-xs text-muted-foreground mb-1"
              >
                Date (optional)
              </label>
              <input
                id="claimer-date"
                type="date"
                value={slotDate}
                onChange={(e) => setSlotDate(e.target.value)}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label
                htmlFor="claimer-note"
                className="block text-xs text-muted-foreground mb-1"
              >
                Note (optional)
              </label>
              <textarea
                id="claimer-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:border-primary resize-none"
                placeholder="Any details you want to share..."
              />
            </div>

            {formError && (
              <p className="text-sm text-[var(--color-danger)]">{formError}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Claiming..." : "Claim a slot"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
