"use client";

// ON-81: in-app task-notification feed + task-notification preference toggles.
// The feed is RLS-scoped server-side (owner-only). PHI: notification rows are
// the caller's own; nothing here goes to analytics.

import Link from "next/link";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { TintedCard, TintedCardHeader } from "@/components/ui/tinted-card";
import { CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

const TYPE_LABEL: Record<string, string> = {
  task_assigned: "Task assigned",
  task_completed: "Task completed",
  task_created: "Task created",
};

const PREF_ROWS: {
  key: "task_assigned" | "task_completed" | "task_created";
  label: string;
}[] = [
  { key: "task_assigned", label: "When a task is assigned to me" },
  { key: "task_completed", label: "When a task I care about is completed" },
  { key: "task_created", label: "When a new task is created" },
];

export function NotificationsClient() {
  const utils = trpc.useUtils();
  const { data: feed, isLoading } = trpc.notifications.listInApp.useQuery();
  const { data: prefs } = trpc.notifications.taskPrefs.useQuery();

  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => utils.notifications.listInApp.invalidate(),
    onError: () => toast.error("Couldn't update notification"),
  });

  const setPrefs = trpc.notifications.setTaskPrefs.useMutation({
    onSuccess: () => {
      utils.notifications.taskPrefs.invalidate();
      toast.success("Preferences saved");
    },
    onError: () => toast.error("Couldn't save preferences"),
  });

  function togglePref(key: (typeof PREF_ROWS)[number]["key"]) {
    if (!prefs) return;
    setPrefs.mutate({
      task_assigned: prefs.task_assigned,
      task_completed: prefs.task_completed,
      task_created: prefs.task_created,
      [key]: !prefs[key],
    });
  }

  return (
    <>
      <TintedCard>
        <TintedCardHeader title="Notifications" />
        <CardContent className="pt-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (feed ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You&rsquo;re all caught up — no notifications.
            </p>
          ) : (
            <ul className="space-y-1">
              {(feed ?? []).map((n) => {
                const unread = n.read_at === null;
                const inner = (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">
                        {TYPE_LABEL[n.type] ?? n.type}
                      </span>
                      <p className="text-sm text-foreground">
                        {n.title ?? n.body ?? "Task update"}
                      </p>
                    </div>
                    {unread && (
                      <span
                        className="mt-1 size-2 shrink-0 rounded-full bg-[var(--color-primary)]"
                        aria-label="Unread"
                      />
                    )}
                  </div>
                );
                const cls =
                  "block w-full rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 " +
                  (unread ? "bg-[var(--color-primary-subtle)]" : "");
                return (
                  <li key={n.id}>
                    {n.task_id && n.recipient_id ? (
                      <Link
                        href={`/journal/${n.recipient_id}?panel=tasks`}
                        className={cls}
                        onClick={() => unread && markRead.mutate({ id: n.id })}
                      >
                        {inner}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className={cls}
                        onClick={() => unread && markRead.mutate({ id: n.id })}
                      >
                        {inner}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </TintedCard>

      <TintedCard>
        <TintedCardHeader title="Task notification preferences" />
        <CardContent className="pt-2 space-y-3">
          {PREF_ROWS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <input
                id={`pref-${key}`}
                type="checkbox"
                checked={prefs ? prefs[key] : false}
                disabled={!prefs || setPrefs.isPending}
                onChange={() => togglePref(key)}
                className="size-4 accent-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
              />
              <Label htmlFor={`pref-${key}`} className="text-sm font-normal">
                {label}
              </Label>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Email also requires your account&rsquo;s email notifications to be
            on.
          </p>
        </CardContent>
      </TintedCard>
    </>
  );
}
