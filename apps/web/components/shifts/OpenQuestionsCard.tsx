"use client";

/**
 * UX-085 — Open Questions Card.
 *
 * Pure presentational. Shows unresolved questions raised by caregivers
 * during a shift. Caller resolves names and passes pre-built props.
 */

import { Card, CardContent, CardHeader } from "@/components/ui/card";

export type OpenQuestion = {
  id: string;
  text: string;
  /** Who raised it. */
  by: string;
  /** Human-readable timestamp. */
  when: string;
  /** Indicates whether the question is awaiting an answer (default true). */
  open?: boolean;
};

export type OpenQuestionsCardProps = {
  questions: OpenQuestion[];
  /** When provided, each open question shows a "Respond" button. */
  onRespond?: (questionId: string) => void;
  className?: string;
};

export function OpenQuestionsCard({
  questions,
  onRespond,
  className,
}: OpenQuestionsCardProps) {
  return (
    <Card className={["shadow-sm gap-2", className].filter(Boolean).join(" ")}>
      <CardHeader className="-mt-4 px-4 py-3 bg-[var(--color-primary-subtle)] border-b border-[var(--color-border)]">
        <p className="eyebrow-mono text-[var(--color-muted)]">
          OPEN QUESTIONS
        </p>
        <p className="text-sm font-semibold text-[var(--color-ink)] mt-0.5">
          Awaiting an answer.
        </p>
      </CardHeader>
      <CardContent className="pt-2 px-4 pb-4">
        {questions.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">
            No open questions.
          </p>
        ) : (
          <ul className="space-y-3">
            {questions.map((q) => {
              const isOpen = q.open !== false;
              return (
                <li
                  key={q.id}
                  className="flex flex-col gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
                >
                  <p
                    className={[
                      "text-sm text-[var(--color-text-primary)]",
                      !isOpen ? "line-through text-[var(--color-muted)]" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {q.text}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-[var(--color-muted)]">
                      {q.by} · {q.when}
                    </p>
                    {!isOpen ? (
                      <span className="text-xs text-[var(--color-muted)] font-medium">
                        Resolved
                      </span>
                    ) : onRespond ? (
                      <button
                        type="button"
                        onClick={() => onRespond(q.id)}
                        className="text-xs font-medium text-[var(--color-primary)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 rounded"
                      >
                        Respond
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
