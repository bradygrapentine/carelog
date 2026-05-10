"use client";

import { useState, useMemo } from "react";
import {
  Clock,
  Pill,
  BookOpen,
  Calendar,
  AlertTriangle,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { buildHandoffSummary } from "@/lib/handoffSummary";
import type { HandoffSummaryData } from "@/lib/handoffSummary";

// ─── Types ─────────────────────────────────────────────────────────────────

type WindowHours = 24 | 48 | 72;

type HandoffSummaryProps = {
  open: boolean;
  onClose: () => void;
  recipientId: string;
};

// ─── Section sub-components ────────────────────────────────────────────────

function SectionHeading({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
      {icon}
      {label}
    </h3>
  );
}

function MedsSection({ data }: { data: HandoffSummaryData["meds"] }) {
  return (
    <section aria-labelledby="handoff-meds-heading">
      <SectionHeading
        icon={
          <Pill
            className="h-4 w-4 text-[var(--color-primary)]"
            aria-hidden="true"
          />
        }
        label="Medications"
      />
      <p id="handoff-meds-heading" className="sr-only">
        Medications summary
      </p>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        {data.description}
      </p>
    </section>
  );
}

function MomentsSection({ data }: { data: HandoffSummaryData["moments"] }) {
  return (
    <section aria-labelledby="handoff-moments-heading">
      <SectionHeading
        icon={
          <BookOpen
            className="h-4 w-4 text-[var(--color-primary)]"
            aria-hidden="true"
          />
        }
        label="Moments"
      />
      <p id="handoff-moments-heading" className="sr-only">
        Journal moments summary
      </p>
      {data.items.length === 0 ? (
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {data.description}
        </p>
      ) : (
        <ul className="mt-1 space-y-2">
          {data.items.map((item, idx) => (
            <li
              key={idx}
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm"
            >
              {item.mood && (
                <span className="mr-2 inline-block rounded-full bg-[var(--color-primary-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--color-primary)]">
                  {item.mood}
                </span>
              )}
              <span className="text-[var(--color-text-secondary)]">
                {item.excerpt}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AppointmentsSection({
  data,
}: {
  data: HandoffSummaryData["appointments"];
}) {
  return (
    <section aria-labelledby="handoff-appts-heading">
      <SectionHeading
        icon={
          <Calendar
            className="h-4 w-4 text-[var(--color-primary)]"
            aria-hidden="true"
          />
        }
        label="Appointments"
      />
      <p id="handoff-appts-heading" className="sr-only">
        Appointments summary
      </p>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        {data.description}
      </p>
    </section>
  );
}

function ConcernsSection({ data }: { data: HandoffSummaryData["concerns"] }) {
  return (
    <section aria-labelledby="handoff-concerns-heading">
      <SectionHeading
        icon={
          <AlertTriangle
            className={`h-4 w-4 ${data.hasConcerns ? "text-[var(--color-warning)]" : "text-[var(--color-primary)]"}`}
            aria-hidden="true"
          />
        }
        label="Concerns"
      />
      <p id="handoff-concerns-heading" className="sr-only">
        Concerns summary
      </p>
      <p
        className={`mt-1 text-sm ${
          data.hasConcerns
            ? "text-[var(--color-warning)]"
            : "text-[var(--color-text-secondary)]"
        }`}
      >
        {data.description}
      </p>
      {data.hasConcerns && data.items.length > 0 && (
        <ul className="mt-1 space-y-1">
          {data.items.map((item, idx) => (
            <li
              key={idx}
              className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text-secondary)]"
            >
              {item.flagged && (
                <span className="mr-2 inline-block rounded-full bg-[var(--color-secondary-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--color-secondary)]">
                  Flagged
                </span>
              )}
              {item.excerpt}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ThanksSection({ data }: { data: HandoffSummaryData["thanks"] }) {
  return (
    <section aria-labelledby="handoff-thanks-heading">
      <SectionHeading
        icon={
          <Users
            className="h-4 w-4 text-[var(--color-primary)]"
            aria-hidden="true"
          />
        }
        label="Thanks to"
      />
      <p id="handoff-thanks-heading" className="sr-only">
        Contributors summary
      </p>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        {data.description}
      </p>
    </section>
  );
}

// ─── Period picker ─────────────────────────────────────────────────────────

const WINDOW_OPTIONS: { value: WindowHours; label: string }[] = [
  { value: 24, label: "Last 24h" },
  { value: 48, label: "Last 48h" },
  { value: 72, label: "Last 72h" },
];

// ─── Main component ────────────────────────────────────────────────────────

export function HandoffSummary({
  open,
  onClose,
  recipientId,
}: HandoffSummaryProps) {
  const [windowHours, setWindowHours] = useState<WindowHours>(24);

  // Fetch the most recent events — the timeline procedure supports up to 100
  // entries. We filter client-side by the chosen window after fetching.
  const { data: events, isLoading } = trpc.careEvents.timeline.useQuery(
    { recipientId, limit: 100 },
    { enabled: open },
  );

  const now = useMemo(() => new Date(), [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = useMemo<HandoffSummaryData | null>(() => {
    if (!events) return null;
    return buildHandoffSummary(events, now, windowHours);
  }, [events, now, windowHours]);

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent
        className="max-h-[90vh] overflow-y-auto max-w-lg w-full"
        aria-describedby="handoff-summary-description"
      >
        <DialogHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <DialogTitle>While you were away</DialogTitle>
            {/* Period picker */}
            <div
              role="group"
              aria-label="Summary period"
              className="flex gap-1"
            >
              {WINDOW_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={windowHours === opt.value}
                  onClick={() => setWindowHours(opt.value)}
                  className={`rounded px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-pressed)] focus:ring-offset-2 ${
                    windowHours === opt.value
                      ? "bg-[var(--color-primary-pressed)] text-white"
                      : "bg-[var(--color-primary-subtle)] text-[var(--color-primary)] hover:bg-[var(--color-primary-subtle)]/70"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <p
            id="handoff-summary-description"
            className="text-sm text-[var(--color-muted)]"
          >
            A snapshot of what happened in the past {windowHours} hours.
          </p>
        </DialogHeader>

        {/* Body */}
        <div className="mt-4 space-y-5">
          {isLoading || !summary ? (
            <p
              role="status"
              className="text-sm text-[var(--color-muted)] animate-pulse"
            >
              Loading…
            </p>
          ) : (
            <>
              <MedsSection data={summary.meds} />
              <MomentsSection data={summary.moments} />
              <AppointmentsSection data={summary.appointments} />
              <ConcernsSection data={summary.concerns} />
              <ThanksSection data={summary.thanks} />
            </>
          )}
        </div>

        <DialogFooter className="mt-6">
          <Button
            onClick={onClose}
            className="bg-[var(--color-primary-pressed)] text-white hover:bg-[var(--color-primary-deep)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-pressed)] focus:ring-offset-2"
          >
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
