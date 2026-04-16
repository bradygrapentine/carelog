"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import type { Shift } from "./ShiftCalendar";

type Props = {
  shift: Shift | null;
  isOpen: boolean;
  onClose: () => void;
  isCoordinator: boolean;
  onEdit: (shift: Shift) => void;
  onCancel: (shiftId: string) => void;
};

export function ShiftPopover({
  shift,
  isOpen,
  onClose,
  isCoordinator,
  onEdit,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!shift) return null;

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
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Shift details"
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/20 ${isOpen ? "" : "hidden"}`}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl border border-[var(--color-border)] p-5 w-72 space-y-3"
        onClick={(e) => e.stopPropagation()}
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

        {isCoordinator && shift.status !== "cancelled" && (
          <div className="flex gap-2 pt-1">
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
          </div>
        )}
      </div>
    </div>
  );
}
