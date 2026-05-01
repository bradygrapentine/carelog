import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RxGlyph } from "./RxGlyph";

type MissedDose = {
  medName: string;
  scheduledTime: string;
};

type MedAttentionHeroProps = {
  missedDoses: MissedDose[];
  onRecordCatchUp?: (medName: string) => void;
  className?: string;
};

export function MedAttentionHero({
  missedDoses,
  onRecordCatchUp,
  className,
}: MedAttentionHeroProps) {
  if (missedDoses.length === 0) return null;

  const count = missedDoses.length;
  const isSingular = count === 1;
  const headline = isSingular
    ? "1 dose needs catch-up."
    : `${count} doses need catch-up.`;

  return (
    <Card
      className={cn("w-full shadow-sm gap-2", className)}
      aria-label="Missed doses needing attention"
    >
      <CardHeader className="-mt-4 px-4 py-3 bg-[var(--color-tertiary-subtle)] border-b border-[var(--color-border)]">
        <p className="eyebrow-mono">ATTENTION</p>
        <p className="headline-display text-base font-medium text-[var(--color-ink)]">
          {headline}
        </p>
      </CardHeader>
      <CardContent className="pt-2 px-4 pb-4">
        <ul className="space-y-3">
          {missedDoses.map((dose) => (
            <li
              key={`${dose.medName}-${dose.scheduledTime}`}
              className="flex items-center gap-3"
            >
              <RxGlyph size={18} ariaLabel="Medication" />
              <span className="flex-1 text-sm font-medium text-[var(--color-ink)]">
                {dose.medName}
              </span>
              <span className="text-xs text-[var(--color-muted)] font-mono">
                {dose.scheduledTime}
              </span>
              <Button
                size="sm"
                variant="default"
                aria-label={`Record catch-up dose for ${dose.medName}`}
                onClick={() => onRecordCatchUp?.(dose.medName)}
                className="focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
              >
                Record catch-up dose
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
