"use client";

/**
 * MoodHeatmap — UX-059 5-week calendar heatmap (35 cells) showing the
 * dominant mood per day for the last 5 weeks (Mon-anchored).
 *
 * Reads journal entries that already include `created_at` + `mood`. For each
 * day, picks the most-severe mood logged that day (crisis > difficult > okay
 * > good) so the worst day shows up rather than being averaged away.
 *
 * Empty days render as a muted placeholder. Each cell exposes an aria-label
 * with date + mood (or "no entry"). Cells are buttons, fully Tab-traversable.
 *
 * Drawn from /tmp/caresync-design/caresync-2-0/project/proto-rest.jsx
 * "sidebarStyle === 'calendar-heatmap'" branch.
 */

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Mood } from "@/lib/mood";

export type MoodHeatmapEntry = {
  /** ISO date string or any string accepted by `new Date()`. */
  created_at: string;
  /** One of the four mood keys, or null/empty if no mood was set. */
  mood?: Mood | string | null;
};

type Props = {
  entries: MoodHeatmapEntry[];
  /** Anchor "today"; defaults to `new Date()`. Inject for deterministic tests. */
  today?: Date;
  /** Optional click handler — fires with the date for the clicked cell. */
  onDayClick?: (date: Date, mood: Mood | null) => void;
};

const MOOD_RANK: Record<Mood, number> = {
  good: 0,
  okay: 1,
  difficult: 2,
  crisis: 3,
};

const MOOD_TOKEN: Record<Mood, string> = {
  good: "var(--color-mood-good)",
  okay: "var(--color-mood-okay)",
  difficult: "var(--color-mood-difficult)",
  crisis: "var(--color-mood-crisis)",
};

const MOOD_LABEL: Record<Mood, string> = {
  good: "good",
  okay: "okay",
  difficult: "difficult",
  crisis: "crisis",
};

/** Format a Date as "YYYY-MM-DD" using local time (cell-bucket key). */
function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Format for the aria-label, e.g. "Mon Apr 28". */
function formatHumanDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function isMood(value: unknown): value is Mood {
  return (
    value === "good" ||
    value === "okay" ||
    value === "difficult" ||
    value === "crisis"
  );
}

export function MoodHeatmap({ entries, today, onDayClick }: Props) {
  const cells = useMemo(() => {
    const anchor = today ? new Date(today) : new Date();
    anchor.setHours(0, 0, 0, 0);

    // Bucket entries by local-day, keep the worst mood per day.
    const dayMood = new Map<string, Mood>();
    for (const entry of entries) {
      if (!isMood(entry.mood)) continue;
      const d = new Date(entry.created_at);
      if (Number.isNaN(d.getTime())) continue;
      const key = dayKey(d);
      const prior = dayMood.get(key);
      if (!prior || MOOD_RANK[entry.mood] > MOOD_RANK[prior]) {
        dayMood.set(key, entry.mood);
      }
    }

    // Build 35 cells = 5 weeks ending on `anchor`. Index 34 is today.
    const out: { date: Date; mood: Mood | null }[] = [];
    for (let i = 34; i >= 0; i--) {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() - i);
      out.push({ date: d, mood: dayMood.get(dayKey(d)) ?? null });
    }
    return out;
  }, [entries, today]);

  const filledCount = cells.filter((c) => c.mood !== null).length;

  return (
    <Card className="shadow-sm gap-2" data-testid="mood-heatmap">
      <CardHeader className="-mt-4 px-4 py-3 bg-[var(--color-primary-subtle)] border-b border-[var(--color-border)]">
        <CardTitle className="text-sm">Last 5 weeks</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <p className="text-xs text-[var(--color-muted)] mb-2 font-mono uppercase tracking-wide">
          Mood by day
        </p>
        <div
          aria-hidden="true"
          className="grid grid-cols-7 gap-1 mb-1 text-[10px] font-mono uppercase text-[var(--color-muted)]"
        >
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <div key={`${d}-${i}`} className="text-center">
              {d}
            </div>
          ))}
        </div>
        <div
          className="grid grid-cols-7 gap-1"
          role="grid"
          aria-label="Mood heatmap, last 5 weeks"
          data-testid="mood-heatmap-grid"
        >
          {cells.map((cell, i) => {
            const human = formatHumanDate(cell.date);
            const moodLabel = cell.mood
              ? MOOD_LABEL[cell.mood]
              : "no entry";
            const ariaLabel = `${human}: ${moodLabel}`;
            const interactive = Boolean(onDayClick);
            const commonProps = {
              role: "gridcell",
              "aria-label": ariaLabel,
              "data-mood": cell.mood ?? "none",
              "data-day-key": dayKey(cell.date),
              title: ariaLabel,
              className: `aspect-square rounded-sm transition-opacity focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1 ${
                cell.mood
                  ? "opacity-85 hover:opacity-100"
                  : "bg-[var(--color-border)] opacity-50"
              }`,
              style: cell.mood
                ? { background: MOOD_TOKEN[cell.mood] }
                : undefined,
            } as const;

            if (interactive) {
              return (
                <button
                  key={i}
                  type="button"
                  {...commonProps}
                  onClick={() => onDayClick?.(cell.date, cell.mood)}
                />
              );
            }
            return <div key={i} {...commonProps} />;
          })}
        </div>
        <p className="mt-2 text-[11px] font-mono uppercase tracking-wide text-[var(--color-muted)] flex justify-between">
          <span>5w ago</span>
          <span>today</span>
        </p>
        {filledCount === 0 && (
          <p
            className="mt-3 text-xs text-[var(--color-muted)]"
            data-testid="mood-heatmap-empty"
          >
            No mood entries yet — log a journal entry with a mood to fill the
            heatmap.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
