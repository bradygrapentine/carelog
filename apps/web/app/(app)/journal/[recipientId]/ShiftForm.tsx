"use client";

import { useState } from "react";
import { trpc } from "../../../../lib/trpc";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// Duration options: value '0' means Custom (user provides end time directly)
const DURATION_OPTIONS = [
  { label: "1 hour", value: "1" },
  { label: "2 hours", value: "2" },
  { label: "4 hours", value: "4" },
  { label: "8 hours", value: "8" },
  { label: "Custom", value: "0" },
];

interface Member {
  id: string;
  role: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
}

interface Props {
  members: Member[];
  recipientId: string;
  orgId: string;
  onSuccess: () => void;
}

function addHoursToUtcIso(date: string, time: string, hours: number): string {
  const startMs = new Date(date + "T" + time + ":00Z").getTime();
  return new Date(startMs + hours * 3_600_000).toISOString();
}

export function ShiftForm({ members, recipientId, orgId, onSuccess }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState("");
  const [duration, setDuration] = useState("1");
  const [endTime, setEndTime] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [notes, setNotes] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [weeks, setWeeks] = useState("4");
  const [error, setError] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const createMutation = trpc.shifts.create.useMutation();

  // Supporters cannot be shift assignees
  const assignableMembers = members.filter((m) => m.role !== "supporter");
  const isCustom = duration === "0";
  const canSubmit = !!assigneeId && !!startTime && !createMutation.isPending;

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
      dur === "0"
        ? new Date(d + "T" + et + ":00Z").toISOString()
        : addHoursToUtcIso(d, st, parseInt(dur, 10));

    setError(null);
    try {
      await createMutation.mutateAsync({
        org_id: orgId,
        recipient_id: recipientId,
        assignee_user_id: aId,
        start_at: startAt,
        end_at: endAt,
        notes: n,
        recurrence: rec ? { freq: "weekly", weeks: w } : undefined,
      });
      utils.shifts.list.invalidate();
      setExpanded(false);
      setDate(new Date().toISOString().slice(0, 10));
      setStartTime("");
      setDuration("1");
      setEndTime("");
      setAssigneeId("");
      setNotes("");
      setRecurring(false);
      setWeeks("4");
      onSuccess();
    } catch (err: unknown) {
      const code = (err as { data?: { code?: string } })?.data?.code;
      if (code === "CONFLICT") {
        setError("This person already has a shift at that time.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
  }

  if (!expanded) {
    return (
      <Card>
        <CardContent className="pt-4">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-sm text-[var(--color-muted)] hover:text-gray-600 transition-colors"
          >
            + Schedule a shift
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Schedule a shift</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="shift-date"
                className="block text-xs text-gray-500 mb-1"
              >
                Date
              </label>
              <input
                id="shift-date"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setError(null);
                }}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
              />
            </div>
            <div>
              <label
                htmlFor="shift-start"
                className="block text-xs text-gray-500 mb-1"
              >
                Start time
              </label>
              <input
                id="shift-start"
                type="time"
                step="1800"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value);
                  setError(null);
                }}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label
                htmlFor="shift-duration"
                className="block text-xs text-gray-500 mb-1"
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
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
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
                  className="block text-xs text-gray-500 mb-1"
                >
                  End time
                </label>
                <input
                  id="shift-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => {
                    setEndTime(e.target.value);
                    setError(null);
                  }}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
                />
              </div>
            )}
          </div>

          <div className="mb-3">
            <label
              htmlFor="shift-assignee"
              className="block text-xs text-gray-500 mb-1"
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
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
            >
              <option value="">Select a caregiver...</option>
              {assignableMembers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.display_name ?? m.email ?? m.user_id}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-3">
            <label
              htmlFor="shift-notes"
              className="block text-xs text-gray-500 mb-1"
            >
              Notes (optional)
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
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400 resize-none"
            />
          </div>

          <div className="mb-4 flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-600">Repeat weekly for</span>
            </label>
            {recurring && (
              <select
                value={weeks}
                onChange={(e) => setWeeks(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-gray-400"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                  <option key={n} value={String(n)}>
                    {n} {n === 1 ? "week" : "weeks"}
                  </option>
                ))}
              </select>
            )}
          </div>

          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setExpanded(false);
                setError(null);
              }}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createMutation.isPending
                ? "Scheduling..."
                : recurring
                  ? "Schedule " + weeks + " shifts"
                  : "Schedule shift"}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
