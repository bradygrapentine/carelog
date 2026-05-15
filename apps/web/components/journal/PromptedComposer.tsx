"use client";

/**
 * PromptedComposer — UX-059 variant of JournalEntryForm.
 *
 * Three-question prompted entry: "Today they...", "What I noticed", and
 * "Worth flagging?". Combines the three answers into a single journal entry
 * body and submits via the same `onPost(text, mood)` callback shape used by
 * JournalEntryForm — so it can be dropped into JournalClient with no other
 * wiring changes.
 *
 * Drawn from /tmp/caresync-design/caresync-2-0/project/proto-rest.jsx
 * "composerLayout === 'prompted'" branch.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import posthog from "posthog-js";
import { MOOD_CHIP_CLS } from "@/lib/mood";

const MOODS = [
  { value: "good", label: "Good" },
  { value: "okay", label: "Okay" },
  { value: "difficult", label: "Difficult" },
  { value: "crisis", label: "Hard" },
];

type Props = {
  onPost: (text: string, mood: string) => Promise<void>;
  posting: boolean;
};

export function PromptedComposer({ onPost, posting }: Props) {
  const [today, setToday] = useState("");
  const [noticed, setNoticed] = useState("");
  const [flag, setFlag] = useState("");
  const [mood, setMood] = useState("");

  const combined = [
    today.trim() && `Today they — ${today.trim()}`,
    noticed.trim() && `What I noticed: ${noticed.trim()}`,
    flag.trim() && `Worth flagging: ${flag.trim()}`,
  ]
    .filter(Boolean)
    .join(" ");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!combined) return;
    posthog.capture("journal_entry_submitted", {
      mood: mood || null,
      char_count: combined.length,
      composer: "prompted",
    });
    await onPost(combined, mood);
    setToday("");
    setNoticed("");
    setFlag("");
    setMood("");
  }

  return (
    <Card className="shadow-sm gap-2" data-testid="prompted-composer">
      <CardHeader className="-mt-4 px-4 py-3 bg-[var(--color-primary-subtle)] border-b border-[var(--color-border)]">
        <CardTitle className="text-sm">Three quick questions</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label
              htmlFor="prompt-today"
              className="text-xs uppercase tracking-wide text-[var(--color-muted)]"
            >
              Today they…
            </Label>
            <Input
              id="prompt-today"
              value={today}
              onChange={(e) => setToday(e.target.value)}
              placeholder="woke up clearer than usual"
              className="mt-1"
            />
          </div>

          <div>
            <Label
              htmlFor="prompt-noticed"
              className="text-xs uppercase tracking-wide text-[var(--color-muted)]"
            >
              What I noticed
            </Label>
            <Input
              id="prompt-noticed"
              value={noticed}
              onChange={(e) => setNoticed(e.target.value)}
              placeholder="a small thing only you would catch"
              className="mt-1"
            />
          </div>

          <div>
            <Label
              htmlFor="prompt-flag"
              className="text-xs uppercase tracking-wide text-[var(--color-muted)]"
            >
              Worth flagging for the team or doctor?
            </Label>
            <Input
              id="prompt-flag"
              value={flag}
              onChange={(e) => setFlag(e.target.value)}
              placeholder="leave blank if not"
              className="mt-1"
            />
          </div>

          <div>
            <p className="text-xs text-[var(--color-muted)] mb-2">
              How is today going?
            </p>
            <div
              className="flex gap-2 flex-wrap"
              role="radiogroup"
              aria-label="Mood"
            >
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  data-mood={m.value}
                  role="radio"
                  aria-checked={mood === m.value}
                  onClick={() => setMood(mood === m.value ? "" : m.value)}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 ${
                    mood === m.value
                      ? MOOD_CHIP_CLS[m.value]
                      : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-slate-100"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={posting || !combined} size="sm">
              {posting ? "Saving..." : "Save entry"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
