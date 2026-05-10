"use client";

import React from "react";
import { Pen, Clock, Heart, Calendar, FileText } from "lucide-react";

export type TimelineEventType =
  | "med"
  | "journal"
  | "shift"
  | "vital"
  | "appointment"
  | "note";

export type TimelineEvent = {
  id: string;
  type: TimelineEventType;
  /** ISO timestamp; ordering is by this field */
  at: string;
  title: string;
  detail?: string;
};

type TimeRailTimelineProps = {
  events: TimelineEvent[];
  /** Override "now" — useful for tests. Defaults to new Date(). */
  now?: Date;
  /** Show the NOW pill on the rail. Default true. */
  showNowMarker?: boolean;
  className?: string;
};

/** Inline ℞ glyph for medications — serif italic, on-brand per design spec */
function RxGlyph({ size = 14 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      data-icon="rx"
      style={{
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontStyle: "italic",
        fontSize: size,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      ℞
    </span>
  );
}

const TYPE_ICONS: Record<
  TimelineEventType,
  { icon: React.ReactNode; name: string }
> = {
  med: { icon: <RxGlyph size={14} />, name: "rx" },
  journal: {
    icon: <Pen size={14} data-icon="pen" aria-hidden="true" />,
    name: "pen",
  },
  shift: {
    icon: <Clock size={14} data-icon="clock" aria-hidden="true" />,
    name: "clock",
  },
  vital: {
    icon: <Heart size={14} data-icon="heart" aria-hidden="true" />,
    name: "heart",
  },
  appointment: {
    icon: <Calendar size={14} data-icon="calendar" aria-hidden="true" />,
    name: "calendar",
  },
  note: {
    icon: <FileText size={14} data-icon="file-text" aria-hidden="true" />,
    name: "file-text",
  },
};

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function TimeRailTimeline({
  events,
  now,
  showNowMarker = true,
  className,
}: TimeRailTimelineProps) {
  const currentTime = now ?? new Date();

  const sorted = [...events].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );

  const nowMs = currentTime.getTime();

  // Find insertion index for NOW pill
  let nowInsertIndex = sorted.length; // default: end
  for (let i = 0; i < sorted.length; i++) {
    if (new Date(sorted[i].at).getTime() > nowMs) {
      nowInsertIndex = i;
      break;
    }
  }

  if (events.length === 0) {
    return (
      <section
        aria-label="Today's timeline"
        className={`py-8 text-center text-[var(--color-muted)] ${className ?? ""}`}
      >
        Nothing logged today.
      </section>
    );
  }

  return (
    <section aria-label="Today's timeline" className={`${className ?? ""}`}>
      <ol className="relative space-y-1">
        {sorted.map((event, idx) => {
          const { icon } = TYPE_ICONS[event.type];

          return (
            <React.Fragment key={event.id}>
              {showNowMarker && idx === nowInsertIndex && (
                <li
                  aria-label="Now"
                  role="status"
                  className="flex items-center gap-2 py-1"
                >
                  <div className="w-16 shrink-0 text-right">
                    <span className="inline-block rounded-full bg-[var(--color-primary-pressed)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                      NOW
                    </span>
                  </div>
                  <div className="flex-1 border-t border-[var(--color-primary)] opacity-40" />
                </li>
              )}
              <li className="flex items-start gap-3">
                {/* Time rail label */}
                <div className="w-16 shrink-0 pt-1 text-right font-mono text-[11px] text-[var(--color-muted)]">
                  {formatTime(event.at)}
                </div>

                {/* Event card */}
                <div className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center text-[var(--color-muted)]">
                      {icon}
                    </span>
                    <span className="text-sm font-medium text-[var(--color-ink)]">
                      {event.title}
                    </span>
                  </div>
                  {event.detail && (
                    <p
                      data-detail="true"
                      className="mt-1 text-xs text-[var(--color-muted)]"
                    >
                      {event.detail}
                    </p>
                  )}
                </div>
              </li>
            </React.Fragment>
          );
        })}

        {/* NOW pill at the end if all events are past */}
        {showNowMarker && nowInsertIndex === sorted.length && (
          <li
            aria-label="Now"
            role="status"
            className="flex items-center gap-2 py-1"
          >
            <div className="w-16 shrink-0 text-right">
              <span className="inline-block rounded-full bg-[var(--color-primary-pressed)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                NOW
              </span>
            </div>
            <div className="flex-1 border-t border-[var(--color-primary)] opacity-40" />
          </li>
        )}
      </ol>
    </section>
  );
}
