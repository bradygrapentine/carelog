"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import type { Shift } from "./ShiftCalendar";

type Props = {
  shift: Shift | null;
  isOpen: boolean;
  onClose: () => void;
  isCoordinator: boolean;
  orgId: string;
  recipientId: string;
  onEdit: (shift: Shift) => void;
  onCancel: (shiftId: string) => void;
  onCompleted?: () => void;
};

export function ShiftPopover({
  shift,
  isOpen,
  onClose,
  isCoordinator,
  orgId,
  recipientId,
  onEdit,
  onCancel,
  onCompleted,
}: Props) {
  const [showHandoff, setShowHandoff] = useState(false);
  const [handoffNote, setHandoffNote] = useState("");

  const utils = trpc.useUtils();

  const completeMutation = trpc.shifts.complete.useMutation({
    onSuccess: () => {
      utils.shifts.list.invalidate();
      setShowHandoff(true);
    },
  });

  const insertEventMutation = trpc.careEvents.insert.useMutation({
    onSuccess: () => {
      utils.careEvents.timeline.invalidate();
    },
  });

  useEffect(() => {
    if (!isOpen) {
      setShowHandoff(false);
      setHandoffNote("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!shift) return null;

  function handleComplete() {
    if (!shift) return;
    completeMutation.mutate({
      id: shift.id,
      org_id: orgId,
    });
  }

  function handleSubmitHandoff() {
    if (!handoffNote.trim()) return;
    insertEventMutation.mutate(
      {
        orgId,
        recipientId,
        eventType: "handoff",
        entryKind: "human",
        payload: { text: handoffNote.trim() },
      },
      {
        onSuccess: () => {
          onCompleted?.();
          onClose();
        },
      },
    );
  }

  function handleSkipHandoff() {
    onCompleted?.();
    onClose();
  }

  const start = new Date(shift.start_at).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const end = new Date(shift.end_at).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  const statusColors: Record<string, string> = {
    scheduled: "text-[var(--color-primary)]",
    in_progress: "text-[var(--color-success)]",
    completed: "text-[var(--color-muted)]",
    cancelled: "text-[var(--color-muted)]",
  };

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events -- backdrop dismissal; Esc keyboard handler at line 59 covers keyboard close. TD-* should migrate to Dialog primitive.
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Shift details"
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/20 ${isOpen ? "" : "hidden"}`}
      onClick={onClose}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- pure stop-propagation guard so backdrop click doesn't fire when interacting inside the modal; no semantic interactive surface here. */}
      <div
        className="bg-white rounded-xl shadow-xl border border-[var(--color-border)] p-5 w-72 space-y-3"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-[var(--color-ink)]">
            Shift Details
          </h3>
          <button
            onClick={onClose}
            className="text-[var(--color-muted)] hover:text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] rounded"
            aria-label="Close shift details"
          >
            ✕
          </button>
        </div>

        <div className="text-sm space-y-1">
          <p className="text-[var(--color-text-primary)]">
            <span className="font-medium">Assignee:</span>{" "}
            {shift.assigned_display_name ?? (
              <span className="text-[var(--color-danger)]">Unassigned</span>
            )}
          </p>
          <p className="text-[var(--color-text-primary)]">
            <span className="font-medium">Time:</span> {start} – {end}
          </p>
          <p
            className={`capitalize text-xs font-semibold ${statusColors[shift.status] ?? ""}`}
          >
            {shift.status.replace("_", " ")}
          </p>
        </div>

        {isCoordinator && shift.status !== "cancelled" && !showHandoff && (
          <div className="flex gap-2 pt-1 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(shift)}
              className="flex-1"
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onCancel(shift.id)}
              className="flex-1"
            >
              Cancel
            </Button>
            {shift.status !== "completed" && (
              <Button
                size="sm"
                variant="default"
                onClick={handleComplete}
                disabled={completeMutation.isPending}
                className="w-full mt-1"
              >
                {completeMutation.isPending ? "Completing…" : "Complete shift"}
              </Button>
            )}
          </div>
        )}

        {showHandoff && (
          <div className="pt-2 space-y-2">
            <p className="text-xs font-semibold text-[var(--color-ink)]">
              Handoff note{" "}
              <span className="font-normal text-[var(--color-muted)]">
                (optional)
              </span>
            </p>
            <label htmlFor="handoff-note" className="sr-only">
              Handoff note
            </label>
            <Textarea
              id="handoff-note"
              value={handoffNote}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setHandoffNote(e.target.value)
              }
              placeholder="Anything the next caregiver should know…"
              rows={3}
              className="text-sm resize-none"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={handleSubmitHandoff}
                disabled={!handoffNote.trim() || insertEventMutation.isPending}
                className="flex-1"
              >
                {insertEventMutation.isPending ? "Saving…" : "Submit note"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSkipHandoff}
                className="flex-1"
              >
                Skip
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
