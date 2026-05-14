"use client";

import { MessageCircle } from "lucide-react";
import { AIActionCard } from "./AIActionCard";

type Message = {
  role: "user" | "assistant";
  content: string;
  action?: { type: string; description: string } | null;
  citationSlug?: string | null;
  citationTitle?: string | null;
};

type Props = {
  messages: Message[];
  onConfirmAction: (actionType: string, description: string) => void;
  onCancelAction: (messageIndex: number) => void;
  actionPending?: number | null;
  actionError?: string | null;
};

export function AIChatThread({
  messages,
  onConfirmAction,
  onCancelAction,
  actionPending,
  actionError,
}: Props) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
        <MessageCircle
          className="w-10 h-10 text-[var(--color-muted)]"
          aria-hidden="true"
        />
        <p className="text-sm text-[var(--color-muted)]">
          Ask me anything about your care recipient&apos;s care
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 py-2">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[85%] space-y-2 ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}
          >
            <div
              className={`px-3 py-2 rounded-xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-[var(--color-primary-pressed)] text-white rounded-br-sm"
                  : "bg-[var(--color-surface)] text-[var(--color-text-primary)] rounded-bl-sm border border-[var(--color-border)]"
              }`}
            >
              {/* SECURITY: LLM output rendered as JSX text — never wrap in dangerouslySetInnerHTML or any HTML/markdown renderer without sanitization. PHI/XSS invariant. See TD-131 / docs/security/2026-05-14-owasp-audit.md FIND-006. */}
              {msg.content}
            </div>
            {msg.citationSlug && (
              <a
                href={`/education/${msg.citationSlug}`}
                className="flex items-center gap-1.5 text-xs text-[var(--color-primary)] bg-[var(--color-primary-subtle)] px-2 py-1 rounded-lg hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <span>📚</span>
                <span>{msg.citationTitle ?? "Education Guide"} →</span>
              </a>
            )}
            {msg.action && (
              <AIActionCard
                actionType={msg.action.type}
                description={msg.action.description}
                onConfirm={() =>
                  onConfirmAction(msg.action!.type, msg.action!.description)
                }
                onCancel={() => onCancelAction(i)}
                isPending={actionPending === i}
                error={actionPending === i ? (actionError ?? null) : null}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
