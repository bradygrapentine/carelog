"use client";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { CareEventComment } from "@carelog/schemas";

type Props = {
  comment: CareEventComment;
  currentUserId: string;
  onEdit: (id: string, body: string) => void;
  onDelete: (id: string) => void;
};

export function CommentItem({
  comment,
  currentUserId,
  onEdit,
  onDelete,
}: Props) {
  const isAuthor = comment.authorId === currentUserId;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);

  if (editing) {
    return (
      <div className="flex flex-col gap-2 py-2">
        <Textarea
          aria-label="Edit comment body"
          value={draft}
          maxLength={4000}
          onChange={(e) => setDraft(e.target.value)}
          className="min-h-20"
        />
        <div className="flex gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(false);
              setDraft(comment.body);
            }}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!draft.trim() || draft.trim() === comment.body}
            onClick={() => {
              onEdit(comment.id, draft.trim());
              setEditing(false);
            }}
          >
            Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 py-2">
      <div
        aria-hidden="true"
        className="w-8 h-8 shrink-0 rounded-full bg-[var(--color-primary-subtle)] text-[var(--color-primary)] flex items-center justify-center text-sm font-medium"
      >
        {comment.authorName.slice(0, 1).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap text-xs text-[var(--color-muted)]">
          <span className="font-medium text-[var(--color-ink)]">
            {comment.authorName}
          </span>
          <time dateTime={comment.createdAt}>
            {new Date(comment.createdAt).toLocaleString()}
          </time>
          {comment.editedAt && (
            <span
              title={`Edited ${new Date(comment.editedAt).toLocaleString()}`}
            >
              · edited
            </span>
          )}
        </div>
        <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap break-words mt-0.5">
          {comment.body}
        </p>
      </div>
      {isAuthor && (
        <div className="flex gap-1 shrink-0">
          <button
            type="button"
            aria-label="Edit comment"
            onClick={() => setEditing(true)}
            className="p-2 rounded hover:bg-[var(--color-primary-subtle)] dark:hover:bg-[var(--color-primary-subtle)]/80 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
          >
            <Pencil size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Delete comment"
            onClick={() => {
              if (confirm("Delete this comment?")) onDelete(comment.id);
            }}
            className="p-2 rounded hover:bg-[var(--color-primary-subtle)] dark:hover:bg-[var(--color-primary-subtle)]/80 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
