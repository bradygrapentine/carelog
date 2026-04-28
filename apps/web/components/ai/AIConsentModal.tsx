"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  onEnable: () => void;
  onDismiss: () => void;
};

export function AIConsentModal({ onEnable, onDismiss }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Move focus into modal on open
    const firstFocusable = containerRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();
  }, []);

  useEffect(() => {
    // Trap focus within modal
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onDismiss();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = containerRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-consent-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div
        ref={containerRef}
        className="bg-card rounded-2xl shadow-2xl border border-[var(--color-border)] p-6 max-w-sm w-full space-y-4"
      >
        <div className="space-y-1">
          <h2
            id="ai-consent-title"
            className="text-base font-bold text-[var(--color-ink)]"
          >
            ✦ Enable AI Assistant
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
            To answer your questions, the assistant reads your org&apos;s care
            data (schedules, medication logs, mood entries) and sends a
            de-identified summary to the Claude AI API.
          </p>
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
            <strong>Names and free-text notes are never sent</strong> unless you
            paste them in a prompt.
          </p>
        </div>
        <div className="space-y-2">
          <Button
            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90"
            onClick={onEnable}
          >
            Enable AI Assistant
          </Button>
          <Button
            variant="ghost"
            className="w-full text-[var(--color-muted)]"
            onClick={onDismiss}
          >
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}
