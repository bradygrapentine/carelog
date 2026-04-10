import { cn } from "@/lib/utils";

type Role = "coordinator" | "caregiver" | "aide" | "supporter";

const ROLE_STYLES: Record<Role, string> = {
  coordinator: "bg-violet-100 text-violet-800",
  caregiver:   "bg-amber-100  text-amber-800",
  aide:        "bg-slate-100  text-slate-700",
  supporter:   "bg-gray-100   text-gray-600",
};

const ROLE_LABELS: Record<Role, string> = {
  coordinator: "Coordinator",
  caregiver:   "Caregiver",
  aide:        "Aide",
  supporter:   "Supporter",
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
        ROLE_STYLES[role] ?? "bg-gray-100 text-gray-600",
        className
      )}
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}
