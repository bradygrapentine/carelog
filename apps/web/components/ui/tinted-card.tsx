/**
 * TintedCard — CareSync's signature panel pattern.
 *
 * Encapsulates the three coupled pieces that must travel together:
 *   - `shadow-sm gap-2` on Card (tightens header↔body gap, lifts panel)
 *   - `-mt-4 px-4 py-3 bg-[var(--color-primary-subtle)] border-b border-[var(--color-border)]` on CardHeader
 *   - `pt-2` on CardContent (standard body padding)
 *
 * See `.claude/rules/ui-standards.md` for the canonical description.
 *
 * API:
 *   <TintedCard>
 *     <TintedCardHeader title="Section name" />
 *     <TintedCardHeader title="Section" action={<button>+ Add</button>} />
 *     <TintedCardHeader title={<div>…rich title…</div>} />
 *     <CardContent className="pt-2">…</CardContent>
 *   </TintedCard>
 *
 * Tones:
 *   - `tone="default"` (default) — light primary-subtle tint. Used by 12+ panels.
 *   - `tone="dark"` — accepted for backward compatibility but renders identically
 *     to `tone="default"`. UX-110 retired dark mode; the prop is kept so existing
 *     call sites and tests continue to compile.
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

type Tone = "default" | "dark";

// ---------------------------------------------------------------------------
// TintedCard — drop-in replacement for <Card className="shadow-sm gap-2">
// ---------------------------------------------------------------------------

type TintedCardProps = React.ComponentProps<typeof Card>;

function TintedCard({ className, ...props }: TintedCardProps) {
  return <Card className={cn("shadow-sm gap-2", className)} {...props} />;
}

// ---------------------------------------------------------------------------
// TintedCardHeader — the tinted header row
//
// `title`  — string or any ReactNode (for icon+title combos, badge+title, etc.)
// `action` — optional right-aligned slot (+ Add buttons, toggles, badges)
// `tone`   — "default" (light primary-subtle); "dark" is accepted but no-op (UX-110)
// `className` — pass-through for edge-case overrides
// ---------------------------------------------------------------------------

type TintedCardHeaderProps = {
  title: React.ReactNode;
  action?: React.ReactNode;
  tone?: Tone;
  className?: string;
};

function TintedCardHeader({
  title,
  action,
  tone: _tone = "default",
  className,
}: TintedCardHeaderProps) {
  const hasAction = Boolean(action);

  return (
    <CardHeader
      className={cn(
        "-mt-4 px-4 py-3 bg-[var(--color-primary-subtle)] border-b border-[var(--color-border)]",
        hasAction && "flex flex-row items-center justify-between space-y-0",
        className,
      )}
    >
      {typeof title === "string" ? (
        <CardTitle className="text-sm">{title}</CardTitle>
      ) : (
        title
      )}
      {action}
    </CardHeader>
  );
}

export { TintedCard, TintedCardHeader };
