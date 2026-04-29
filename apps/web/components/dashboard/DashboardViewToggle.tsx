"use client";

import { LayoutList, SquareUser } from "lucide-react";

export type DashboardView = "single" | "stacked";

const STORAGE_KEY = "caresync.dashboardView";

export function loadDashboardView(): DashboardView {
  if (typeof window === "undefined") return "single";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "stacked" ? "stacked" : "single";
}

export function saveDashboardView(view: DashboardView): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, view);
}

type DashboardViewToggleProps = {
  view: DashboardView;
  onChange: (view: DashboardView) => void;
};

/**
 * Small ghost-style toggle button shown only when N > 1 recipients.
 * "single" → show a single recipient (layout A with switcher chips).
 * "stacked" → show all recipients stacked (layout B).
 * Choice persists to localStorage['caresync.dashboardView'].
 */
export function DashboardViewToggle({ view, onChange }: DashboardViewToggleProps) {
  const isStacked = view === "stacked";

  function toggle() {
    const next: DashboardView = isStacked ? "single" : "stacked";
    saveDashboardView(next);
    onChange(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isStacked ? "Switch to single-recipient view" : "Show all recipients"}
      aria-pressed={isStacked}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] text-xs font-medium text-[var(--color-muted)] hover:bg-[var(--color-primary-subtle)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/40 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 min-h-[32px]"
    >
      {isStacked ? (
        <>
          <SquareUser className="w-3.5 h-3.5" aria-hidden="true" />
          Single view
        </>
      ) : (
        <>
          <LayoutList className="w-3.5 h-3.5" aria-hidden="true" />
          All recipients
        </>
      )}
    </button>
  );
}
