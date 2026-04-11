"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const MOOD_DOT: Record<string, string> = {
  good: "bg-green-500",
  okay: "bg-amber-400",
  difficult: "bg-orange-500",
  crisis: "bg-red-500",
};

const MOOD_BADGE: Record<string, string> = {
  good: "bg-green-50 text-green-700 border-green-200",
  okay: "bg-yellow-50 text-yellow-700 border-yellow-200",
  difficult: "bg-orange-50 text-orange-700 border-orange-200",
  crisis: "bg-red-50 text-red-700 border-red-200",
};

const REACTIONS = [
  { key: "heart", title: "Heart", emoji: "❤️" },
  { key: "thinking_of_you", title: "Thinking of you", emoji: "🤍" },
  { key: "strong", title: "Strong", emoji: "💪" },
  { key: "grateful", title: "Grateful", emoji: "🙏" },
] as const;

type ReactionKey = (typeof REACTIONS)[number]["key"];

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (diffDays === 1) {
    return (
      "Yesterday " +
      d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  } else {
    return (
      d.toLocaleDateString([], { month: "short", day: "numeric" }) +
      " " +
      d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  }
}

function useReactions(eventId: string, userId: string | null) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [myReaction, setMyReaction] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const url = "/api/journal/" + eventId + "/reactions?userId=" + userId;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.counts) setCounts(data.counts);
        setMyReaction(data.myReaction ?? null);
      });
  }, [eventId, userId]);

  async function toggle(reaction: ReactionKey) {
    if (!userId) return;

    const prevCounts = { ...counts };
    const prevMyReaction = myReaction;
    const isToggleOff = myReaction === reaction;

    // Optimistic update
    const next = { ...counts };
    if (isToggleOff) {
      next[reaction] = Math.max(0, (next[reaction] ?? 0) - 1);
      setCounts(next);
      setMyReaction(null);
    } else {
      if (myReaction) {
        next[myReaction] = Math.max(0, (next[myReaction] ?? 0) - 1);
      }
      next[reaction] = (next[reaction] ?? 0) + 1;
      setCounts(next);
      setMyReaction(reaction);
    }

    try {
      const url = "/api/journal/" + eventId + "/reactions";
      if (isToggleOff) {
        await fetch(url, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
      } else {
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, reaction }),
        });
      }
    } catch {
      // Rollback on network error
      setCounts(prevCounts);
      setMyReaction(prevMyReaction);
    }
  }

  return { counts, myReaction, toggle };
}

type JournalEvent = {
  id: string;
  event_type: string;
  entry_kind: string;
  occurred_at: string;
  flagged: boolean;
  payload?: { text?: string; mood?: string };
};

type CardProps = {
  event: JournalEvent;
  currentUserId: string | null;
  canFlag: boolean;
  recipientId: string;
  onFlag: (eventId: string, flagged: boolean) => void;
};

function JournalCard({
  event,
  currentUserId,
  canFlag,
  recipientId,
  onFlag,
}: CardProps) {
  const payload = event.payload ?? {};
  const { counts, myReaction, toggle } = useReactions(event.id, currentUserId);

  const flagBtnClass =
    "text-xs px-2 py-0.5 rounded-full transition-colors " +
    (event.flagged
      ? "text-primary hover:text-primary/80"
      : "text-muted-foreground hover:text-primary");

  const detailUrl = "/journal/" + recipientId + "/entry/" + event.id;

  return (
    <Card
      data-testid="journal-entry"
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => {
        window.location.href = detailUrl;
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3 mb-3">
          {payload.mood && (
            <span
              className={
                "mt-1 w-2 h-2 rounded-full shrink-0 " +
                (MOOD_DOT[payload.mood] ?? "bg-slate-300")
              }
            />
          )}
          <p className="text-sm text-[var(--color-text-primary)] leading-relaxed flex-1">
            {payload.text}
          </p>
          {payload.mood && (
            <Badge
              variant="outline"
              className={
                "shrink-0 capitalize text-xs " +
                (MOOD_BADGE[payload.mood] ?? "")
              }
            >
              {payload.mood}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-[var(--color-muted)]">
            {formatTime(event.occurred_at)}
          </p>
          <div className="flex items-center gap-2">
            {event.flagged && (
              <span className="text-xs text-[var(--color-primary)] bg-[var(--color-primary-subtle)] px-2 py-0.5 rounded-full">
                Flagged for doctor
              </span>
            )}
            {canFlag && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFlag(event.id, !event.flagged);
                }}
                className={flagBtnClass}
              >
                {event.flagged ? "Unflag" : "Flag for doctor"}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 pt-2 border-t border-[var(--color-border)]">
          {REACTIONS.map((r) => {
            const count = counts[r.key] ?? 0;
            const isActive = myReaction === r.key;
            const btnClass =
              "flex items-center gap-1 text-sm px-2 py-0.5 rounded-full transition-colors " +
              (isActive
                ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
                : "text-[var(--color-muted)] hover:text-[var(--color-text-secondary)]");
            return (
              <button
                key={r.key}
                title={r.title}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(r.key);
                }}
                className={btnClass}
              >
                {r.emoji}
                {count > 0 && <span>{count}</span>}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

type Props = {
  events: JournalEvent[];
  currentUserId: string | null;
  canFlag: boolean;
  recipientId: string;
  onFlag: (eventId: string, flagged: boolean) => void;
};

function formatDateHeader(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const todayStr = now.toDateString();
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);

  if (d.toDateString() === todayStr) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function dateKey(iso: string) {
  return new Date(iso).toDateString();
}

export function JournalTimeline({
  events,
  currentUserId,
  canFlag,
  recipientId,
  onFlag,
}: Props) {
  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-muted)] text-sm">
          {canFlag
            ? "No entries yet. Share how today is going above."
            : "No entries have been shared yet."}
        </p>
      </div>
    );
  }

  const seenDates = new Set<string>();

  return (
    <div className="space-y-4">
      {events.map((event) => {
        const isHuman = event.entry_kind === "human";
        const dk = dateKey(event.occurred_at);
        const showHeader = !seenDates.has(dk);
        if (showHeader) seenDates.add(dk);

        return (
          <div key={event.id}>
            {showHeader && (
              <div className="flex items-center gap-3 py-2">
                <span className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wide">
                  {formatDateHeader(event.occurred_at)}
                </span>
                <div className="flex-1 h-px bg-[var(--color-border)]" />
              </div>
            )}
            {isHuman && event.event_type === "journal" ? (
              <JournalCard
                event={event}
                currentUserId={currentUserId}
                canFlag={canFlag}
                recipientId={recipientId}
                onFlag={onFlag}
              />
            ) : (
              <div className="flex items-center gap-3 py-2 px-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-border)] shrink-0" />
                <p className="text-xs text-[var(--color-muted)] flex-1">
                  {event.event_type} logged
                </p>
                <p className="text-xs text-[var(--color-muted)]">
                  {formatTime(event.occurred_at)}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
