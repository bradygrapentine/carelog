import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type ErrorBannerProps = {
  children: ReactNode;
  className?: string;
};

export function ErrorBanner({ children, className }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl bg-[var(--color-danger-subtle)] px-4 py-3 text-sm text-[var(--color-danger)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
