"use client";
import { useCallback, useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { createClient } from "@/lib/supabase";
import { CommentItem } from "./CommentItem";
import { CommentComposer } from "./CommentComposer";
import type { CareEventComment } from "@carelog/schemas";

type Props = { careEventId: string; currentUserId: string };

export function CommentThread({ careEventId, currentUserId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const utils = trpc.useUtils();
  const { data: comments = [], refetch } =
    trpc.careEvents.comments.list.useQuery(
      { careEventId },
      { enabled: expanded },
    );
  const add = trpc.careEvents.comments.add.useMutation({
    onSuccess: () => refetch(),
    onError: () => toast.error("Could not add comment — please try again"),
  });
  const edit = trpc.careEvents.comments.edit.useMutation({
    onSuccess: () => refetch(),
    onError: () => toast.error("Could not edit comment — please try again"),
  });
  const remove = trpc.careEvents.comments.remove.useMutation({
    onMutate: async ({ commentId }) => {
      await utils.careEvents.comments.list.cancel({ careEventId });
      utils.careEvents.comments.list.setData({ careEventId }, (old) =>
        (old ?? []).filter((c) => c.id !== commentId),
      );
    },
    onSettled: () => refetch(),
    onError: () => toast.error("Could not delete comment — please try again"),
  });

  useEffect(() => {
    if (!expanded) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`care_event_comments:${careEventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_event_comments",
          filter: `care_event_id=eq.${careEventId}`,
        },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [careEventId, expanded, refetch]);

  const count = comments.length;
  const label =
    count === 0 ? "Add a comment" : `${count} comment${count === 1 ? "" : "s"}`;
  const toggle = useCallback(() => setExpanded((e) => !e), []);

  return (
    <section className="border-t border-[var(--color-border)] dark:border-gray-700 bg-[var(--color-primary-subtle)]/40 dark:bg-gray-800">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        data-testid="comment-toggle"
        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-[var(--color-text-secondary)] dark:text-gray-300 hover:bg-[var(--color-primary-subtle)] dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 dark:focus:ring-offset-gray-800"
      >
        <MessageSquare size={16} aria-hidden="true" />
        <span>{label}</span>
      </button>
      {expanded && (
        <div className="px-4 pb-3">
          <ul
            className="divide-y divide-[var(--color-border)] dark:divide-gray-700"
            aria-label="Comments"
          >
            {comments.map((c) => (
              <li key={c.id}>
                <CommentItem
                  comment={c}
                  currentUserId={currentUserId}
                  onEdit={(id, body) => edit.mutate({ commentId: id, body })}
                  onDelete={(id) => remove.mutate({ commentId: id })}
                />
              </li>
            ))}
          </ul>
          <CommentComposer
            disabled={add.isPending}
            onSubmit={async (body) => {
              await add.mutateAsync({ careEventId, body });
            }}
          />
        </div>
      )}
    </section>
  );
}
