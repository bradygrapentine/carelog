"use client";

import { useState } from "react";
import { trpc } from "../../../../lib/trpc";
import {
  eligibility,
  type ScreenerAnswers,
  type BenefitProgram,
} from "../../../../lib/benefitsEligibility";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type Props = {
  orgId: string;
  recipientId: string;
  currentUserRole: string;
};

const DEFAULT_ANSWERS: ScreenerAnswers = {
  age65plus: false,
  veteran: false,
  lowIncome: false,
  medicareEnrolled: false,
  medicaidEnrolled: false,
};

export function BenefitsNavigator({
  orgId,
  recipientId,
  currentUserRole,
}: Props) {
  // Hooks must be called unconditionally — role guard is applied after
  const [answers, setAnswers] = useState<ScreenerAnswers>(DEFAULT_ANSWERS);
  const [results, setResults] = useState<BenefitProgram[] | null>(null);
  const [showForm, setShowForm] = useState(false);

  const utils = trpc.useUtils();

  const { data: latest } = trpc.benefits.latest.useQuery(
    { org_id: orgId, recipient_id: recipientId },
    { enabled: currentUserRole === "coordinator" },
  );

  const screenMutation = trpc.benefits.screen.useMutation({
    onSuccess: () => utils.benefits.latest.invalidate(),
  });

  if (currentUserRole !== "coordinator") return null;

  function handleToggleAnswer(key: keyof ScreenerAnswers) {
    setAnswers((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleRunScreener() {
    const matched = eligibility(answers);
    setResults(matched);
    screenMutation.mutate({
      org_id: orgId,
      recipient_id: recipientId,
      answers,
      results: matched,
    });
  }

  const displayResults: BenefitProgram[] | null =
    results ?? (latest ? (latest.results as BenefitProgram[]) : null);

  const QUESTIONS: Array<{ key: keyof ScreenerAnswers; label: string }> = [
    { key: "age65plus", label: "Is the care recipient 65 or older?" },
    { key: "veteran", label: "Is the care recipient a U.S. veteran?" },
    { key: "lowIncome", label: "Does the household have limited income?" },
    {
      key: "medicareEnrolled",
      label: "Is the care recipient enrolled in Medicare?",
    },
    {
      key: "medicaidEnrolled",
      label: "Is the care recipient enrolled in Medicaid?",
    },
  ];

  const screenerForm = (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Answer a few yes/no questions to find government and non-profit benefit
        programs the care recipient may qualify for.
      </p>
      {QUESTIONS.map((q) => (
        <label key={q.key} className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={answers[q.key]}
            onChange={() => handleToggleAnswer(q.key)}
            className="rounded border-border"
          />
          <span className="text-sm text-foreground/80">{q.label}</span>
        </label>
      ))}

      <Separator />

      <Button
        type="button"
        onClick={() => {
          handleRunScreener();
          setShowForm(false);
        }}
        disabled={screenMutation.isPending}
        className="w-full"
      >
        {screenMutation.isPending ? "Saving..." : "Find matching programs"}
      </Button>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-2 bg-[var(--color-secondary-subtle)] border-b border-[var(--color-border)] rounded-t-lg">
        <CardTitle className="text-sm">Benefits navigator</CardTitle>
      </CardHeader>

      <Separator />

      <CardContent className="pt-4 space-y-4">
        {/* Results view */}
        {!showForm && displayResults !== null && (
          <div className="space-y-3">
            {displayResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No matching programs found based on the answers provided.
              </p>
            ) : (
              <>
                <p className="text-xs font-medium text-muted-foreground">
                  {displayResults.length} matching{" "}
                  {displayResults.length === 1 ? "program" : "programs"}
                  {latest && !results ? " (from last screener)" : ""}
                </p>
                <ul className="space-y-2">
                  {displayResults.map((program: BenefitProgram) => (
                    <li
                      key={program.key}
                      className="bg-[var(--color-surface)] rounded-lg px-3 py-2"
                    >
                      <p className="text-sm font-medium text-foreground">
                        {program.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {program.description}
                      </p>
                      <a
                        href={program.applyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline mt-1 inline-block"
                      >
                        Learn how to apply →
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setShowForm(true);
                setResults(null);
                setAnswers(DEFAULT_ANSWERS);
              }}
              className="text-xs text-muted-foreground hover:text-foreground/80 transition-colors"
            >
              Run screener again
            </button>
          </div>
        )}

        {/* No results yet — show Start screener button on mobile only */}
        {!showForm && displayResults === null && (
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Answer a few questions to find matching benefit programs for the
              care recipient.
            </p>
            <Button type="button" onClick={() => setShowForm(true)} size="sm">
              Start screener
            </Button>
          </div>
        )}

        {/* Screener form:
            - Mobile: shown when showForm is true OR no results yet on desktop
            - Desktop: always shown when no prior results or when showForm is active
            Single DOM instance — class toggles visibility. */}
        <div
          className={
            displayResults === null || showForm
              ? showForm
                ? "block"
                : "hidden"
              : "hidden"
          }
        >
          {screenerForm}
        </div>
      </CardContent>
    </Card>
  );
}
