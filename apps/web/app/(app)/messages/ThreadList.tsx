"use client";

import { trpc } from "../../../lib/trpc";
import { cn } from "@/lib/utils";
import { useSearchParams, useRouter } from "next/navigation";

type ThreadRow = {
  id: string;
  thread_type: string;
  name?: string | null;
  unread_count?: number;
  last_message_body?: string | null;
  members?: Array<{ user_id: string; display_name?: string | null }>;
};

type Props = {
  orgId: string | null;
  userId: string;
};

export function ThreadList({ orgId, userId }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const activeThreadId = params?.get("thread") ?? null;

  const { data: rawThreads = [], isLoading } =
    trpc.messages.listThreads.useQuery(
      { orgId: orgId! },
      { enabled: !!orgId, refetchInterval: 30_000 },
    );

  const threads = rawThreads as unknown as ThreadRow[];

  if (!orgId) {
    return (
      <p className="px-4 py-6 text-sm text-[var(--color-muted)]">
        No organisation found.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-14 rounded-lg bg-[var(--color-border)] animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <nav aria-label="Message threads" className="p-2 space-y-1">
      <h2 className="px-2 py-1 text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide">
        Messages
      </h2>
      {threads.length === 0 && (
        <p className="px-2 py-4 text-sm text-[var(--color-muted)]">
          No conversations yet. Start one from the Team page.
        </p>
      )}
      {threads.map((thread) => {
        const isActive = thread.id === activeThreadId;
        const unread = thread.unread_count ?? 0;
        const label =
          thread.thread_type === "dm"
            ? (thread.members?.find((m) => m.user_id !== userId)
                ?.display_name ?? "DM")
            : (thread.name ?? "Group");

        return (
          <button
            key={thread.id}
            type="button"
            onClick={() => router.push(`/messages?thread=${thread.id}`)}
            aria-label={`Open conversation: ${label}${unread > 0 ? `, ${unread} unread` : ""}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2",
              isActive
                ? "bg-[var(--color-primary-subtle)] text-[var(--color-ink)]"
                : "hover:bg-[var(--color-surface)] text-[var(--color-text-primary)]",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{label}</span>
              {unread > 0 && (
                <span
                  aria-hidden="true"
                  className="shrink-0 text-xs font-bold px-1.5 py-0.5 rounded-full bg-[var(--color-primary-pressed)] text-white"
                >
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </div>
            {thread.last_message_body && (
              <p className="text-xs text-[var(--color-muted)] truncate mt-0.5">
                {thread.last_message_body}
              </p>
            )}
          </button>
        );
      })}
    </nav>
  );
}
