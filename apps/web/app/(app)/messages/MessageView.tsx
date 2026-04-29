"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { trpc } from "../../../lib/trpc";
import { MessageComposer } from "./MessageComposer";
import { formatLocaleDate } from "@/lib/format";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return formatLocaleDate(iso);
}

type MessageRow = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  sender?: { display_name?: string | null } | null;
};

export function MessageView() {
  const params = useSearchParams();
  const threadId = params?.get("thread") ?? null;
  const bottomRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const { data: rawMessages = [], isLoading } =
    trpc.messages.getMessages.useQuery(
      { threadId: threadId! },
      { enabled: !!threadId },
    );

  const messages = rawMessages as unknown as MessageRow[];

  const markRead = trpc.messages.markRead.useMutation();

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Mark as read when thread is viewed
  useEffect(() => {
    if (!threadId) return;
    markRead.mutate({ threadId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  // Supabase Realtime subscription
  useEffect(() => {
    if (!threadId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `thread_id=eq.${threadId}`,
        },
        () => {
          void utils.messages.getMessages.invalidate({ threadId });
          markRead.mutate({ threadId });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  if (!threadId) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-muted)]">
        Select a conversation to start messaging
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-muted)]">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div
        role="log"
        aria-label="Messages"
        aria-live="polite"
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col gap-0.5 max-w-xl">
            <span className="text-xs text-[var(--color-muted)]">
              {msg.sender?.display_name ?? "Unknown"} ·{" "}
              {relativeTime(msg.created_at)}
            </span>
            {msg.deleted_at ? (
              <p className="text-sm italic text-[var(--color-muted)]">
                Message deleted
              </p>
            ) : (
              <p className="text-sm bg-[var(--color-surface)] rounded-lg px-3 py-2 break-words">
                {msg.body}
              </p>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <MessageComposer threadId={threadId} />
    </div>
  );
}
