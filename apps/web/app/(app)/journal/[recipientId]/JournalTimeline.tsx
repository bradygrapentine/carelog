"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "../../../../lib/trpc";
import { MedicationChipBar } from "@/components/medications/MedicationChipBar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { BookOpen } from "lucide-react";
import { CommentThread } from "@/components/care-events/CommentThread";

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
  const router = useRouter();
  const payload = event.payload ?? {};
  const { counts, myReaction, toggle } = useReactions(event.id, currentUserId);

  const flagBtnClass =
    "text-xs px-2 py-0.5 rounded-full transition-colors " +
    (event.flagged
      ? "text-primary hover:text-primary/80"
      : "text-muted-foreground hover:text-primary");

  const detailUrl = "/journal/" + recipientId + "/entry/" + event.id;

  return (
    <div>
      <Card
        data-testid="journal-entry"
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => {
          router.push(detailUrl);
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
      <CommentThread careEventId={event.id} currentUserId={currentUserId!} />
    </div>
  );
}

type MedicationOption = {
  id: string;
  drug_name: string;
  brand_name: string | null;
};

type Props = {
  events: JournalEvent[];
  currentUserId: string | null;
  canFlag: boolean;
  recipientId: string;
  onFlag: (eventId: string, flagged: boolean) => void;
  medications?: MedicationOption[];
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

type MoodFilter = "good" | "okay" | "difficult" | "crisis";
type KindFilter = "human" | "system";

const MOOD_CHIP_CLS: Record<MoodFilter, string> = {
  good: "bg-green-100 text-green-800 border-green-300",
  okay: "bg-yellow-100 text-yellow-800 border-yellow-300",
  difficult: "bg-orange-100 text-orange-800 border-orange-300",
  crisis: "bg-red-100 text-red-800 border-red-300",
};

function Chip({
  label,
  active,
  activeCls,
  onClick,
}: {
  label: string;
  active: boolean;
  activeCls: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-2.5 py-1 text-xs rounded-full border transition-all font-medium " +
        (active
          ? activeCls
          : "bg-card text-muted-foreground border-border hover:text-foreground/80")
      }
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

export function JournalTimeline({
  events,
  currentUserId,
  canFlag,
  recipientId,
  onFlag,
  medications,
}: Props) {
  const [search, setSearch] = useState("");
  const [moodFilters, setMoodFilters] = useState<Set<MoodFilter>>(new Set());
  const [kindFilters, setKindFilters] = useState<Set<KindFilter>>(new Set());
  const [sortDesc, setSortDesc] = useState(true);
  const [selectedMedId, setSelectedMedId] = useState<string | null>(null);

  const { data: taggedIds } =
    trpc.medications.getEventIdsForMedication.useQuery(
      { medication_id: selectedMedId! },
      { enabled: !!selectedMedId },
    );

  const taggedSet = useMemo(() => new Set(taggedIds ?? []), [taggedIds]);

  function toggleMood(m: MoodFilter) {
    setMoodFilters((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  }

  function toggleKind(k: KindFilter) {
    setKindFilters((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  const filtered = useMemo(() => {
    let result = [...events];

    // Sort
    result.sort((a, b) => {
      const diff =
        new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime();
      return sortDesc ? -diff : diff;
    });

    // Search — case-insensitive match on payload.text
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((e) =>
        (e.payload?.text ?? "").toLowerCase().includes(q),
      );
    }

    // Kind filter
    if (kindFilters.size > 0) {
      result = result.filter((e) => {
        const kind: KindFilter = e.entry_kind === "human" ? "human" : "system";
        return kindFilters.has(kind);
      });
    }

    // Mood filter
    if (moodFilters.size > 0) {
      result = result.filter((e) => {
        const mood = e.payload?.mood as MoodFilter | undefined;
        return mood ? moodFilters.has(mood) : false;
      });
    }

    // Medication filter
    if (selectedMedId && taggedSet.size > 0) {
      result = result.filter((e) => taggedSet.has(e.id));
    } else if (selectedMedId && taggedIds !== undefined) {
      // Query resolved but returned empty — no matches
      result = [];
    }

    return result;
  }, [
    events,
    search,
    moodFilters,
    kindFilters,
    sortDesc,
    selectedMedId,
    taggedSet,
    taggedIds,
  ]);

  const hasActiveFilters =
    search.trim() !== "" ||
    moodFilters.size > 0 ||
    kindFilters.size > 0 ||
    selectedMedId !== null;

  return (
    <div className="space-y-4">
      {/* Medication chip filter bar */}
      {medications && medications.length > 0 && (
        <MedicationChipBar
          medications={medications}
          selected={selectedMedId}
          onSelect={setSelectedMedId}
        />
      )}

      {/* Search / filter / sort toolbar */}
      <div className="bg-card border border-border rounded-xl px-4 py-3 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex-1">
            <Input
              type="search"
              placeholder="Search entries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-sm h-8"
              aria-label="Search journal entries"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSortDesc((v) => !v)}
            className="text-xs shrink-0 h-8"
            aria-label={sortDesc ? "Sort: newest first" : "Sort: oldest first"}
          >
            {sortDesc ? "Newest first" : "Oldest first"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">Filter:</span>
          <Chip
            label="Personal"
            active={kindFilters.has("human")}
            activeCls="bg-[var(--color-primary-subtle)] text-primary border-primary/30"
            onClick={() => toggleKind("human")}
          />
          <Chip
            label="System"
            active={kindFilters.has("system")}
            activeCls="bg-[var(--color-surface)] text-foreground/80 border-border"
            onClick={() => toggleKind("system")}
          />
          <span className="text-xs text-muted-foreground mx-1">Mood:</span>
          {(["good", "okay", "difficult", "crisis"] as MoodFilter[]).map(
            (m) => (
              <Chip
                key={m}
                label={m.charAt(0).toUpperCase() + m.slice(1)}
                active={moodFilters.has(m)}
                activeCls={MOOD_CHIP_CLS[m]}
                onClick={() => toggleMood(m)}
              />
            ),
          )}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setMoodFilters(new Set());
                setKindFilters(new Set());
                setSelectedMedId(null);
              }}
              className="text-xs text-muted-foreground hover:text-foreground/80 ml-1 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 &&
        (hasActiveFilters ? (
          <div className="text-center py-12">
            <p className="text-[var(--color-muted)] text-sm">
              {selectedMedId &&
              !search.trim() &&
              moodFilters.size === 0 &&
              kindFilters.size === 0
                ? "No journal entries mention this medication."
                : "No entries match your filters."}
            </p>
          </div>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="No journal entries yet"
            description="Journal entries help your care team stay in sync. Add your first entry to get started."
          />
        ))}

      {filtered.length > 0 && (
        <div className="space-y-4">
          {(() => {
            const seenDates = new Set<string>();
            return filtered.map((event) => {
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
            });
          })()}
        </div>
      )}
    </div>
  );
}
