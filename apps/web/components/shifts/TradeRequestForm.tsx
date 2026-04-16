"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Props = {
  shiftId: string;
  onSubmit: (
    targetUserId: string | undefined,
    message: string | undefined,
  ) => void;
  onCancel: () => void;
  disabled?: boolean;
};

const MAX_MESSAGE = 500;
const MESSAGE_WARN_THRESHOLD = 400;

export function TradeRequestForm({ onSubmit, onCancel, disabled }: Props) {
  const [message, setMessage] = useState("");
  const [isOpenTrade, setIsOpenTrade] = useState(true);
  const [targetUserId, setTargetUserId] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit(
      isOpenTrade ? undefined : targetUserId.trim() || undefined,
      message.trim() || undefined,
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      {/* Message */}
      <div className="space-y-1">
        <Label htmlFor="trade-message">
          Message{" "}
          <span className="text-[var(--color-muted)] font-normal">
            (optional)
          </span>
        </Label>
        <Textarea
          id="trade-message"
          name="trade-message"
          value={message}
          onChange={(e) => {
            if (e.target.value.length <= MAX_MESSAGE)
              setMessage(e.target.value);
          }}
          placeholder="Add a note for the other caregiver…"
          rows={3}
          disabled={disabled}
          className="focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
        />
        {message.length > MESSAGE_WARN_THRESHOLD && (
          <p className="text-xs text-[var(--color-muted)]" aria-live="polite">
            {MAX_MESSAGE - message.length} characters remaining
          </p>
        )}
      </div>

      {/* Open trade toggle */}
      <div className="flex items-center gap-2">
        <input
          id="open-trade"
          type="checkbox"
          checked={isOpenTrade}
          onChange={(e) => setIsOpenTrade(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 rounded border-[var(--color-border)] accent-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
        />
        <Label htmlFor="open-trade" className="cursor-pointer">
          Post as open trade
        </Label>
      </div>

      {/* Target user input — shown only when NOT open trade */}
      {!isOpenTrade && (
        <div className="space-y-1">
          <Label htmlFor="target-user-id">Target user ID</Label>
          <Input
            id="target-user-id"
            name="target-user-id"
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            placeholder="Target user ID"
            disabled={disabled}
            className="focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button
          type="submit"
          size="sm"
          disabled={disabled}
          className="focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
        >
          Request Trade
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={disabled}
          className="focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
