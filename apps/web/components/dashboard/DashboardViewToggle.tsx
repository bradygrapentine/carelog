"use client";

import { Clock, LayoutList, SquareUser } from "lucide-react";

export type DashboardView = "single" | "stacked" | "now";

const STORAGE_KEY = "caresync.dashboardView";

export function loadDashboardView(): DashboardView {
  if (typeof window === "undefined") return "single";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "stacked" || stored === "now") return stored;
  return "single";
}

export function saveDashboardView(view: DashboardView): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, view);
}

type DashboardViewToggleProps = {
  view: DashboardView;
  onChange: (view: DashboardView) => void;
  /** When false, the "stacked" option is hidden (single-recipient cases). */
  showStacked?: boolean;
};

type Option = {
  value: DashboardView;
  label: string;
  ariaLabel: string;
  Icon: typeof LayoutList;
};

const OPTIONS: ReadonlyArray<Option> = [
  {
    value: "single",
    label: "Single",
    ariaLabel: "Switch to single-recipient view",
    Icon: SquareUser,
  },
  {
    value: "stacked",
    label: "All recipients",
    ariaLabel: "Show all recipients",
    Icon: LayoutList,
  },
  {
    value: "now",
    label: "Now Board",
    ariaLabel: "Switch to Now Board timeline",
    Icon: Clock,
  },
];

/**
 * Three-way segmented toggle for the dashboard view.
 * - "single" → focused single-recipient layout (default)
 * - "stacked" → all recipients stacked (layout B)
 * - "now" → UX-056 Now Board timeline
 *
 * Selection persists to localStorage['caresync.dashboardView'].
 */
export function DashboardViewToggle({
  view,
  onChange,
  showStacked = true,
}: DashboardViewToggleProps) {
  function pick(next: DashboardView) {
    if (next === view) return;
    saveDashboardView(next);
    onChange(next);
  }

  const visible = OPTIONS.filter(
    (opt) => showStacked || opt.value !== "stacked",
  );

  return (
    <div
      role="group"
      aria-label="Dashboard view"
      className="inline-flex items-center rounded-lg border border-[var(--color-border)] p-0.5 bg-card"
    >
      {visible.map(({ value, label, ariaLabel, Icon }) => {
        const isActive = view === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => pick(value)}
            aria-label={ariaLabel}
            aria-pressed={isActive}
            className={
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1 min-h-[28px] " +
              (isActive
                ? "bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
                : "text-[var(--color-muted)] hover:text-[var(--color-primary)]")
            }
          >
            <Icon className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
