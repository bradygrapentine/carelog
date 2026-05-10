"use client";

/**
 * UX-082 — Narrative Handoff.
 *
 * Pure presentational. Two modes: view (read-only "Three things you need to
 * know" card) and edit (composer for the off-going caregiver).
 * Caller resolves author and timestamps; no tRPC calls inside.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export type NarrativeHandoffEntry = {
  /** Short title for this point. */
  heading?: string;
  /** Free-text paragraph from the off-going caregiver. */
  body: string;
};

type ViewProps = {
  mode?: "view";
  entries: NarrativeHandoffEntry[];
  author: { name: string; shiftLabel?: string };
  when: string;
  className?: string;
};

type EditProps = {
  mode: "edit";
  defaultEntries?: NarrativeHandoffEntry[];
  onSubmit: (next: NarrativeHandoffEntry[]) => void;
  submitting?: boolean;
  className?: string;
};

export type NarrativeHandoffProps = ViewProps | EditProps;

const DEFAULT_COUNT = 3;

function buildDefaultEntries(count: number): NarrativeHandoffEntry[] {
  return Array.from({ length: count }, () => ({ body: "" }));
}

export function NarrativeHandoff(props: NarrativeHandoffProps) {
  if (props.mode === "edit") {
    return <EditMode {...props} />;
  }
  return <ViewMode {...props} />;
}

function ViewMode({ entries, author, when, className }: ViewProps) {
  const eyebrow = ["HANDOFF", author.name, author.shiftLabel]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className={["shadow-sm gap-2", className].filter(Boolean).join(" ")}>
      <CardHeader className="-mt-4 px-4 py-3 bg-[var(--color-primary-subtle)] border-b border-[var(--color-border)]">
        <p className="eyebrow-mono text-[var(--color-muted)]">{eyebrow}</p>
        <h2 className="headline-display text-lg text-[var(--color-ink)] mt-0.5">
          Three things you need to know.
        </h2>
      </CardHeader>
      <CardContent className="pt-3 px-4 pb-4 space-y-4">
        {entries.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">
            Nothing flagged this shift.
          </p>
        ) : (
          entries.map((entry, idx) => (
            <section key={idx}>
              {entry.heading ? (
                <p className="text-sm font-semibold text-[var(--color-ink)]">
                  {entry.heading}
                </p>
              ) : null}
              <p className="text-sm text-[var(--color-text-primary)] mt-0.5">
                {entry.body}
              </p>
            </section>
          ))
        )}
        <p className="text-xs text-[var(--color-muted)] pt-1">Posted {when}</p>
      </CardContent>
    </Card>
  );
}

function EditMode({
  defaultEntries,
  onSubmit,
  submitting,
  className,
}: EditProps) {
  const initial =
    defaultEntries && defaultEntries.length > 0
      ? defaultEntries
      : buildDefaultEntries(DEFAULT_COUNT);

  const [entries, setEntries] = useState<NarrativeHandoffEntry[]>(initial);

  function updateEntry(
    idx: number,
    field: keyof NarrativeHandoffEntry,
    value: string,
  ) {
    setEntries((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)),
    );
  }

  return (
    <Card className={["shadow-sm gap-2", className].filter(Boolean).join(" ")}>
      <CardHeader className="-mt-4 px-4 py-3 bg-[var(--color-primary-subtle)] border-b border-[var(--color-border)]">
        <h2 className="headline-display text-lg text-[var(--color-ink)]">
          Three things you need to know.
        </h2>
      </CardHeader>
      <CardContent className="pt-3 px-4 pb-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(entries);
          }}
          className="space-y-4"
        >
          {entries.map((entry, idx) => (
            <fieldset key={idx} className="space-y-1">
              <label
                htmlFor={`handoff-heading-${idx}`}
                className="text-xs font-medium text-[var(--color-muted)]"
              >
                Heading (optional)
              </label>
              <input
                id={`handoff-heading-${idx}`}
                type="text"
                value={entry.heading ?? ""}
                onChange={(e) => updateEntry(idx, "heading", e.target.value)}
                placeholder={`Point ${idx + 1} title`}
                className="block w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
              />
              <label
                htmlFor={`handoff-body-${idx}`}
                className="text-xs font-medium text-[var(--color-muted)]"
              >
                Body
              </label>
              <textarea
                id={`handoff-body-${idx}`}
                value={entry.body}
                onChange={(e) => updateEntry(idx, "body", e.target.value)}
                rows={3}
                placeholder={`What happened — point ${idx + 1}`}
                className="block w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 resize-y"
              />
            </fieldset>
          ))}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-[var(--color-primary-pressed)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-deep)] disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-pressed)] focus:ring-offset-2"
            >
              Post handoff
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
