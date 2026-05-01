import { cn } from "@/lib/utils";

type MedStatus = "on-track" | "catch-up" | "missed";

type MedStatusBadgeProps = {
  status: MedStatus;
  className?: string;
};

const STATUS_CONFIG: Record<
  MedStatus,
  { label: string; classes: string }
> = {
  "on-track": {
    label: "On track",
    classes:
      "bg-[var(--color-success-subtle)] text-[var(--color-success)]",
  },
  "catch-up": {
    label: "Catch up",
    classes:
      "bg-[var(--color-warning-subtle)] text-[var(--color-warning)]",
  },
  missed: {
    label: "Missed",
    classes:
      "bg-[var(--color-tertiary-subtle)] text-[var(--color-tertiary)]",
  },
};

export function MedStatusBadge({ status, className }: MedStatusBadgeProps) {
  const { label, classes } = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide",
        classes,
        className,
      )}
    >
      {label}
    </span>
  );
}
