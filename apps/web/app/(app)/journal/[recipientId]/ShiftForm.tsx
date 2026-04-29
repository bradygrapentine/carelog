"use client";

import { useState } from "react";
import { trpc } from "../../../../lib/trpc";
import { CardContent } from "@/components/ui/card";
import { TintedCard, TintedCardHeader } from "@/components/ui/tinted-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

// Duration options: value '0' means Custom (user provides end time directly)
const DURATION_OPTIONS = [
  { label: "1 hour", value: "1" },
  { label: "2 hours", value: "2" },
  { label: "4 hours", value: "4" },
  { label: "8 hours", value: "8" },
  { label: "Custom", value: "0" },
];

type Member = {
  id: string;
  role: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
};

type Props = {
  members: Member[];
  recipientId: string;
  orgId: string;
  onSuccess: () => void;
  // Edit mode — both must be present together
  shiftId?: string;
  initialValues?: {
    date: string; // YYYY-MM-DD
    startTime: string; // HH:MM
    endTime: string; // HH:MM
    assigneeId: string;
    notes: string;
  };
};

function addHoursToUtcIso(date: string, time: string, hours: number): string {
  const startMs = new Date(date + "T" + time + ":00Z").getTime();
  return new Date(startMs + hours * 3_600_000).toISOString();
}

export function ShiftForm({
  members,
  recipientId,
  orgId,
  onSuccess,
  shiftId,
  initialValues,
}: Props) {
  const isEditMode = !!shiftId;
  const [expanded, setExpanded] = useState(isEditMode); // edit mode starts expanded
  const [date, setDate] = useState(
    () => initialValues?.date ?? new Date().toISOString().slice(0, 10),
  );
  const [startTime, setStartTime] = useState(initialValues?.startTime ?? "");
  const [duration, setDuration] = useState("1"); // create mode default; edit mode uses isCustom override
  const [endTime, setEndTime] = useState(initialValues?.endTime ?? "");
  const [assigneeId, setAssigneeId] = useState(initialValues?.assigneeId ?? "");
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
  const [recurring, setRecurring] = useState(false);
  const [weeks, setWeeks] = useState("4");
  const [error, setError] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const createMutation = trpc.shifts.create.useMutation();
  const updateMutation = trpc.shifts.update.useMutation();

  // Supporters cannot be shift assignees
  const assignableMembers = members.filter((m) => m.role !== "supporter");
  const isCustom = isEditMode || duration === "0";
  const isPending = isEditMode
    ? updateMutation.isPending
    : createMutation.isPending;
  const canSubmit = !!assigneeId && !!startTime && !isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Read ALL form values synchronously before any await — ENTERPRISE_PRINCIPLES #5
    const d = date;
    const st = startTime;
    const dur = duration;
    const et = endTime;
    const aId = assigneeId;
    const n = notes.trim() || undefined;
    const rec = recurring;
    const w = parseInt(weeks, 10);

    // Force UTC by appending Z suffix — tests assert UTC timestamps
    const startAt = new Date(d + "T" + st + ":00Z").toISOString();
    const endAt =
      dur === "0" || isEditMode
        ? new Date(d + "T" + et + ":00Z").toISOString()
        : addHoursToUtcIso(d, st, parseInt(dur, 10));

    setError(null);
    try {
      if (isEditMode && shiftId) {
        await updateMutation.mutateAsync({
          id: shiftId,
          org_id: orgId,
          assignee_user_id: aId,
          notes: n,
        });
      } else {
        await createMutation.mutateAsync({
          org_id: orgId,
          recipient_id: recipientId,
          assignee_user_id: aId,
          start_at: startAt,
          end_at: endAt,
          notes: n,
          recurrence: rec ? { freq: "weekly", weeks: w } : undefined,
        });
        setExpanded(false);
        setDate(new Date().toISOString().slice(0, 10));
        setStartTime("");
        setDuration("1");
        setEndTime("");
        setAssigneeId("");
        setNotes("");
        setRecurring(false);
        setWeeks("4");
      }
      utils.shifts.list.invalidate();
      onSuccess();
    } catch (err: unknown) {
      const code = (err as { data?: { code?: string } })?.data?.code;
      if (code === "CONFLICT") {
        setError("This person already has a shift at that time.");
      } else {
        setError("The shift didn't save. Try again.");
      }
    }
  }

  const shiftForm = (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="shift-date"
            className="block text-xs font-medium text-foreground/80 mb-1"
          >
            Date
          </label>
          <Input
            id="shift-date"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setError(null);
            }}
          />
        </div>
        <div>
          <label
            htmlFor="shift-start"
            className="block text-xs font-medium text-foreground/80 mb-1"
          >
            Start time
          </label>
          <Input
            id="shift-start"
            type="time"
            step="1800"
            value={startTime}
            onChange={(e) => {
              setStartTime(e.target.value);
              setError(null);
            }}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Times are stored in UTC — enter local time carefully.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="shift-duration"
            className="block text-xs font-medium text-foreground/80 mb-1"
          >
            Duration
          </label>
          <select
            id="shift-duration"
            value={duration}
            onChange={(e) => {
              setDuration(e.target.value);
              setError(null);
            }}
            className="w-full text-sm border border-border rounded-xl px-3 py-2 focus:outline-none bg-card text-foreground"
          >
            {DURATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {isCustom && (
          <div>
            <label
              htmlFor="shift-end"
              className="block text-xs font-medium text-foreground/80 mb-1"
            >
              End time
            </label>
            <Input
              id="shift-end"
              type="time"
              value={endTime}
              onChange={(e) => {
                setEndTime(e.target.value);
                setError(null);
              }}
            />
          </div>
        )}
      </div>

      <Separator />

      <div>
        <label
          htmlFor="shift-assignee"
          className="block text-xs font-medium text-foreground/80 mb-1"
        >
          Assignee
        </label>
        <select
          id="shift-assignee"
          value={assigneeId}
          onChange={(e) => {
            setAssigneeId(e.target.value);
            setError(null);
          }}
          className="w-full text-sm border border-border rounded-xl px-3 py-2 focus:outline-none bg-card text-foreground"
        >
          <option value="">Select a caregiver...</option>
          {assignableMembers.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.display_name ?? (m.email ? m.email.split("@")[0] : m.user_id)}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground mt-1">
          Supporters are not shown — only caregivers, coordinators, and aides
          can be assigned shifts.
        </p>
      </div>

      <div>
        <label
          htmlFor="shift-notes"
          className="block text-xs font-medium text-foreground/80 mb-1"
        >
          Notes{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id="shift-notes"
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setError(null);
          }}
          maxLength={2000}
          rows={2}
          className="w-full text-sm border border-border rounded-xl px-3 py-2 focus:outline-none resize-none bg-card text-foreground"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Instructions or reminders visible to the assigned caregiver.
        </p>
      </div>

      <Separator />

      {/* Recurrence — hidden in edit mode */}
      {!isEditMode && (
        <>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-sm text-foreground/80">
                Repeat weekly for
              </span>
            </label>
            {recurring && (
              <select
                value={weeks}
                onChange={(e) => setWeeks(e.target.value)}
                className="text-sm border border-border rounded-xl px-2 py-1 focus:outline-none bg-card text-foreground"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                  <option key={n} value={String(n)}>
                    {n} {n === 1 ? "week" : "weeks"}
                  </option>
                ))}
              </select>
            )}
          </div>
          {recurring && (
            <p className="text-xs text-muted-foreground -mt-1">
              Creates one shift per week at the same day and time.
            </p>
          )}
        </>
      )}

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <Separator />

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setExpanded(false);
            setError(null);
            onSuccess(); // collapse inline edit panel in parent
          }}
          className="text-muted-foreground"
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {isPending
            ? isEditMode
              ? "Saving..."
              : "Scheduling..."
            : isEditMode
              ? "Save changes"
              : recurring
                ? "Schedule " + weeks + " shifts"
                : "Schedule shift"}
        </Button>
      </div>
    </form>
  );

  // Mobile: collapsed by default behind a toggle
  // Desktop (lg+): always expanded
  return (
    <TintedCard>
      {/* Mobile toggle — hidden in edit mode (always expanded) */}
      <TintedCardHeader
        title={isEditMode ? "Edit shift" : "Schedule a shift"}
        action={
          !isEditMode ? (
            !expanded ? (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="text-sm text-muted-foreground hover:text-foreground/80 transition-colors"
              >
                + New shift
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setExpanded(false);
                  setError(null);
                }}
                className="text-sm text-muted-foreground hover:text-foreground/80 transition-colors"
              >
                Cancel
              </button>
            )
          ) : undefined
        }
      />

      <CardContent className="pt-4">
        {/* Toggle button: mobile only, hidden in edit mode / when expanded */}
        {!isEditMode && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-sm text-muted-foreground hover:text-foreground/80 transition-colors"
          >
            + Schedule a shift
          </button>
        )}

        {/* Form: edit mode always visible; create mode shown when expanded */}
        <div className={isEditMode || expanded ? "block" : "hidden"}>
          {shiftForm}
        </div>
      </CardContent>
    </TintedCard>
  );
}
