"use client";

import { trpc } from "@/lib/trpc";
import { BriefHeadline } from "@/components/brief/BriefHeadline";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tone = "primary" | "success" | "warning";

type StatusPill = {
  id: string;
  label: string;
  tone: Tone;
};

type BriefContent = {
  recipient_name?: string;
  generated_at?: string;
  medications?: { drug_name: string }[];
  recent_entries?: { mood?: string }[];
  pills?: StatusPill[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PILL_TONE_CLASS: Record<Tone, string> = {
  primary: "bg-[var(--color-primary-subtle)] text-[var(--color-ink)]",
  success: "bg-[var(--color-success-subtle)] text-[var(--color-ink)]",
  warning: "bg-[var(--color-warning-subtle)] text-[var(--color-ink)]",
};

/** Format a UTC ISO timestamp as "7:02a" / "10:45p" in local time. */
function formatShortTime(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "p" : "a";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")}${ampm}`;
}

/**
 * Derive status pills from brief content when the brief was created by the
 * /api/brief POST route (which stores medications + recent_entries arrays).
 * Falls back to any explicit pills stored in content.pills.
 */
function derivePills(content: BriefContent): StatusPill[] {
  if (content.pills && content.pills.length > 0) {
    return content.pills;
  }

  const pills: StatusPill[] = [];

  const medCount = content.medications?.length ?? 0;
  if (medCount > 0) {
    pills.push({
      id: "meds",
      label: `${medCount} med${medCount === 1 ? "" : "s"} on record`,
      tone: "success",
    });
  }

  const moodEntry = content.recent_entries?.find((e) => e.mood);
  if (moodEntry?.mood) {
    const label =
      moodEntry.mood.charAt(0).toUpperCase() + moodEntry.mood.slice(1);
    pills.push({ id: "mood", label: `Mood: ${label}`, tone: "primary" });
  }

  const entryCount = content.recent_entries?.length ?? 0;
  if (entryCount > 0) {
    pills.push({
      id: "entries",
      label: `${entryCount} recent journal entr${entryCount === 1 ? "y" : "ies"}`,
      tone: "warning",
    });
  }

  return pills;
}

// ─── Shell (shared across states) ────────────────────────────────────────────

function BriefShell({
  eyebrow,
  headline,
  headlineClass,
  pills,
  ariaBusy,
}: {
  eyebrow: React.ReactNode;
  headline: React.ReactNode;
  headlineClass?: string;
  pills?: React.ReactNode;
  ariaBusy?: boolean;
}) {
  return (
    <section
      aria-label="Today's brief"
      aria-busy={ariaBusy ? "true" : undefined}
      className="relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-card p-6 shadow-sm sm:p-8"
    >
      <div
        data-testid="brief-blob"
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 -right-16 h-64 w-64 rounded-full bg-[var(--color-primary-subtle)] opacity-70 blur-3xl"
      />
      <div className="relative space-y-5">
        <span
          data-testid="brief-eyebrow"
          className="eyebrow-mono inline-flex rounded-full border border-[var(--color-border)] bg-white/80 px-2.5 py-1"
        >
          {eyebrow}
        </span>
        <div
          data-testid="brief-headline"
          className={
            headlineClass ??
            "headline-display text-[26px] leading-[1.2] text-[var(--color-ink)] sm:text-[28px]"
          }
        >
          {headline}
        </div>
        {pills}
      </div>
    </section>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function BriefHeroSkeleton() {
  return (
    <BriefShell
      ariaBusy
      eyebrow={"Today’s brief"}
      headline={
        <div className="space-y-2" aria-hidden="true">
          <div className="h-6 w-3/4 animate-pulse rounded bg-[var(--color-primary-subtle)]" />
          <div className="h-6 w-1/2 animate-pulse rounded bg-[var(--color-primary-subtle)]" />
        </div>
      }
      pills={
        <ul className="flex flex-wrap gap-2">
          <li>
            <span
              data-testid="brief-status-pill"
              className="inline-flex h-6 w-24 animate-pulse rounded-full bg-[var(--color-primary-subtle)]"
              aria-hidden="true"
            />
          </li>
        </ul>
      }
    />
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function BriefHeroEmpty() {
  return (
    <BriefShell
      eyebrow={"Today’s brief"}
      headline={
        <>
          No brief yet &mdash; generate one from the <em>journal page</em>.
        </>
      }
    />
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

type BriefHeroProps = {
  /** UUID of the care recipient whose brief to display. When omitted the
   *  component renders an empty/no-brief state — DashboardClient passes
   *  nothing until Track B integration lands. */
  recipientId?: string;
  /** UUID of the org the recipient belongs to. Required when recipientId is
   *  set; ignored otherwise. */
  orgId?: string;
};

export function BriefHero({ recipientId, orgId }: BriefHeroProps) {
  const ready = Boolean(recipientId && orgId);

  const {
    data: brief,
    isLoading,
    isError,
  } = trpc.briefs.latestForRecipient.useQuery(
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    { recipientId: recipientId!, orgId: orgId! },
    { enabled: ready, staleTime: 5 * 60 * 1_000 },
  );

  if (!ready) return <BriefHeroEmpty />;
  if (isLoading) return <BriefHeroSkeleton />;

  const eyebrowLabel = brief?.created_at
    ? `Today’s brief · auto-generated ${formatShortTime(brief.created_at)}`
    : "Today’s brief";

  if (isError) {
    return (
      <BriefShell
        eyebrow={eyebrowLabel}
        headline="Could not load brief — please refresh the page."
        headlineClass="headline-display text-[26px] leading-[1.2] text-[var(--color-danger)] sm:text-[28px]"
      />
    );
  }

  if (!brief) return <BriefHeroEmpty />;

  const content = (brief.content ?? {}) as BriefContent;
  const pills = derivePills(content);
  const headlineNode = (
    <BriefHeadline
      headline={(brief as { headline?: unknown }).headline}
      fallback={brief.title ?? "Care brief"}
    />
  );

  return (
    <BriefShell
      eyebrow={eyebrowLabel}
      headline={headlineNode}
      pills={
        pills.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {pills.map((pill) => (
              <li key={pill.id}>
                <span
                  data-testid="brief-status-pill"
                  className={[
                    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
                    PILL_TONE_CLASS[pill.tone],
                  ].join(" ")}
                >
                  {pill.label}
                </span>
              </li>
            ))}
          </ul>
        ) : undefined
      }
    />
  );
}
