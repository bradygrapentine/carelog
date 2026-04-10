"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const REQUEST_TYPES = [
  { label: "Meal", value: "meal" },
  { label: "Transport", value: "transport" },
  { label: "Errand", value: "errand" },
  { label: "Visit", value: "visit" },
  { label: "Other", value: "other" },
] as const;

interface Props {
  recipientId: string;
  orgId: string;
  currentUserRole: string;
}

export function OuterCirclePanel({
  recipientId,
  orgId,
  currentUserRole,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requestType, setRequestType] = useState<
    "meal" | "transport" | "errand" | "visit" | "other"
  >("meal");
  const [slotsTotal, setSlotsTotal] = useState("1");
  const [neededBy, setNeededBy] = useState("");
  const [error, setError] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const { data: requests = [] } = trpc.outerCircle.list.useQuery(
    { org_id: orgId, recipient_id: recipientId },
    { enabled: expanded && currentUserRole === "coordinator" },
  );

  const createMutation = trpc.outerCircle.create.useMutation();
  const deactivateMutation = trpc.outerCircle.deactivate.useMutation();

  if (currentUserRole !== "coordinator") return null;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    // Read all form values synchronously before any await
    const t = title.trim();
    const d = description.trim() || undefined;
    const rt = requestType;
    const st = parseInt(slotsTotal, 10);
    const nb = neededBy ? new Date(neededBy).toISOString() : undefined;

    if (!t) {
      setError("Title is required.");
      return;
    }

    setError(null);
    try {
      await createMutation.mutateAsync({
        org_id: orgId,
        recipient_id: recipientId,
        title: t,
        description: d,
        request_type: rt,
        slots_total: st,
        needed_by: nb,
      });
      utils.outerCircle.list.invalidate();
      setShowForm(false);
      setTitle("");
      setDescription("");
      setRequestType("meal");
      setSlotsTotal("1");
      setNeededBy("");
    } catch {
      setError("Something went wrong. Please try again.");
    }
  }

  async function handleDeactivate(id: string) {
    try {
      await deactivateMutation.mutateAsync({ id, org_id: orgId });
      utils.outerCircle.list.invalidate();
    } catch {
      // silent — UI will refresh
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
            + Volunteer requests
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm">Volunteer requests</CardTitle>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-xs text-[var(--color-muted)] hover:text-gray-600"
        >
          Collapse
        </button>
      </CardHeader>

      <CardContent>
        {requests.filter((r) => r.active).length > 0 && (
          <div className="mb-4 space-y-3">
            {requests
              .filter((r) => r.active)
              .map((req) => {
                const shareUrl =
                  typeof window !== "undefined"
                    ? window.location.origin + "/care/" + req.share_token
                    : "/care/" + req.share_token;
                return (
                  <div key={req.id} className="bg-gray-50 rounded-lg px-3 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {req.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {req.slots_filled}/{req.slots_total} slots filled
                        </p>
                        <a
                          href={shareUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline mt-0.5 block truncate"
                        >
                          {shareUrl}
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeactivate(req.id)}
                        disabled={deactivateMutation.isPending}
                        className="text-xs text-red-500 hover:text-red-700 whitespace-nowrap disabled:opacity-50"
                      >
                        Deactivate
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {!showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            + New request
          </button>
        ) : (
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label
                htmlFor="oc-title"
                className="block text-xs text-gray-500 mb-1"
              >
                Title
              </label>
              <input
                id="oc-title"
                type="text"
                required
                maxLength={200}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setError(null);
                }}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
                placeholder="Meals needed this week"
              />
            </div>

            <div>
              <label
                htmlFor="oc-description"
                className="block text-xs text-gray-500 mb-1"
              >
                Description (optional)
              </label>
              <textarea
                id="oc-description"
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400 resize-none"
                placeholder="Any details helpers should know..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="oc-type"
                  className="block text-xs text-gray-500 mb-1"
                >
                  Type
                </label>
                <select
                  id="oc-type"
                  value={requestType}
                  onChange={(e) =>
                    setRequestType(e.target.value as typeof requestType)
                  }
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
                >
                  {REQUEST_TYPES.map((rt) => (
                    <option key={rt.value} value={rt.value}>
                      {rt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="oc-slots"
                  className="block text-xs text-gray-500 mb-1"
                >
                  Slots needed
                </label>
                <select
                  id="oc-slots"
                  value={slotsTotal}
                  onChange={(e) => setSlotsTotal(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
                >
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="oc-needed-by"
                className="block text-xs text-gray-500 mb-1"
              >
                Needed by (optional)
              </label>
              <input
                id="oc-needed-by"
                type="date"
                value={neededBy}
                onChange={(e) => setNeededBy(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-400"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setError(null);
                }}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {createMutation.isPending ? "Creating..." : "Create request"}
              </button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
