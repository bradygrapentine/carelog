"use client";

/**
 * ON-79b — Task detail view: title, plain-text instructions, a clickable
 * checklist, a shift picker, and Complete/Cancel actions.
 *
 * XSS (FIND-006): instructions render as PLAIN TEXT inside JSX (React escapes
 * it) — we never inject raw HTML for user-supplied content.
 *
 * Checklist toggle persists the FULL updated checklist via tasks.update
 * (last-write-wins — two members toggling concurrently clobber; acceptable v1).
 *
 * Authz is enforced server-side (ON-77 RLS + trigger). v1 gates the editable
 * controls to coordinators; on a FORBIDDEN mutation we toast "Not allowed".
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "../../../../lib/trpc";
import type { ChecklistItem } from "@carelog/schemas";
import { TintedCard, TintedCardHeader } from "@/components/ui/tinted-card";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Member = {
  id: string;
  role: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
};

export type TaskRowLike = {
  id: string;
  title: string;
  instructions: string | null;
  checklist: unknown;
  status: string;
  shift_id: string | null;
  assigned_to: string | null;
  due_at: string | null;
};

type Props = {
  task: TaskRowLike;
  orgId: string;
  recipientId: string;
  members: Member[];
  currentUserRole: string;
  onBack: () => void;
};

function parseChecklist(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is ChecklistItem =>
      typeof x === "object" &&
      x !== null &&
      typeof (x as { label?: unknown }).label === "string" &&
      typeof (x as { done?: unknown }).done === "boolean",
  );
}

export function TaskDetail({
  task,
  orgId,
  recipientId,
  currentUserRole,
  onBack,
}: Props) {
  const utils = trpc.useUtils();
  const canManage = currentUserRole === "coordinator";
  const checklist = parseChecklist(task.checklist);
  const isClosed = task.status === "done" || task.status === "cancelled";

  // React-19 purity: anchor "now" once; derive the window deterministically.
  const [now] = useState(() => new Date().toISOString());
  const toIso = useMemo(
    () =>
      new Date(
        new Date(now).getTime() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    [now],
  );

  const { data: shifts } = trpc.shifts.list.useQuery(
    { org_id: orgId, recipient_id: recipientId, from: now, to: toIso },
    { enabled: Boolean(orgId) },
  );

  const onMutationError = (err: { data?: { code?: string } | null }) => {
    toast.error(
      err.data?.code === "FORBIDDEN" ? "Not allowed" : "Update failed",
    );
  };
  const refresh = () => utils.tasks.list.invalidate();

  const updateMutation = trpc.tasks.update.useMutation({
    onSuccess: refresh,
    onError: onMutationError,
  });
  const completeMutation = trpc.tasks.complete.useMutation({
    onSuccess: () => {
      refresh();
      toast.success("Task completed");
    },
    onError: onMutationError,
  });
  const cancelMutation = trpc.tasks.cancel.useMutation({
    onSuccess: () => {
      refresh();
      toast.success("Task cancelled");
    },
    onError: onMutationError,
  });

  function toggleItem(index: number) {
    const next = checklist.map((item, i) =>
      i === index ? { ...item, done: !item.done } : item,
    );
    updateMutation.mutate({ id: task.id, checklist: next });
  }

  function setShift(value: string) {
    updateMutation.mutate({ id: task.id, shift_id: value || null });
  }

  return (
    <TintedCard>
      <TintedCardHeader
        title={task.title}
        action={
          <Button variant="ghost" size="sm" onClick={onBack}>
            ← Back
          </Button>
        }
      />
      <CardContent className="pt-2 space-y-4">
        {task.instructions && (
          <p className="whitespace-pre-wrap text-sm text-foreground">
            {task.instructions}
          </p>
        )}

        {checklist.length > 0 && (
          <div className="space-y-1">
            <Label>Checklist</Label>
            <ul className="space-y-1">
              {checklist.map((item, i) => (
                <li key={i}>
                  <button
                    onClick={() => toggleItem(i)}
                    disabled={
                      !canManage || isClosed || updateMutation.isPending
                    }
                    aria-pressed={item.done}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
                  >
                    <span aria-hidden="true">{item.done ? "☑" : "☐"}</span>
                    <span
                      className={
                        item.done ? "line-through text-muted-foreground" : ""
                      }
                    >
                      {item.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {canManage && (
          <div>
            <Label htmlFor="task-shift">Pin to shift</Label>
            <select
              id="task-shift"
              value={task.shift_id ?? ""}
              onChange={(e) => setShift(e.target.value)}
              disabled={isClosed || updateMutation.isPending}
              className="w-full text-sm border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 bg-card text-foreground disabled:opacity-60"
            >
              <option value="">No shift</option>
              {(shifts ?? []).map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {new Date(shift.start_at).toLocaleString()}
                </option>
              ))}
            </select>
          </div>
        )}

        {canManage && !isClosed && (
          <div className="flex justify-end gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => cancelMutation.mutate({ id: task.id })}
              disabled={cancelMutation.isPending}
            >
              Cancel task
            </Button>
            <Button
              size="sm"
              onClick={() => completeMutation.mutate({ id: task.id })}
              disabled={completeMutation.isPending}
            >
              Complete
            </Button>
          </div>
        )}
      </CardContent>
    </TintedCard>
  );
}
