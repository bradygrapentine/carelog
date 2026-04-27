import { cn } from "@/lib/utils";

type Role = "coordinator" | "caregiver" | "aide" | "supporter";

const ROLE_STYLES: Record<Role, string> = {
  coordinator: "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]",
  caregiver: "bg-[var(--color-secondary-subtle)] text-[var(--color-secondary)]",
  aide: "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)]",
  supporter:
    "bg-[var(--color-surface)] text-[var(--color-muted)] border border-[var(--color-border)]",
};

const ROLE_LABELS: Record<Role, string> = {
  coordinator: "Coordinator",
  caregiver: "Caregiver",
  aide: "Aide",
  supporter: "Supporter",
};

type Props = {
  role: Role;
  className?: string;
};

export function RoleBadge({ role, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        ROLE_STYLES[role] ??
          "bg-[var(--color-surface)] text-[var(--color-muted)]",
        className,
      )}
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}
