"use client";

import { cn } from "@/lib/utils";

export type AppTab =
  | "journal"
  | "medications"
  | "team"
  | "shifts"
  | "documents"
  | "more";

const TABS: { id: AppTab; label: string; icon: string }[] = [
  { id: "journal",     label: "Journal",     icon: "📋" },
  { id: "medications", label: "Medications", icon: "💊" },
  { id: "team",        label: "Team",        icon: "👥" },
  { id: "shifts",      label: "Shifts",      icon: "📅" },
  { id: "documents",   label: "Documents",   icon: "📁" },
  { id: "more",        label: "More",        icon: "⋯" },
];

type Props = {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  userInitials: string;
  onSignOut?: () => void;
};

export function AppTabBar({ activeTab, onTabChange, userInitials, onSignOut }: Props) {
  return (
    <header className="sticky top-0 z-50 w-full bg-[var(--color-ink)] shadow-md">
      <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <div className="flex items-center gap-2 py-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--color-primary-light)]" aria-hidden="true" />
          <span className="text-sm font-bold text-white">Carelog</span>
        </div>

        {/* User avatar */}
        <button
          onClick={onSignOut}
          aria-label="Sign out"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-semibold text-white transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] focus:ring-offset-1 focus:ring-offset-[var(--color-ink)]"
        >
          {userInitials}
        </button>
      </div>

      {/* Unified tab list — desktop shows label only; mobile shows icon + label */}
      <nav
        role="tablist"
        aria-label="App navigation"
        className="flex overflow-x-auto border-t border-white/10"
      >
        {TABS.map(({ id, label, icon }) => {
          const isActive = id === activeTab;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={isActive}
              aria-controls={id + "-panel"}
              onClick={() => onTabChange(id)}
              className={cn(
                "flex min-w-[4.5rem] flex-col items-center gap-0.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors md:flex-row md:gap-1.5 md:px-4 md:py-4 md:text-sm",
                isActive
                  ? "border-[var(--color-primary-light)] text-white"
                  : "border-transparent text-violet-300 hover:text-white"
              )}
            >
              <span aria-hidden="true" className="md:hidden">{icon}</span>
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
}
