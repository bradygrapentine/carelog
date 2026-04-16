"use client";

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAIContext, type Suggestion } from "@/hooks/useAIContext";
import { AIChatThread } from "./AIChatThread";

type Message = {
  role: "user" | "assistant";
  content: string;
  action?: { type: string; description: string } | null;
  citationSlug?: string | null;
  citationTitle?: string | null;
};

type Props = {
  orgId: string;
  recipientId?: string;
  onClose: () => void;
};

export function AIPanel({ orgId, recipientId, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [actionPending, setActionPending] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { pageKey, suggestions, globalSuggestions } = useAIContext();

  const queryMutation = trpc.ai.query.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response, action: data.action },
      ]);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  function sendPrompt(prompt: string) {
    if (!prompt.trim()) return;
    setMessages((prev) => [...prev, { role: "user", content: prompt }]);
    setInput("");
    queryMutation.mutate({
      prompt,
      pageContext: pageKey as Parameters<
        typeof queryMutation.mutate
      >[0]["pageContext"],
      orgId,
      recipientId,
    });
  }

  function handleConfirmAction(_actionType: string, _description: string) {
    // Route to the appropriate existing tRPC mutation per action type.
    // Each action type corresponds to an existing router procedure:
    //   send_message       → trpc.messages.send (requires thread_id + body)
    //   log_mood           → trpc.moodEntries.create (requires mood + org_id + recipient_id)
    //   suggest_shift      → trpc.shifts.create (requires start_at + end_at + org_id — coordinator only)
    //   log_medication_dose → trpc.medications.logDose (requires medication_id + status + org_id)
    //
    // For v1: dismiss the action card. Full deep-link integration is a follow-up.
    setActionPending(null);
  }

  function handleCancelAction(messageIndex: number) {
    setMessages((prev) =>
      prev.map((m, i) => (i === messageIndex ? { ...m, action: null } : m)),
    );
  }

  const contextLabel =
    pageKey !== "other"
      ? pageKey.charAt(0).toUpperCase() + pageKey.slice(1)
      : undefined;

  return (
    <div
      role="complementary"
      aria-label="AI Assistant"
      className="fixed bottom-20 right-4 z-40 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-[var(--color-primary)] flex flex-col max-h-[70vh]"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-primary)] rounded-t-2xl">
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-sm">✦ AI Assistant</span>
          {contextLabel && (
            <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">
              {contextLabel}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white focus:outline-none focus:ring-2 focus:ring-white rounded text-lg leading-none"
          aria-label="Close AI Assistant"
        >
          ✕
        </button>
      </div>

      {/* Scroll area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
        {messages.length === 0 && (
          <div className="space-y-2 py-2">
            {suggestions.length > 0 && (
              <>
                <p className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wide">
                  Suggested for this page
                </p>
                {suggestions.map((s: Suggestion) => (
                  <button
                    key={s.prompt}
                    onClick={() => sendPrompt(s.prompt)}
                    className="w-full text-left text-xs bg-[var(--color-primary-subtle)] text-[var(--color-primary)] px-3 py-2 rounded-lg hover:bg-[var(--color-primary)] hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  >
                    {s.label}
                  </button>
                ))}
              </>
            )}
            {globalSuggestions.length > 0 && (
              <>
                <p className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wide mt-2">
                  Always available
                </p>
                {globalSuggestions.map((s: Suggestion) => (
                  <button
                    key={s.prompt}
                    onClick={() => sendPrompt(s.prompt)}
                    className="w-full text-left text-xs bg-[var(--color-surface)] text-[var(--color-text-secondary)] px-3 py-2 rounded-lg hover:bg-[var(--color-primary-subtle)] hover:text-[var(--color-primary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  >
                    {s.label}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
        <AIChatThread
          messages={messages}
          onConfirmAction={handleConfirmAction}
          onCancelAction={handleCancelAction}
          actionPending={actionPending}
          actionError={actionError}
        />
        {queryMutation.isPending && (
          <div className="flex justify-start py-1">
            <div className="text-xs text-[var(--color-muted)] animate-pulse">
              ✦ Thinking…
            </div>
          </div>
        )}
        {queryMutation.isError && (
          <p className="text-xs text-[var(--color-danger)] py-1" role="alert">
            Couldn&apos;t reach the AI right now — try again in a moment.
          </p>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-[var(--color-border)] flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && !e.shiftKey && sendPrompt(input)
          }
          placeholder="Ask anything…"
          aria-label="Ask the AI assistant"
          className="flex-1 text-sm bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          disabled={queryMutation.isPending}
        />
        <button
          onClick={() => sendPrompt(input)}
          disabled={queryMutation.isPending || !input.trim()}
          aria-label="Send message"
          className="bg-[var(--color-primary)] text-white rounded-lg px-3 py-2 text-sm hover:bg-[var(--color-primary)]/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1"
        >
          →
        </button>
      </div>
    </div>
  );
}
