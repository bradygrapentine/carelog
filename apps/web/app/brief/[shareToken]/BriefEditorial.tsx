"use client";

import { Mail, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BriefHeadline } from "@/components/brief/BriefHeadline";
import { formatLongDate, formatTimeShort } from "@/lib/format";

type Medication = {
  drug_name: string;
  dosage: string | null;
  instructions: string | null;
};

type JournalEntry = {
  occurred_at: string;
  text: string | undefined;
  mood: string | undefined;
  flagged: boolean;
};

type BriefContent = {
  recipient_name: string;
  dob: string | null;
  generated_at: string;
  medications: Medication[];
  recent_entries: JournalEntry[];
};

export type Brief = {
  id: string;
  title: string;
  content: BriefContent;
  includes: string[];
  created_at: string;
};

export function BriefEditorial({ brief }: { brief: Brief }) {
  const { content } = brief;
  const dateline = `Today's brief · ${formatLongDate(brief.created_at)} ${formatTimeShort(brief.created_at)}`;

  // Body paragraphs are sourced from recent_entries — each entry becomes one
  // paragraph. The viewer was already a snapshot, so we surface the human
  // text that the coordinator wrote at log time, dated inline.
  const bodyParagraphs = content.recent_entries.slice(0, 8).map((entry) => ({
    key: entry.occurred_at,
    date: formatLongDate(entry.occurred_at),
    text: entry.text ?? "",
    flagged: entry.flagged,
  }));

  const flaggedEntries = content.recent_entries.filter((e) => e.flagged);

  function emailFamily() {
    const subject = encodeURIComponent(
      `Care brief for ${content.recipient_name}`,
    );
    const body = encodeURIComponent(
      `Sharing today's brief for ${content.recipient_name}:\n\n${typeof window !== "undefined" ? window.location.href : ""}`,
    );
    if (typeof window !== "undefined") {
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }
  }

  function printForVisit() {
    if (typeof window !== "undefined") window.print();
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface)] py-12 px-6 page-content">
      <article className="mx-auto max-w-[720px] space-y-8">
        <div className="flex gap-3 print:hidden">
          <Button
            variant="outline"
            onClick={emailFamily}
            aria-label="Email family"
          >
            <Mail className="w-4 h-4" aria-hidden="true" /> Email family
          </Button>
          <Button
            variant="outline"
            onClick={printForVisit}
            aria-label="Print for visit"
          >
            <Printer className="w-4 h-4" aria-hidden="true" /> Print for visit
          </Button>
        </div>

        <header className="space-y-3">
          <p className="eyebrow-mono">{dateline}</p>
          <h1 className="headline-display text-3xl leading-[1.05] text-[var(--color-ink)] sm:text-4xl md:text-5xl">
            <BriefHeadline
              headline={(brief as { headline?: unknown }).headline}
              fallback={
                brief.title ?? `Care brief for ${content.recipient_name}`
              }
            />
          </h1>
        </header>

        <section className="space-y-5 text-lg leading-relaxed text-[var(--color-text-primary)]">
          {bodyParagraphs.length === 0 ? (
            <p className="text-[var(--color-muted)]">
              No journal entries in the snapshot.
            </p>
          ) : (
            bodyParagraphs.map((p) => (
              <p key={p.key}>
                <span className="text-[var(--color-muted)] mr-2 text-base">
                  {p.date} —
                </span>
                {p.text}
              </p>
            ))
          )}
        </section>

        <section className="border-t border-[var(--color-border)] pt-8 space-y-4">
          <h2 className="headline-display text-2xl text-[var(--color-ink)]">
            For your next visit
          </h2>

          {flaggedEntries.length > 0 && (
            <div>
              <p className="eyebrow-mono mb-2">Flagged this week</p>
              <ul className="list-disc pl-6 space-y-1 text-[var(--color-text-primary)]">
                {flaggedEntries.map((e) => (
                  <li key={e.occurred_at}>
                    <span className="text-[var(--color-muted)] mr-1">
                      {formatLongDate(e.occurred_at)}:
                    </span>
                    {e.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {brief.includes.includes("medications") &&
            content.medications.length > 0 && (
              <div>
                <p className="eyebrow-mono mb-2">Active medications</p>
                <ul className="list-disc pl-6 space-y-1 text-[var(--color-text-primary)]">
                  {content.medications.map((m, i) => (
                    <li key={i}>
                      <span className="font-semibold">{m.drug_name}</span>
                      {m.dosage && (
                        <span className="text-[var(--color-muted)] ml-2">
                          {m.dosage}
                        </span>
                      )}
                      {m.instructions && (
                        <span className="text-[var(--color-muted)] ml-1">
                          · {m.instructions}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </section>

        <footer className="pt-6 text-xs text-[var(--color-muted)]">
          A point-in-time snapshot generated by CareSync.
        </footer>
      </article>
    </div>
  );
}
