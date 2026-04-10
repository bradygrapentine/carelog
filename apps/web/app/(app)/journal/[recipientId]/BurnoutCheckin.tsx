"use client";

import { useState } from "react";
import { trpc } from "../../../../lib/trpc";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import posthog from "posthog-js";

type Props = {
  orgId: string;
  currentUserRole: string;
  currentUserId: string;
};

function getISOWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function currentWeekStamp(): string {
  const d = new Date();
  const year = d.getFullYear();
  const week = String(getISOWeek(d)).padStart(2, "0");
  return year + "-W" + week;
}

const SLEEP_LABELS: Record<number, string> = {
  1: "Very poor",
  2: "Poor",
  3: "Fair",
  4: "Good",
  5: "Great",
};
const STRESS_LABELS: Record<number, string> = {
  1: "None",
  2: "Low",
  3: "Moderate",
  4: "High",
  5: "Overwhelming",
};
const SUPPORT_LABELS: Record<number, string> = {
  1: "None",
  2: "Little",
  3: "Some",
  4: "Good",
  5: "Strong",
};

// For sleep/support: high score = good (green). For stress: high score = bad (red).
function goodColor(val: number): string {
  if (val >= 4) return "text-emerald-600";
  if (val >= 3) return "text-amber-600";
  return "text-red-500";
}

function stressColor(val: number): string {
  if (val <= 2) return "text-emerald-600";
  if (val <= 3) return "text-amber-600";
  return "text-red-600";
}

export function BurnoutCheckin({
  orgId,
  currentUserRole,
  currentUserId,
}: Props) {
  const [sleepScore, setSleepScore] = useState(3);
  const [stressScore, setStressScore] = useState(3);
  const [supportScore, setSupportScore] = useState(3);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hooks must be called unconditionally — role guard is applied after
  const checkInMutation = trpc.burnout.checkIn.useMutation({
    onSuccess: () => {
      setSaved(true);
      setError(null);
      posthog.capture("burnout_checkin_submitted", {
        sleep_score: sleepScore,
        stress_score: stressScore,
        support_score: supportScore,
        has_notes: notes.trim().length > 0,
      });
    },
    onError: () => setError("Something went wrong. Please try again."),
  });

  // Only coordinators and caregivers fill out check-ins
  if (currentUserRole === "supporter" || currentUserRole === "aide")
    return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    checkInMutation.mutate({
      org_id: orgId,
      user_id: currentUserId,
      sleep_score: sleepScore,
      stress_score: stressScore,
      support_score: supportScore,
      notes: notes.trim() || undefined,
      week_stamp: currentWeekStamp(),
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">How are you doing this week?</CardTitle>
        <p className="text-xs text-gray-400 mt-0.5">
          Your answers are private and help us look out for you.
        </p>
      </CardHeader>

      <CardContent>
        {saved ? (
          <div className="py-4 text-center" role="status">
            <p className="text-sm font-medium text-emerald-700">
              Check-in saved.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              We&apos;ll remind you next week.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Sleep quality */}
            <fieldset>
              <div className="flex items-center justify-between mb-2">
                <legend className="text-xs font-medium text-gray-600">
                  Sleep quality
                </legend>
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  <span
                    className={
                      "text-sm font-semibold tabular-nums " +
                      goodColor(sleepScore)
                    }
                  >
                    {sleepScore}/5
                  </span>
                  <span className={"text-xs " + goodColor(sleepScore)}>
                    {SLEEP_LABELS[sleepScore]}
                  </span>
                </div>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                value={sleepScore}
                onChange={(e) => setSleepScore(parseInt(e.target.value, 10))}
                className="w-full accent-gray-700"
                aria-label="Sleep quality"
                aria-valuemin={1}
                aria-valuemax={5}
                aria-valuenow={sleepScore}
                aria-valuetext={
                  sleepScore + " out of 5 — " + SLEEP_LABELS[sleepScore]
                }
              />
              <div
                className="flex justify-between text-xs text-gray-300 mt-0.5"
                aria-hidden="true"
              >
                <span>Very poor</span>
                <span>Great</span>
              </div>
            </fieldset>

            {/* Stress level */}
            <fieldset>
              <div className="flex items-center justify-between mb-2">
                <legend className="text-xs font-medium text-gray-600">
                  Stress level
                </legend>
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  <span
                    className={
                      "text-sm font-semibold tabular-nums " +
                      stressColor(stressScore)
                    }
                  >
                    {stressScore}/5
                  </span>
                  <span className={"text-xs " + stressColor(stressScore)}>
                    {STRESS_LABELS[stressScore]}
                  </span>
                </div>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                value={stressScore}
                onChange={(e) => setStressScore(parseInt(e.target.value, 10))}
                className="w-full accent-gray-700"
                aria-label="Stress level"
                aria-valuemin={1}
                aria-valuemax={5}
                aria-valuenow={stressScore}
                aria-valuetext={
                  stressScore + " out of 5 — " + STRESS_LABELS[stressScore]
                }
              />
              <div
                className="flex justify-between text-xs text-gray-300 mt-0.5"
                aria-hidden="true"
              >
                <span>None</span>
                <span>Overwhelming</span>
              </div>
            </fieldset>

            {/* Support from others */}
            <fieldset>
              <div className="flex items-center justify-between mb-2">
                <legend className="text-xs font-medium text-gray-600">
                  Support from others
                </legend>
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  <span
                    className={
                      "text-sm font-semibold tabular-nums " +
                      goodColor(supportScore)
                    }
                  >
                    {supportScore}/5
                  </span>
                  <span className={"text-xs " + goodColor(supportScore)}>
                    {SUPPORT_LABELS[supportScore]}
                  </span>
                </div>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                value={supportScore}
                onChange={(e) => setSupportScore(parseInt(e.target.value, 10))}
                className="w-full accent-gray-700"
                aria-label="Support from others"
                aria-valuemin={1}
                aria-valuemax={5}
                aria-valuenow={supportScore}
                aria-valuetext={
                  supportScore + " out of 5 — " + SUPPORT_LABELS[supportScore]
                }
              />
              <div
                className="flex justify-between text-xs text-gray-300 mt-0.5"
                aria-hidden="true"
              >
                <span>None</span>
                <span>Strong</span>
              </div>
            </fieldset>

            {/* Notes */}
            <div>
              <label
                htmlFor="burnout-notes"
                className="block text-xs font-medium text-gray-600 mb-1"
              >
                Anything you want to add?{" "}
                <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <textarea
                id="burnout-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                rows={2}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent resize-none placeholder:text-gray-300"
                placeholder="How are you really doing?"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={checkInMutation.isPending}
              className="w-full px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-700"
            >
              {checkInMutation.isPending ? "Saving..." : "Save check-in"}
            </button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
