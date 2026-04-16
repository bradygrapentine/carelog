import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-[var(--color-primary-subtle)] flex items-center justify-center mb-4">
        <Icon size={24} className="text-[var(--color-primary)]" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold text-[var(--color-ink)] mb-1">{title}</h3>
      <p className="text-sm text-[var(--color-text-secondary)] max-w-xs mb-4">{description}</p>
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
