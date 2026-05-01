"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Caregiver = {
  id: string;
  name: string;
  initials: string;
  shiftLabel?: string;
};

type OnShiftSidebarProps = {
  onNow: Caregiver | null;
  upNext: Caregiver | null;
  latestMood: {
    label: "good" | "steady" | "difficult";
    note?: string;
    when: string;
    by: string;
  } | null;
  className?: string;
};

// ─── Mood token map ───────────────────────────────────────────────────────────

const MOOD_COLOR: Record<"good" | "steady" | "difficult", string> = {
  good: "bg-[var(--color-mood-good)]",
  steady: "bg-[var(--color-mood-okay)]",
  difficult: "bg-[var(--color-mood-difficult)]",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="eyebrow-mono mb-1 text-[var(--color-muted)]">{children}</p>
  );
}

function AvatarCircle({ initials }: { initials: string }) {
  return (
    <div
      aria-hidden="true"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-subtle)] text-xs font-medium text-[var(--color-primary)]"
    >
      {initials}
    </div>
  );
}

function CaregiverRow({ caregiver }: { caregiver: Caregiver }) {
  return (
    <div className="flex items-center gap-2">
      <AvatarCircle initials={caregiver.initials} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[var(--color-ink)]">
          {caregiver.name}
        </p>
        {caregiver.shiftLabel && (
          <p className="font-mono text-xs text-[var(--color-muted)]">
            {caregiver.shiftLabel}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function OnShiftSidebar({
  onNow,
  upNext,
  latestMood,
  className,
}: OnShiftSidebarProps) {
  return (
    <Card className={cn("shadow-sm", className)}>
      <CardContent className="space-y-4 p-4">
        {/* On Now */}
        <section aria-label="Currently on shift">
          <Eyebrow>ON NOW</Eyebrow>
          {onNow ? (
            <CaregiverRow caregiver={onNow} />
          ) : (
            <p className="text-sm text-[var(--color-muted)]">
              No one scheduled
            </p>
          )}
        </section>

        {/* Divider */}
        <div className="border-t border-[var(--color-border)]" />

        {/* Up Next */}
        <section aria-label="Up next on shift">
          <Eyebrow>UP NEXT</Eyebrow>
          {upNext ? (
            <CaregiverRow caregiver={upNext} />
          ) : (
            <p className="text-sm text-[var(--color-muted)]">
              No one scheduled
            </p>
          )}
        </section>

        {/* Latest mood — only rendered when present */}
        {latestMood && (
          <>
            <div className="border-t border-[var(--color-border)]" />
            <section aria-label="Latest journal mood" data-testid="mood-section">
              <Eyebrow>LATEST MOOD</Eyebrow>
              <div className="flex items-start gap-2">
                {/* Mood dot */}
                <span
                  aria-label={`Mood: ${latestMood.label}`}
                  className={cn(
                    "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                    MOOD_COLOR[latestMood.label],
                  )}
                />
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium capitalize text-[var(--color-ink)]">
                    {latestMood.label}
                  </p>
                  {latestMood.note && (
                    <p
                      data-testid="mood-note"
                      className="text-sm italic text-[var(--color-text-secondary)]"
                    >
                      {latestMood.note}
                    </p>
                  )}
                  <p
                    data-testid="mood-by"
                    className="eyebrow-mono text-[var(--color-muted)]"
                  >
                    {latestMood.when} · {latestMood.by}
                  </p>
                </div>
              </div>
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}
