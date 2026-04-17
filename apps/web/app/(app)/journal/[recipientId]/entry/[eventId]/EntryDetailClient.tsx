"use client";

import { useEffect, useState } from "react";
import { FileX } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../../../../lib/supabase";
import { authenticatedFetch } from "../../../../../../lib/authenticatedFetch";

const MOOD_STYLES: Record<string, string> = {
  good: "bg-green-50 text-green-700",
  okay: "bg-yellow-50 text-yellow-700",
  difficult: "bg-orange-50 text-orange-700",
  crisis: "bg-red-50 text-red-700",
};

const REACTIONS = [
  { key: "heart", title: "Heart", emoji: "❤️" },
  { key: "thinking_of_you", title: "Thinking of you", emoji: "🤍" },
  { key: "strong", title: "Strong", emoji: "💪" },
  { key: "grateful", title: "Grateful", emoji: "🙏" },
] as const;

type ReactionKey = (typeof REACTIONS)[number]["key"];

type JournalEvent = {
  id: string;
  event_type: string;
  entry_kind: string;
  occurred_at: string;
  flagged: boolean;
  payload?: { text?: string; mood?: string };
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString([], {
      month: "long",
      day: "numeric",
      year: "numeric",
    }) +
    " at " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

type Props = {
  recipientId: string;
  eventId: string;
  userId: string;
};

export default function EntryDetailClient({
  recipientId,
  eventId,
  userId,
}: Props) {
  const router = useRouter();
  const [event, setEvent] = useState<JournalEvent | null>(null);
  const [canFlag, setCanFlag] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [myReaction, setMyReaction] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [flagging, setFlagging] = useState(false);

  useEffect(() => {
    if (!recipientId || !eventId) return;
    const supabase = createClient();

    async function loadData() {
      const res = await authenticatedFetch(
        "/api/journal?recipientId=" + recipientId,
      );
      const data = await res.json();
      if (data.events) {
        const found = data.events.find((e: JournalEvent) => e.id === eventId);
        if (!found) {
          router.push("/journal/" + recipientId);
          return;
        }
        setEvent(found);
      }

      // Resolve orgId from care_recipients so we can call /api/members correctly
      const { data: recipient } = await supabase
        .from("care_recipients")
        .select("org_id")
        .eq("id", recipientId)
        .single();

      if (recipient?.org_id) {
        const membersRes = await authenticatedFetch(
          "/api/members?orgId=" + recipient.org_id,
        );
        const membersData = await membersRes.json();
        if (membersData.members) {
          const me = membersData.members.find(
            (m: { user_id: string; role: string }) => m.user_id === userId,
          );
          if (me) setCanFlag(me.role !== "supporter");
        }
      }

      const reactRes = await fetch(
        "/api/journal/" + eventId + "/reactions?userId=" + userId,
      );
      const reactData = await reactRes.json();
      if (reactData.counts) setCounts(reactData.counts);
      setMyReaction(reactData.myReaction ?? null);

      setLoading(false);
    }

    loadData();
  }, [recipientId, eventId, userId]);

  async function handleFlag() {
    if (!event) return;
    setFlagging(true);
    await authenticatedFetch("/api/journal/" + event.id + "/flag", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flagged: !event.flagged, userId }),
    });
    setEvent((prev) => (prev ? { ...prev, flagged: !prev.flagged } : prev));
    setFlagging(false);
  }

  async function toggleReaction(reaction: ReactionKey) {
    const isToggleOff = myReaction === reaction;
    const next = { ...counts };
    if (isToggleOff) {
      next[reaction] = Math.max(0, (next[reaction] ?? 0) - 1);
      setCounts(next);
      setMyReaction(null);
      await fetch("/api/journal/" + eventId + "/reactions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
    } else {
      if (myReaction)
        next[myReaction] = Math.max(0, (next[myReaction] ?? 0) - 1);
      next[reaction] = (next[reaction] ?? 0) + 1;
      setCounts(next);
      setMyReaction(reaction);
      await fetch("/api/journal/" + eventId + "/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, reaction }),
      });
    }
  }

  const backUrl = "/journal/" + recipientId;

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-[var(--color-surface)] flex flex-col items-center justify-center gap-4 px-4 text-center">
        <FileX
          className="w-12 h-12 text-[var(--color-muted)]"
          aria-hidden="true"
        />
        <h1 className="text-lg font-semibold text-[var(--color-ink)]">
          Entry not found
        </h1>
        <p className="text-sm text-[var(--color-muted)] max-w-xs">
          This journal entry could not be loaded. It may have been deleted or
          you may not have access.
        </p>
        <a
          href={"/journal/" + recipientId}
          className="text-sm font-medium text-[var(--color-primary)] underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 rounded"
        >
          Back to journal
        </a>
      </div>
    );
  }

  const payload = event.payload ?? {};
  const moodClass =
    "text-xs px-2 py-1 rounded-full capitalize " +
    (MOOD_STYLES[payload.mood ?? ""] ??
      "bg-[var(--color-surface)] text-foreground/80");
  const flagBtnClass =
    "text-sm px-3 py-1.5 rounded-lg transition-colors " +
    (event.flagged
      ? "bg-[var(--color-primary-subtle)] text-primary hover:bg-primary/90"
      : "bg-[var(--color-surface)] text-foreground/80 hover:bg-muted");

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <nav className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => {
            router.push(backUrl);
          }}
          className="text-muted-foreground hover:text-foreground/80"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <span className="font-semibold text-foreground">Journal Entry</span>
      </nav>

      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-4">
            <p className="text-base text-foreground leading-relaxed flex-1">
              {payload.text}
            </p>
            {payload.mood && <span className={moodClass}>{payload.mood}</span>}
          </div>

          <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
            <p className="text-xs text-muted-foreground">
              {formatTime(event.occurred_at)}
            </p>
            <div className="flex items-center gap-2">
              {event.flagged && (
                <span className="text-xs text-primary bg-[var(--color-primary-subtle)] px-2 py-0.5 rounded-full">
                  Flagged for doctor
                </span>
              )}
              {canFlag && (
                <button
                  onClick={handleFlag}
                  disabled={flagging}
                  className={flagBtnClass}
                >
                  {event.flagged ? "Unflag" : "Flag for doctor"}
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {REACTIONS.map((r) => {
              const count = counts[r.key] ?? 0;
              const isActive = myReaction === r.key;
              const btnClass =
                "flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full transition-colors " +
                (isActive
                  ? "bg-[var(--color-primary-subtle)] text-primary"
                  : "bg-[var(--color-surface)] text-muted-foreground hover:bg-muted");
              return (
                <button
                  key={r.key}
                  title={r.title}
                  onClick={() => toggleReaction(r.key)}
                  className={btnClass}
                >
                  <span>{r.emoji}</span>
                  <span>{r.title}</span>
                  {count > 0 && <span className="font-medium">{count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
