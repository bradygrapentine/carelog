"use client";

import {
  BookOpen,
  Calendar,
  Clock,
  FileText,
  Folder,
  Home,
  Plus,
  User,
} from "lucide-react";
import type { ReactNode } from "react";

type NavItemId =
  | "brief"
  | "today"
  | "meds"
  | "shifts"
  | "journal"
  | "profile"
  | "docs"
  | "visits";

type SageRailProps = {
  active: string;
  onNavigate: (id: string) => void;
  recipient: { name: string; age: number; relationship: string };
  attentionCount?: number;
};

type NavItem = {
  id: NavItemId;
  label: string;
  icon: ReactNode;
};

const TODAY_ITEMS: NavItem[] = [
  {
    id: "brief",
    label: "Daily brief",
    icon: <Home className="h-4 w-4 shrink-0" aria-hidden="true" />,
  },
  {
    id: "today",
    label: "Timeline",
    icon: <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />,
  },
  {
    id: "meds",
    label: "Medications",
    // Intentional brand glyph: serif ℞ per handoff README §architecture-notes-5
    icon: (
      <span
        className="inline-block w-4 text-center font-display italic leading-none shrink-0"
        aria-hidden="true"
      >
        ℞
      </span>
    ),
  },
  {
    id: "shifts",
    label: "Shifts",
    icon: <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />,
  },
];

const RECORD_ITEMS: NavItem[] = [
  {
    id: "journal",
    label: "Journal",
    icon: <BookOpen className="h-4 w-4 shrink-0" aria-hidden="true" />,
  },
  {
    id: "profile",
    label: "Mom's profile",
    icon: <User className="h-4 w-4 shrink-0" aria-hidden="true" />,
  },
  {
    id: "docs",
    label: "Documents",
    icon: <Folder className="h-4 w-4 shrink-0" aria-hidden="true" />,
  },
  {
    id: "visits",
    label: "Visit summaries",
    icon: <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />,
  },
];

function NavItemButton({
  item,
  isActive,
  onNavigate,
  badge,
}: {
  item: NavItem;
  isActive: boolean;
  onNavigate: (id: string) => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      aria-current={isActive ? "page" : undefined}
      aria-label={item.label}
      onClick={() => onNavigate(item.id)}
      className={`flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13.5px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-app-shell-text)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-app-shell)] ${
        isActive
          ? "bg-[var(--color-primary)] text-white"
          : "text-[var(--color-app-shell-muted)] hover:bg-white/5 hover:text-[var(--color-app-shell-text)]"
      }`}
    >
      {item.icon}
      <span className="flex-1 text-left">{item.label}</span>
      {badge !== undefined && badge > 0 && (
        <span
          className={`ml-auto font-mono text-[11px] rounded-md px-1.5 py-px ${
            isActive
              ? "bg-white/20 text-white"
              : "bg-white/10 text-[var(--color-app-shell-muted)]"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

/**
 * SageRail — dark sidebar navigation for the CareSync app shell.
 * Presentational only; does not mount into AppShellClient until UX-068c.
 */
export function SageRail({
  active,
  onNavigate,
  recipient,
  attentionCount,
}: SageRailProps) {
  const initial = recipient.name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("");

  return (
    <aside
      className="flex w-[220px] shrink-0 flex-col gap-1 bg-[var(--color-app-shell)] px-3.5 py-5 text-[var(--color-app-shell-text)]"
      aria-label="App navigation"
    >
      {/* Brand */}
      <div className="mb-3 flex items-center gap-2.5 border-b border-white/10 pb-4 pl-2">
        <div
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--color-primary)] font-display text-base italic font-medium text-white"
          aria-hidden="true"
        >
          c
        </div>
        <div>
          <div className="font-display text-lg leading-tight tracking-[-0.01em]">
            CareSync
          </div>
        </div>
      </div>

      {/* Today section */}
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-app-shell-muted)] opacity-65 px-2 pb-1.5 pt-3">
        Today
      </div>
      {TODAY_ITEMS.map((item) => (
        <NavItemButton
          key={item.id}
          item={item}
          isActive={active === item.id}
          onNavigate={onNavigate}
          badge={item.id === "brief" ? attentionCount : undefined}
        />
      ))}

      {/* Record section */}
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-app-shell-muted)] opacity-65 px-2 pb-1.5 pt-3">
        Record
      </div>
      {RECORD_ITEMS.map((item) => (
        <NavItemButton
          key={item.id}
          item={item}
          isActive={active === item.id}
          onNavigate={onNavigate}
        />
      ))}

      {/* Recipient footer */}
      <div className="mt-auto rounded-xl bg-white/[0.06] p-2.5 flex items-center gap-2.5">
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--color-tertiary-light)] to-[var(--color-secondary)] text-sm font-semibold text-white"
          aria-hidden="true"
        >
          {initial}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-[var(--color-app-shell-text)]">
            {recipient.name}
          </div>
          <div className="font-mono text-[11.5px] text-[var(--color-app-shell-muted)] uppercase tracking-[0.04em]">
            {recipient.age} · {recipient.relationship}
          </div>
        </div>
      </div>
    </aside>
  );
}
