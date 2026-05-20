"use client";

/**
 * ON-79b — Tasks destination panel. List + click-to-open create form, with an
 * in-panel detail view (TaskDetail) for the selected task.
 *
 * Authz: the server (ON-77 RLS + tasks_update_guard trigger) is the true gate.
 * v1 gates the *create* affordance to coordinators (the task_permissions
 * default); a permitted non-coordinator in a widened org would not see the
 * button yet — acceptable until a task_permissions config UI exists (follow-up).
 *
 * PHI (ADR-0001): never pass task title/instructions/checklist into analytics.
 */

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "../../../../lib/trpc";
import type { ChecklistItem } from "@carelog/schemas";
import { TintedCard, TintedCardHeader } from "@/components/ui/tinted-card";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TaskDetail } from "./TaskDetail";

type Member = {
  id: string;
  role: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
};

type Props = {
  orgId: string;
  recipientId: string;
  members: Member[];
  currentUserRole: string;
};

const STATUS_LABEL: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

export function TasksPanel({
  orgId,
  recipientId,
  members,
  currentUserRole,
}: Props) {
  const utils = trpc.useUtils();
  const canManage = currentUserRole === "coordinator";

  const { data: tasks, isLoading } = trpc.tasks.list.useQuery({
    recipient_id: recipientId,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [checklist, setChecklist] = useState<string[]>([]);

  const createMutation = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.list.invalidate();
      toast.success("Task created");
      resetForm();
    },
    onError: (err) => {
      toast.error(
        err.data?.code === "FORBIDDEN" ? "Not allowed" : "Couldn't create task",
      );
    },
  });

  function resetForm() {
    setShowCreate(false);
    setTitle("");
    setInstructions("");
    setChecklist([]);
  }

  function handleCreate() {
    const trimmed = title.trim();
    if (!trimmed) {
      toast.error("Title is required");
      return;
    }
    const items: ChecklistItem[] = checklist
      .map((label) => label.trim())
      .filter((label) => label.length > 0)
      .map((label) => ({ label, done: false }));
    createMutation.mutate({
      recipient_id: recipientId,
      title: trimmed,
      instructions: instructions.trim() || null,
      checklist: items,
    });
  }

  if (selectedId) {
    const selected = (tasks ?? []).find((t) => t.id === selectedId);
    if (!selected) {
      // The task vanished (cancelled/refetch) — fall back to the list.
      setSelectedId(null);
      return null;
    }
    return (
      <TaskDetail
        task={selected}
        orgId={orgId}
        recipientId={recipientId}
        members={members}
        currentUserRole={currentUserRole}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <TintedCard>
      <TintedCardHeader
        title="Tasks"
        action={
          canManage ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCreate((v) => !v)}
              aria-expanded={showCreate}
            >
              {showCreate ? "Cancel" : "+ Task"}
            </Button>
          ) : undefined
        }
      />
      <CardContent className="pt-2 space-y-4">
        {showCreate && canManage && (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <div>
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Refill prescriptions"
                maxLength={200}
              />
            </div>
            <div>
              <Label htmlFor="task-instructions">Instructions</Label>
              <Textarea
                id="task-instructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Optional details"
                rows={3}
                maxLength={10000}
              />
            </div>
            <div className="space-y-2">
              <Label>Checklist</Label>
              {checklist.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={item}
                    onChange={(e) =>
                      setChecklist((prev) =>
                        prev.map((v, j) => (j === i ? e.target.value : v)),
                      )
                    }
                    placeholder={`Item ${i + 1}`}
                    maxLength={200}
                    aria-label={`Checklist item ${i + 1}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove checklist item ${i + 1}`}
                    onClick={() =>
                      setChecklist((prev) => prev.filter((_, j) => j !== i))
                    }
                  >
                    ✕
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setChecklist((prev) => [...prev, ""])}
              >
                + Checklist item
              </Button>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={resetForm}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Creating…" : "Create task"}
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading tasks…</p>
        ) : (tasks ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tasks yet.
            {canManage ? " Add one with “+ Task” above." : ""}
          </p>
        ) : (
          <ul className="space-y-1">
            {(tasks ?? []).map((task) => (
              <li key={task.id}>
                <button
                  onClick={() => setSelectedId(task.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
                >
                  <span
                    className={
                      task.status === "done" || task.status === "cancelled"
                        ? "text-sm text-muted-foreground line-through"
                        : "text-sm text-foreground"
                    }
                  >
                    {task.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {STATUS_LABEL[task.status] ?? task.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </TintedCard>
  );
}
