"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type PatternCardProps = {
  eyebrow: string;
  headline: string;
  detail: string;
  trend?: "up" | "down" | "flat";
  className?: string;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function PatternCard({
  eyebrow,
  headline,
  detail,
  trend,
  className,
}: PatternCardProps) {
  return (
    <Card className={cn("shadow-sm", className)}>
      <CardContent className="p-4 space-y-2">
        {/* Eyebrow */}
        <p
          data-testid="pattern-eyebrow"
          className="eyebrow-mono text-[var(--color-muted)]"
        >
          {eyebrow}
        </p>

        {/* Headline + trend icon row */}
        <div className="flex items-start gap-2">
          <h3
            data-testid="pattern-headline"
            className="headline-display text-base text-[var(--color-ink)] leading-snug"
          >
            {headline}
          </h3>
          {trend === "up" && (
            <TrendingUp
              data-testid="trend-icon-up"
              aria-label="Trending up"
              size={16}
              className="mt-1 shrink-0 text-[var(--color-success)]"
            />
          )}
          {trend === "down" && (
            <TrendingDown
              data-testid="trend-icon-down"
              aria-label="Trending down"
              size={16}
              className="mt-1 shrink-0 text-[var(--color-danger)]"
            />
          )}
          {trend === "flat" && (
            <Minus
              data-testid="trend-icon-flat"
              aria-label="Flat trend"
              size={16}
              className="mt-1 shrink-0 text-[var(--color-muted)]"
            />
          )}
        </div>

        {/* Detail */}
        <p
          data-testid="pattern-detail"
          className="text-sm text-[var(--color-text-secondary)]"
        >
          {detail}
        </p>
      </CardContent>
    </Card>
  );
}
