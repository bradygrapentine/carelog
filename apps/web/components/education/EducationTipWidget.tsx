"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

type Props = {
  guideSlug: string;
  guideTitle: string;
  guideSummary: string;
};

export function EducationTipWidget({
  guideSlug,
  guideTitle,
  guideSummary,
}: Props) {
  const [dismissed, setDismissed] = useState(false);
  const dismissMutation = trpc.user.dismissEducationTip.useMutation();

  if (dismissed) return null;

  return (
    <Card className="shadow-sm gap-2 border-[var(--color-primary-subtle)]">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden="true">
            📚
          </span>
          <p className="text-xs font-semibold text-[var(--color-primary)] uppercase tracking-wide">
            Based on recent activity
          </p>
        </div>
        <div>
          <h3 className="text-sm font-bold text-[var(--color-ink)]">
            {guideTitle}
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
            {guideSummary}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            asChild
            size="sm"
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
          >
            <Link href={`/education/${guideSlug}`}>Read guide</Link>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDismissed(true);
              dismissMutation.mutate();
            }}
            className="text-[var(--color-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
          >
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
