"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import posthog from "posthog-js";
import { MOOD_CHIP_CLS, type Mood } from "@/lib/mood";
import { PromptedComposer } from "@/components/journal/PromptedComposer";
import { MoodSpectrum } from "@/components/journal/MoodSpectrum";

const PROMPTS = [
  "How did they seem today?",
  "Anything the doctor should know?",
  "What was hard today?",
  "Anything you want to remember about today?",
  "Any changes in sleep or appetite?",
  "What are you noticing lately?",
  "How are you holding up?",
  "Anything that felt different today?",
  "What went well today?",
  "Any concerns for the next appointment?",
  "How did medications go today?",
  "Any visitors or calls that helped?",
];

function pickPrompts(n: number) {
  const shuffled = [...PROMPTS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

const MOODS = [
  { value: "good", label: "Good" },
  { value: "okay", label: "Okay" },
  { value: "difficult", label: "Difficult" },
  { value: "crisis", label: "Hard" },
];

/**
 * UX-059 — composer mode.
 *  - "standard": existing freeform textarea + chip mood picker (default).
 *  - "prompted": three-question structured composer (PromptedComposer).
 *  - "spectrum": standard freeform body, but the mood picker uses the
 *    segmented MoodSpectrum control instead of pill chips.
 */
export type ComposerMode = "standard" | "prompted" | "spectrum";

type Props = {
  onPost: (text: string, mood: string) => Promise<void>;
  posting: boolean;
  /** UX-059 — optional composer variant. Defaults to "standard". */
  mode?: ComposerMode;
};

export function JournalEntryForm({
  onPost,
  posting,
  mode = "standard",
}: Props) {
  // UX-059 — short-circuit to the prompted variant when requested.
  if (mode === "prompted") {
    return <PromptedComposer onPost={onPost} posting={posting} />;
  }

  return (
    <StandardJournalEntryForm onPost={onPost} posting={posting} mode={mode} />
  );
}

function StandardJournalEntryForm({
  onPost,
  posting,
  mode,
}: {
  onPost: (text: string, mood: string) => Promise<void>;
  posting: boolean;
  mode: ComposerMode;
}) {
  const [text, setText] = useState("");
  const [mood, setMood] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [prompts, setPrompts] = useState<string[]>([]);

  function expand() {
    if (!expanded) {
      setExpanded(true);
      setPrompts(pickPrompts(3));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    posthog.capture("journal_entry_submitted", {
      mood: mood || null,
      char_count: text.trim().length,
    });
    await onPost(text.trim(), mood);
    setText("");
    setMood("");
    setExpanded(false);
    setPrompts([]);
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <form onSubmit={handleSubmit}>
          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              expand();
            }}
            onFocus={expand}
            placeholder="What happened today? Even one line is enough."
            rows={expanded ? 4 : 2}
            className="border-0 rounded-none resize-none focus-visible:ring-0 focus-visible:ring-offset-0 px-4 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-muted)]"
          />

          {expanded && (
            <div className="px-4 pb-4">
              {!text && (
                <div className="mb-4">
                  <p className="text-xs text-[var(--color-muted)] mb-2">
                    Need a starting point?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {prompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setText(prompt + " ")}
                        className="text-xs px-3 py-1 rounded-full border border-[var(--color-border)] text-[var(--color-muted)] hover:border-slate-400 hover:text-[var(--color-text-secondary)] transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-[var(--color-muted)] mb-2">
                How did today feel?
              </p>
              {mode === "spectrum" ? (
                <div className="mb-4">
                  <MoodSpectrum
                    value={mood as Mood | ""}
                    onChange={(m) => setMood(m)}
                  />
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap mb-4">
                  {MOODS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      data-mood={m.value}
                      aria-pressed={mood === m.value}
                      onClick={() => setMood(mood === m.value ? "" : m.value)}
                      className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                        mood === m.value
                          ? MOOD_CHIP_CLS[m.value]
                          : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-slate-100"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setExpanded(false);
                    setText("");
                    setMood("");
                    setPrompts([]);
                  }}
                  className="text-sm text-[var(--color-muted)] hover:text-[var(--color-text-secondary)]"
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  disabled={posting || !text.trim()}
                  size="sm"
                >
                  {posting ? "Posting..." : "Post to journal"}
                </Button>
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
