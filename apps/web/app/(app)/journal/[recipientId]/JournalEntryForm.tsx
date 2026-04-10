"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import posthog from "posthog-js";

const PROMPTS = [
  "How did they seem today?",
  "Anything the doctor should know?",
  "What was hard today?",
  "Was there a moment of connection?",
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
  {
    value: "good",
    label: "Good",
    color: "bg-green-100 text-green-800 border-green-200",
  },
  {
    value: "okay",
    label: "Okay",
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  {
    value: "difficult",
    label: "Difficult",
    color: "bg-orange-100 text-orange-800 border-orange-200",
  },
  {
    value: "crisis",
    label: "Crisis",
    color: "bg-red-100 text-red-800 border-red-200",
  },
];

interface Props {
  onPost: (text: string, mood: string) => Promise<void>;
  posting: boolean;
}

export function JournalEntryForm({ onPost, posting }: Props) {
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
    posthog.capture("journal_entry_submitted", { mood: mood || null, char_count: text.trim().length });
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
            placeholder="Share how today went..."
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
                How is today going?
              </p>
              <div className="flex gap-2 flex-wrap mb-4">
                {MOODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMood(mood === m.value ? "" : m.value)}
                    className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                      mood === m.value
                        ? m.color
                        : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-slate-100"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

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
                  {posting ? "Sharing..." : "Share update"}
                </Button>
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
