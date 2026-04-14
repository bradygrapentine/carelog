"use client";

import { useState } from "react";
import { trpc } from "../../../../lib/trpc";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type Props = {
  orgId: string;
  recipientId: string;
  currentUserRole: string;
};

type SymptomRow = {
  id: string;
  pain_level: number | null;
  mood: string | null;
  appetite: string | null;
  mobility: string | null;
  notes: string | null;
  recorded_at: string;
};

type MoodVal = "good" | "okay" | "difficult" | "crisis" | "";
type AppetiteVal = "normal" | "reduced" | "poor" | "none" | "";
type MobilityVal = "normal" | "limited" | "assisted" | "bedbound" | "";

const MOOD_OPTS: { value: MoodVal; label: string }[] = [
  { value: "good", label: "Good" },
  { value: "okay", label: "Okay" },
  { value: "difficult", label: "Difficult" },
  { value: "crisis", label: "Crisis" },
];

const APPETITE_OPTS: { value: AppetiteVal; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "reduced", label: "Reduced" },
  { value: "poor", label: "Poor" },
  { value: "none", label: "None" },
];

const MOBILITY_OPTS: { value: MobilityVal; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "limited", label: "Limited" },
  { value: "assisted", label: "Assisted" },
  { value: "bedbound", label: "Bedbound" },
];

const MOOD_ACTIVE_CLS: Record<string, string> = {
  good: "bg-emerald-100 text-emerald-800 border-emerald-300",
  okay: "bg-sky-100 text-sky-800 border-sky-300",
  difficult: "bg-amber-100 text-amber-800 border-amber-300",
  crisis: "bg-red-100 text-red-800 border-red-300",
};

const MOOD_TAG_CLS: Record<string, string> = {
  good: "bg-emerald-50 text-emerald-700",
  okay: "bg-sky-50 text-sky-700",
  difficult: "bg-amber-50 text-amber-700",
  crisis: "bg-red-50 text-red-700",
};

function painLabel(n: number): string {
  if (n <= 2) return "Minimal";
  if (n <= 4) return "Mild";
  if (n <= 6) return "Moderate";
  if (n <= 8) return "Severe";
  return "Maximum";
}

function painColor(n: number): string {
  if (n <= 3) return "text-emerald-600";
  if (n <= 6) return "text-amber-600";
  return "text-red-600";
}

export function SymptomPanel({ orgId, recipientId, currentUserRole }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [painLevel, setPainLevel] = useState(5);
  const [mood, setMood] = useState<MoodVal>("");
  const [appetite, setAppetite] = useState<AppetiteVal>("");
  const [mobility, setMobility] = useState<MobilityVal>("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canLog =
    currentUserRole === "coordinator" || currentUserRole === "caregiver";
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.symptoms.list.useQuery({
    org_id: orgId,
    recipient_id: recipientId,
  });

  const logMutation = trpc.symptoms.log.useMutation({
    onSuccess: () => {
      utils.symptoms.list.invalidate();
      setShowForm(false);
      setPainLevel(5);
      setMood("");
      setAppetite("");
      setMobility("");
      setNotes("");
      setError(null);
    },
    onError: () => setError("Something went wrong. Please try again."),
  });

  const readings = (data ?? []).slice(0, 7) as SymptomRow[];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    logMutation.mutate({
      org_id: orgId,
      recipient_id: recipientId,
      pain_level: painLevel,
      mood: mood || undefined,
      appetite: appetite || undefined,
      mobility: mobility || undefined,
      notes: notes.trim() || undefined,
    });
  }

  function resetForm() {
    setShowForm(false);
    setError(null);
  }

  const logForm = canLog ? (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Pain level */}
      <fieldset>
        <legend className="block text-xs font-medium text-foreground/80 mb-1">
          Pain level
        </legend>
        <p className="text-xs text-muted-foreground mb-2">
          Rate the care recipient&apos;s current pain from 0 (none) to 10
          (maximum).
        </p>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <input
              id="symptom-pain"
              type="range"
              min={0}
              max={10}
              value={painLevel}
              onChange={(e) => setPainLevel(parseInt(e.target.value, 10))}
              className="w-full accent-gray-700"
              aria-label="Pain level"
              aria-valuemin={0}
              aria-valuemax={10}
              aria-valuenow={painLevel}
              aria-valuetext={
                painLevel + " out of 10 — " + painLabel(painLevel)
              }
            />
            <div
              className="flex justify-between text-xs text-muted-foreground mt-0.5"
              aria-hidden="true"
            >
              <span>None</span>
              <span>Severe</span>
            </div>
          </div>
          <div className="text-center shrink-0 w-14" aria-hidden="true">
            <p
              className={
                "text-2xl font-bold tabular-nums leading-none " +
                painColor(painLevel)
              }
            >
              {painLevel}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {painLabel(painLevel)}
            </p>
          </div>
        </div>
      </fieldset>

      <Separator />

      {/* Mood */}
      <fieldset>
        <legend className="block text-xs font-medium text-foreground/80 mb-1">
          Mood
        </legend>
        <p className="text-xs text-muted-foreground mb-2">
          Overall emotional state of the care recipient right now.
        </p>
        <div className="flex flex-wrap gap-2" role="group">
          {MOOD_OPTS.map((opt) => {
            const isSelected = mood === opt.value;
            const activeCls =
              MOOD_ACTIVE_CLS[opt.value] ??
              "bg-[var(--color-surface)] text-foreground/80 border-border";
            const cls =
              "px-3 py-1.5 text-xs font-medium rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-border " +
              (isSelected
                ? activeCls
                : "bg-card text-muted-foreground border-border hover:border-border hover:text-foreground/80");
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  setMood(isSelected ? "" : (opt.value as MoodVal))
                }
                className={cls}
                aria-pressed={isSelected}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Separator />

      {/* Appetite + Mobility */}
      <div className="grid grid-cols-2 gap-4">
        <fieldset>
          <legend className="block text-xs font-medium text-foreground/80 mb-1">
            Appetite
          </legend>
          <p className="text-xs text-muted-foreground mb-2">
            Food intake compared to normal.
          </p>
          <div className="flex flex-wrap gap-1.5" role="group">
            {APPETITE_OPTS.map((opt) => {
              const isSelected = appetite === opt.value;
              const cls =
                "px-2.5 py-1 text-xs rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-border " +
                (isSelected
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-muted-foreground border-border hover:border-border hover:text-foreground/80");
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setAppetite(isSelected ? "" : (opt.value as AppetiteVal))
                  }
                  className={cls}
                  aria-pressed={isSelected}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="block text-xs font-medium text-foreground/80 mb-1">
            Mobility
          </legend>
          <p className="text-xs text-muted-foreground mb-2">
            Ability to move around independently.
          </p>
          <div className="flex flex-wrap gap-1.5" role="group">
            {MOBILITY_OPTS.map((opt) => {
              const isSelected = mobility === opt.value;
              const cls =
                "px-2.5 py-1 text-xs rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-border " +
                (isSelected
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-muted-foreground border-border hover:border-border hover:text-foreground/80");
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setMobility(isSelected ? "" : (opt.value as MobilityVal))
                  }
                  className={cls}
                  aria-pressed={isSelected}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      <Separator />

      {/* Notes */}
      <div>
        <label
          htmlFor="symptom-notes"
          className="block text-xs font-medium text-foreground/80 mb-1"
        >
          Notes{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <p className="text-xs text-muted-foreground mb-1">
          Any additional observations — symptoms, context, or changes to
          routine.
        </p>
        <textarea
          id="symptom-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={1000}
          rows={2}
          className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-border focus:border-transparent resize-none placeholder:text-muted-foreground"
          placeholder="Any additional observations..."
        />
      </div>

      {error && (
        <p className="text-sm text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      )}

      <Separator />

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={resetForm}
          className="text-sm text-muted-foreground hover:text-foreground/80 transition-colors"
        >
          Cancel
        </button>
        <Button type="submit" disabled={logMutation.isPending}>
          {logMutation.isPending ? "Saving..." : "Save reading"}
        </Button>
      </div>
    </form>
  ) : null;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 bg-[var(--color-secondary-subtle)] border-b border-[var(--color-border)] rounded-t-lg">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm">Symptom readings</CardTitle>
          {readings.length > 0 && (
            <span
              className="text-xs bg-[var(--color-surface)] text-muted-foreground rounded-full px-2 py-0.5"
              aria-label={readings.length + " recent readings"}
            >
              {readings.length}
            </span>
          )}
        </div>
      </CardHeader>

      <Separator />

      <CardContent id="symptom-panel-body" className="pt-4">
        {isLoading && (
          <div
            className="flex items-center gap-2 py-2"
            role="status"
            aria-label="Loading symptom readings"
          >
            <div
              className="h-4 w-4 rounded-full border-2 border-border border-t-foreground/80 animate-spin"
              aria-hidden="true"
            />
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        )}

        {!isLoading && readings.length === 0 && (
          <p className="text-sm text-muted-foreground mb-3">
            No readings recorded yet.
          </p>
        )}

        {readings.length > 0 && (
          <ul
            className="space-y-1 mb-4"
            role="list"
            aria-label="Recent symptom readings"
          >
            {readings.map((r) => {
              const dateStr = new Date(r.recorded_at).toLocaleDateString(
                "en-US",
                { month: "short", day: "numeric" },
              );
              const tagCls = r.mood
                ? (MOOD_TAG_CLS[r.mood] ??
                  "bg-[var(--color-surface)] text-muted-foreground")
                : "";
              const pColor =
                r.pain_level !== null ? painColor(r.pain_level) : "";
              return (
                <li
                  key={r.id}
                  className="flex items-center gap-3 py-2 border-b border-border last:border-0"
                >
                  <time
                    dateTime={r.recorded_at}
                    className="text-xs text-muted-foreground w-16 shrink-0"
                  >
                    {dateStr}
                  </time>
                  {r.pain_level !== null && (
                    <span
                      className={
                        "text-xs font-semibold tabular-nums shrink-0 " + pColor
                      }
                      aria-label={"Pain level " + r.pain_level + " out of 10"}
                    >
                      {r.pain_level}/10
                    </span>
                  )}
                  {r.mood && (
                    <span
                      className={
                        "text-xs px-2 py-0.5 rounded-full shrink-0 font-medium " +
                        tagCls
                      }
                    >
                      {r.mood.charAt(0).toUpperCase() + r.mood.slice(1)}
                    </span>
                  )}
                  {r.notes && (
                    <span className="text-xs text-muted-foreground truncate">
                      {r.notes}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {canLog && (
          <>
            {/* Toggle button: mobile only, hidden on lg+ */}
            {!showForm && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="text-sm text-muted-foreground hover:text-foreground/80 transition-colors"
              >
                + Log reading
              </button>
            )}
            {/* Form: on mobile shown when showForm; on desktop always shown via lg:block */}
            <div className={"mt-2 " + (showForm ? "block" : "hidden")}>
              {readings.length > 0 && <Separator className="mb-4" />}
              {logForm}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
