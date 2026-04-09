"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const ROLES = ["caregiver", "coordinator", "aide"] as const;

interface Props {
  orgId: string;
  recipientId: string;
}

export default function CoverageSettings({ orgId, recipientId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [label, setLabel] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startsAt, setStartsAt] = useState("07:00");
  const [endsAt, setEndsAt] = useState("12:00");
  const [requiredRole, setRequiredRole] = useState<string>("");

  const utils = trpc.useUtils();

  const listQuery = trpc.coverageWindows.list.useQuery(
    { org_id: orgId, recipient_id: recipientId },
    { enabled: expanded }
  );

  const createMutation = trpc.coverageWindows.create.useMutation({
    onSuccess: () => {
      utils.coverageWindows.list.invalidate();
      setLabel("");
    },
  });

  const deleteMutation = trpc.coverageWindows.delete.useMutation({
    onSuccess: () => {
      utils.coverageWindows.list.invalidate();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input: Parameters<typeof createMutation.mutate>[0] = {
      org_id: orgId,
      recipient_id: recipientId,
      label,
      starts_at: startsAt,
      ends_at: endsAt,
      day_of_week: dayOfWeek,
      recurring: true as const,
    };
    if (requiredRole) {
      input.required_role = requiredRole as "caregiver" | "coordinator" | "aide";
    }
    createMutation.mutate(input);
  }

  function handleDelete(id: string) {
    deleteMutation.mutate({ id, org_id: orgId });
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <h3 className="text-sm font-semibold text-gray-700">
          Coverage expectations
        </h3>
        <span className="text-gray-400 text-xs">
          {expanded ? "Collapse" : "Expand"}
        </span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {listQuery.isLoading && (
            <p className="text-sm text-gray-400">Loading...</p>
          )}

          {listQuery.data && listQuery.data.length === 0 && (
            <p className="text-sm text-gray-400">
              No coverage windows defined yet.
            </p>
          )}

          {listQuery.data &&
            listQuery.data.map((w: Record<string, unknown>) => {
              const windowId = w.id as string;
              const windowLabel = w.label as string;
              const windowDay = w.day_of_week as number;
              const windowStart = w.starts_at as string;
              const windowEnd = w.ends_at as string;
              const windowRole = w.required_role as string | null;
              const dayName = DAY_NAMES[windowDay] || "Unknown";
              const timeRange = windowStart + " - " + windowEnd;

              return (
                <div
                  key={windowId}
                  className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                >
                  <div>
                    <span className="text-sm font-medium text-gray-800">
                      {windowLabel}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">
                      {dayName}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">
                      {timeRange}
                    </span>
                    {windowRole && (
                      <span className="ml-2 inline-block text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                        {windowRole}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(windowId)}
                    className="text-xs text-red-500 hover:text-red-700"
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </button>
                </div>
              );
            })}

          <form onSubmit={handleSubmit} className="space-y-3 pt-2 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-600">
              Add coverage window
            </p>

            <input
              type="text"
              placeholder="Label (e.g. Weekday morning)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              maxLength={200}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />

            <div className="grid grid-cols-2 gap-3">
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {DAY_NAMES.map((name, i) => (
                  <option key={name} value={i}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={requiredRole}
                onChange={(e) => setRequiredRole(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Role (optional)</option>
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Start time</label>
                <input
                  type="time"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">End time</label>
                <input
                  type="time"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={createMutation.isPending || !label}
              className="w-full bg-blue-600 text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? "Adding..." : "Add window"}
            </button>

            {createMutation.isError && (
              <p className="text-xs text-red-500">
                {createMutation.error.message}
              </p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
