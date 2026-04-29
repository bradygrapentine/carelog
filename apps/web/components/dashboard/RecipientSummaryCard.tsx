"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { BriefHeadline } from "@/components/brief/BriefHeadline";

type RecipientSummaryCardProps = {
  recipientId: string;
  orgId: string;
  firstName: string;
  fullName: string | null;
};

/** Compact brief excerpt for layout B. Renders the latest brief title or
 * headline in 1–2 lines, no card chrome. */
function BriefExcerpt({
  recipientId,
  orgId,
}: {
  recipientId: string;
  orgId: string;
}) {
  const { data: brief, isLoading } = trpc.briefs.latestForRecipient.useQuery(
    { recipientId, orgId },
    { staleTime: 5 * 60 * 1_000 },
  );

  if (isLoading) {
    return (
      <div className="space-y-1.5" aria-hidden="true">
        <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--color-primary-subtle)]" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--color-primary-subtle)]" />
      </div>
    );
  }

  if (!brief) {
    return (
      <p className="text-sm text-[var(--color-muted)] italic">
        No brief yet — add journal notes to get started.
      </p>
    );
  }

  return (
    <p className="headline-display text-sm text-[var(--color-ink)] line-clamp-2">
      <BriefHeadline
        headline={(brief as { headline?: unknown }).headline}
        fallback={brief.title ?? "Care brief"}
      />
    </p>
  );
}

/** Layout-B per-recipient summary block. Renders a compact card with a
 * ".headline-display" heading, a brief excerpt, and an
 * "Open {name}'s journal" CTA. Used only when the view toggle is in
 * "stacked" mode (N > 1 recipients). */
export function RecipientSummaryCard({
  recipientId,
  orgId,
  firstName,
  fullName,
}: RecipientSummaryCardProps) {
  const initials = (fullName ?? firstName)
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Card className="shadow-sm border border-[var(--color-border)]">
      <CardContent className="p-5">
        {/* Recipient heading row */}
        <div className="flex items-center gap-3 mb-3">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-subtle)] text-xs font-semibold text-[var(--color-primary)]"
            aria-hidden="true"
          >
            {initials}
          </span>
          <h2 className="headline-display text-[clamp(1.25rem,3vw,1.75rem)]">
            Caring for <em>{firstName}</em>
          </h2>
        </div>

        {/* Brief excerpt */}
        <div className="mb-4">
          <BriefExcerpt recipientId={recipientId} orgId={orgId} />
        </div>

        {/* Open journal CTA */}
        <Link
          href={`/journal/${recipientId}`}
          aria-label={`Open ${firstName}'s care journal`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary)]/80 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 rounded"
        >
          Open {firstName}&apos;s journal
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </CardContent>
    </Card>
  );
}
