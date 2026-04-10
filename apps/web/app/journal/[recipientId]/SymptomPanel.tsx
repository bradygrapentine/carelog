"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

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
  const [expanded, setExpanded] = useState(false);
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

  const { data, isLoading } = trpc.symptoms.list.useQuery(
    { org_id: orgId, recipient_id: recipientId },
    { enabled: expanded },
  );

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

  if (!expanded) {
    return (
      <Card>
        <CardContent className="py-3">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-expanded="false"
            aria-controls="symptom-panel-body"
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors w-full text-left flex items-center justify-between"
          >
            <span>Symptom readings</span>
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm">Symptom readings</CardTitle>
            {readings.length > 0 && (
              <span
                className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5"
                aria-label={readings.length + " recent readings"}
              >
                {readings.length}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-expanded="true"
            aria-controls="symptom-panel-body"
            aria-label="Collapse symptom readings"
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Collapse
          </button>
        </div>
      </CardHeader>

      <CardContent id="symptom-panel-body">
        {isLoading && (
          <div
            className="flex items-center gap-2 py-2"
            role="status"
            aria-label="Loading symptom readings"
          >
            <div
              className="h-4 w-4 rounded-full border-2 border-gray-200 border-t-gray-500 animate-spin"
              aria-hidden="true"
            />
            <span className="text-sm text-gray-400">Loading...</span>
          </div>
        )}

        {!isLoading && readings.length === 0 && (
          <p className="text-sm text-gray-400 mb-3">
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
                ? (MOOD_TAG_CLS[r.mood] ?? "bg-gray-50 text-gray-500")
                : "";
              const pColor =
                r.pain_level !== null ? painColor(r.pain_level) : "";
              return (
                <li
                  key={r.id}
                  className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0"
                >
                  <time
                    dateTime={r.recorded_at}
                    className="text-xs text-gray-400 w-16 shrink-0"
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
                    <span className="text-xs text-gray-400 truncate">
                      {r.notes}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {canLog && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            + Log reading
          </button>
        )}

        {canLog && showForm && (
          <form onSubmit={handleSubmit} className="mt-2 space-y-5">
            {/* Pain level */}
            <fieldset>
              <legend className="block text-xs font-medium text-gray-600 mb-2">
                Pain level
              </legend>
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
                    className="flex justify-between text-xs text-gray-300 mt-0.5"
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
                  <p className="text-xs text-gray-400 mt-0.5">
                    {painLabel(painLevel)}
                  </p>
                </div>
              </div>
            </fieldset>

            {/* Mood */}
            <fieldset>
              <legend className="block text-xs font-medium text-gray-600 mb-2">
                Mood
              </legend>
              <div className="flex flex-wrap gap-2" role="group">
                {MOOD_OPTS.map((opt) => {
                  const isSelected = mood === opt.value;
                  const activeCls =
                    MOOD_ACTIVE_CLS[opt.value] ??
                    "bg-gray-100 text-gray-700 border-gray-300";
                  const cls =
                    "px-3 py-1.5 text-xs font-medium rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400 " +
                    (isSelected
                      ? activeCls
                      : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700");
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

            {/* Appetite + Mobility */}
            <div className="grid grid-cols-2 gap-4">
              <fieldset>
                <legend className="block text-xs font-medium text-gray-600 mb-2">
                  Appetite
                </legend>
                <div className="flex flex-wrap gap-1.5" role="group">
                  {APPETITE_OPTS.map((opt) => {
                    const isSelected = appetite === opt.value;
                    const cls =
                      "px-2.5 py-1 text-xs rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400 " +
                      (isSelected
                        ? "bg-gray-800 text-white border-gray-800"
                        : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700");
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setAppetite(
                            isSelected ? "" : (opt.value as AppetiteVal),
                          )
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
                <legend className="block text-xs font-medium text-gray-600 mb-2">
                  Mobility
                </legend>
                <div className="flex flex-wrap gap-1.5" role="group">
                  {MOBILITY_OPTS.map((opt) => {
                    const isSelected = mobility === opt.value;
                    const cls =
                      "px-2.5 py-1 text-xs rounded-full border transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400 " +
                      (isSelected
                        ? "bg-gray-800 text-white border-gray-800"
                        : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700");
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setMobility(
                            isSelected ? "" : (opt.value as MobilityVal),
                          )
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

            {/* Notes */}
            <div>
              <label
                htmlFor="symptom-notes"
                className="block text-xs font-medium text-gray-600 mb-1"
              >
                Notes{" "}
                <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <textarea
                id="symptom-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={1000}
                rows={2}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent resize-none placeholder:text-gray-300"
                placeholder="Any additional observations..."
              />
            </div>

            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={resetForm}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={logMutation.isPending}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-700"
              >
                {logMutation.isPending ? "Saving..." : "Save reading"}
              </button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
