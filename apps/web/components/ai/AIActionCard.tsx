"use client";

import { Button } from "@/components/ui/button";

type Props = {
  actionType: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  isPending?: boolean;
  error?: string | null;
};

export function AIActionCard({
  actionType,
  description,
  onConfirm,
  onCancel,
  isPending,
  error,
}: Props) {
  const labels: Record<string, string> = {
    send_message: "Send message",
    log_mood: "Log mood entry",
    suggest_shift: "Apply shift suggestion",
    log_medication_dose: "Log medication dose",
  };

  return (
    <div
      role="region"
      aria-label="Proposed action"
      className="border border-[var(--color-secondary)] bg-[var(--color-secondary-subtle)] rounded-lg p-3 space-y-2"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm" aria-hidden="true">
          ⚠️
        </span>
        <p className="text-xs font-bold text-[var(--color-secondary)] uppercase tracking-wide">
          {labels[actionType] ?? "Proposed action"}
        </p>
      </div>
      <p className="text-sm text-[var(--color-text-primary)]">{description}</p>
      {error && (
        <p className="text-xs text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={onConfirm}
          disabled={isPending}
          className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90"
        >
          {isPending ? "Applying…" : "Confirm"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
