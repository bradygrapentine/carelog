"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

type LikesDislikesListProps = {
  likes: string[];
  dislikes: string[];
  /** Required when canEdit is true. */
  orgId?: string;
  /** Required when canEdit is true. */
  recipientId?: string;
  /** Default false; non-coordinator path is read-only. */
  canEdit?: boolean;
  className?: string;
};

const FOCUS_RING =
  "focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2";

function ReadOnlyColumn({
  label,
  items,
}: {
  label: "LIKES" | "DISLIKES";
  items: string[];
}) {
  return (
    <section aria-labelledby={`ldl-heading-${label.toLowerCase()}`}>
      <p
        id={`ldl-heading-${label.toLowerCase()}`}
        className="eyebrow-mono mb-2"
      >
        {label}
      </p>
      <ul
        aria-label={label}
        className="list-disc list-inside space-y-1 text-sm text-[var(--color-text-primary)]"
      >
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
      {items.length === 0 && (
        <p className="text-sm text-[var(--color-muted)]">
          Nothing recorded yet.
        </p>
      )}
    </section>
  );
}

function ReadOnlyView({
  likes,
  dislikes,
  className,
}: {
  likes: string[];
  dislikes: string[];
  className?: string;
}) {
  return (
    <div
      className={["grid grid-cols-1 gap-4 sm:grid-cols-2", className ?? ""]
        .join(" ")
        .trim()}
    >
      <ReadOnlyColumn label="LIKES" items={likes} />
      <ReadOnlyColumn label="DISLIKES" items={dislikes} />
    </div>
  );
}

function EditableColumn({
  label,
  items,
  onChange,
}: {
  label: "LIKES" | "DISLIKES";
  items: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <section aria-labelledby={`ldl-heading-${label.toLowerCase()}`}>
      <p
        id={`ldl-heading-${label.toLowerCase()}`}
        className="eyebrow-mono mb-2"
      >
        {label}
      </p>
      <ul aria-label={label} className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2">
            <Input
              type="text"
              value={item}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                onChange(next);
              }}
              maxLength={120}
              className="flex-1 text-sm"
              aria-label={`${label} item ${i + 1}`}
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              aria-label={`Remove ${item}`}
              className={`text-sm text-[var(--color-muted)] hover:text-[var(--color-danger)] px-2 ${FOCUS_RING} rounded`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        disabled={items.length >= 50}
        className={`mt-2 text-sm text-[var(--color-primary)] hover:underline ${FOCUS_RING} rounded disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        + Add
      </button>
    </section>
  );
}

function EditableView({
  initialLikes,
  initialDislikes,
  orgId,
  recipientId,
  className,
}: {
  initialLikes: string[];
  initialDislikes: string[];
  orgId: string;
  recipientId: string;
  className?: string;
}) {
  // Seeded once from props; subsequent prop changes only re-flow on remount.
  // router.refresh() after Save triggers a server re-render so the NEXT mount
  // sees the updated values. Within an edit session, the user's draft is the
  // source of truth.
  const [likes, setLikes] = useState(initialLikes);
  const [dislikes, setDislikes] = useState(initialDislikes);
  const [isEditing, setIsEditing] = useState(false);
  const router = useRouter();

  const updateMutation = trpc.recipients.updatePreferences.useMutation({
    onSuccess: (data) => {
      setLikes(data.likes);
      setDislikes(data.dislikes);
      setIsEditing(false);
      router.refresh();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to save preferences.");
    },
  });

  function handleEdit() {
    setIsEditing(true);
  }

  function handleCancel() {
    setLikes(initialLikes);
    setDislikes(initialDislikes);
    setIsEditing(false);
  }

  function handleSave() {
    // Strip whitespace-only entries before submit (zod will also reject; we
    // strip client-side so the user doesn't see a confusing field-level error
    // for a row they likely meant to remove).
    const cleanedLikes = likes.map((s) => s.trim()).filter((s) => s.length > 0);
    const cleanedDislikes = dislikes
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    updateMutation.mutate({
      org_id: orgId,
      recipient_id: recipientId,
      likes: cleanedLikes,
      dislikes: cleanedDislikes,
    });
  }

  if (!isEditing) {
    return (
      <div className={["space-y-3", className ?? ""].join(" ").trim()}>
        <ReadOnlyView likes={likes} dislikes={dislikes} />
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleEdit}
            className={FOCUS_RING}
          >
            Edit
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={["space-y-4", className ?? ""].join(" ").trim()}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <EditableColumn label="LIKES" items={likes} onChange={setLikes} />
        <EditableColumn
          label="DISLIKES"
          items={dislikes}
          onChange={setDislikes}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          disabled={updateMutation.isPending}
          className={FOCUS_RING}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className={FOCUS_RING}
        >
          {updateMutation.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

export function LikesDislikesList({
  likes,
  dislikes,
  orgId,
  recipientId,
  canEdit,
  className,
}: LikesDislikesListProps) {
  // Read-only render path — no tRPC hooks reached here. Existing tests stay
  // green without a tRPC provider.
  if (!canEdit || !orgId || !recipientId) {
    return (
      <ReadOnlyView likes={likes} dislikes={dislikes} className={className} />
    );
  }
  return (
    <EditableView
      initialLikes={likes}
      initialDislikes={dislikes}
      orgId={orgId}
      recipientId={recipientId}
      className={className}
    />
  );
}
