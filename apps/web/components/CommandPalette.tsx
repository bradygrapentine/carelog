"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  MessageSquare,
  Settings,
  CreditCard,
  Users,
  Pill,
  Smile,
  UtensilsCrossed,
  HeartPulse,
  FileText,
  LogOut,
  UserPlus,
  Clock,
  Search,
} from "lucide-react";

const RECENT_KEY = "carelog:cmdk-recent";
const MAX_RECENT = 3;

type Command = {
  id: string;
  label: string;
  section: "jump" | "log" | "admin";
  icon: React.ReactNode;
  shortcut?: string;
  action: (router: ReturnType<typeof useRouter>) => void;
};

const ALL_COMMANDS: Command[] = [
  // Jump to
  {
    id: "goto-dashboard",
    label: "Dashboard",
    section: "jump",
    icon: <LayoutDashboard size={16} aria-hidden="true" />,
    action: (r) => r.push("/dashboard"),
  },
  {
    id: "goto-journal",
    label: "Journal",
    section: "jump",
    icon: <BookOpen size={16} aria-hidden="true" />,
    action: (r) => r.push("/journal"),
  },
  {
    id: "goto-messages",
    label: "Messages",
    section: "jump",
    icon: <MessageSquare size={16} aria-hidden="true" />,
    action: (r) => r.push("/messages"),
  },
  {
    id: "goto-team",
    label: "Team",
    section: "jump",
    icon: <Users size={16} aria-hidden="true" />,
    action: (r) => r.push("/team"),
  },
  {
    id: "goto-settings",
    label: "Settings",
    section: "jump",
    icon: <Settings size={16} aria-hidden="true" />,
    action: (r) => r.push("/settings"),
  },
  {
    id: "goto-subscriptions",
    label: "Subscriptions",
    section: "jump",
    icon: <CreditCard size={16} aria-hidden="true" />,
    action: (r) => r.push("/subscriptions"),
  },
  // Log
  {
    id: "log-medication",
    label: "Log medication",
    section: "log",
    icon: <Pill size={16} aria-hidden="true" />,
    action: (r) => r.push("/journal"),
  },
  {
    id: "log-mood",
    label: "Log mood",
    section: "log",
    icon: <Smile size={16} aria-hidden="true" />,
    action: (r) => r.push("/journal"),
  },
  {
    id: "log-meal",
    label: "Log meal",
    section: "log",
    icon: <UtensilsCrossed size={16} aria-hidden="true" />,
    action: (r) => r.push("/journal"),
  },
  {
    id: "log-bp",
    label: "Log BP",
    section: "log",
    icon: <HeartPulse size={16} aria-hidden="true" />,
    action: (r) => r.push("/journal"),
  },
  {
    id: "log-note",
    label: "Log note",
    section: "log",
    icon: <FileText size={16} aria-hidden="true" />,
    action: (r) => r.push("/journal"),
  },
  // Admin
  {
    id: "admin-settings",
    label: "Settings",
    section: "admin",
    icon: <Settings size={16} aria-hidden="true" />,
    action: (r) => r.push("/settings"),
  },
  {
    id: "admin-invite",
    label: "Invite member",
    section: "admin",
    icon: <UserPlus size={16} aria-hidden="true" />,
    action: (r) => r.push("/team"),
  },
  {
    id: "admin-signout",
    label: "Sign out",
    section: "admin",
    icon: <LogOut size={16} aria-hidden="true" />,
    action: () => {
      window.location.href = "/signin";
    },
  },
];

const SECTION_LABELS: Record<Command["section"], string> = {
  jump: "Jump to",
  log: "Log",
  admin: "Admin",
};

function getRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveRecent(id: string): void {
  const prev = getRecent().filter((r) => r !== id);
  const next = [id, ...prev].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

type Props = {
  onSignOut?: () => void;
};

export function CommandPalette({ onSignOut }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Open/close via ⌘K / Ctrl+K
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Focus input on open, restore focus on close
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement;
      setRecentIds(getRecent());
      setQuery("");
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      triggerRef.current?.focus();
    }
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  // Build filtered command list with sections
  const filteredCommands = (() => {
    const q = query.toLowerCase();
    const matches = (cmd: Command) =>
      cmd.label.toLowerCase().includes(q) ||
      SECTION_LABELS[cmd.section].toLowerCase().includes(q);

    const recentCommands = recentIds
      .map((id) => ALL_COMMANDS.find((c) => c.id === id))
      .filter((c): c is Command => !!c)
      .filter(matches);

    const jumpCommands = ALL_COMMANDS.filter(
      (c) => c.section === "jump" && matches(c),
    );
    const logCommands = ALL_COMMANDS.filter(
      (c) => c.section === "log" && matches(c),
    );
    const adminCommands = ALL_COMMANDS.filter(
      (c) => c.section === "admin" && matches(c),
    );

    type Section = { heading: string; commands: Command[] };
    const sections: Section[] = [];
    if (recentCommands.length > 0)
      sections.push({ heading: "Recent", commands: recentCommands });
    if (jumpCommands.length > 0)
      sections.push({ heading: "Jump to", commands: jumpCommands });
    if (logCommands.length > 0)
      sections.push({ heading: "Log", commands: logCommands });
    if (adminCommands.length > 0)
      sections.push({ heading: "Admin", commands: adminCommands });

    return sections;
  })();

  const flatCommands = filteredCommands.flatMap((s) => s.commands);

  function handleSelect(cmd: Command) {
    saveRecent(cmd.id);
    close();
    if (cmd.id === "admin-signout" && onSignOut) {
      onSignOut();
    } else {
      cmd.action(router);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatCommands.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = flatCommands[selectedIndex];
      if (cmd) handleSelect(cmd);
    }
  }

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.querySelector<HTMLElement>(
      `[data-index="${selectedIndex}"]`,
    );
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!open) return null;

  let flatIndex = 0;

  return (
    // Backdrop
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- backdrop dismissal; Esc keyboard handler at handleKeyDown covers keyboard close. See ShiftPopover for the same pattern; TD-* should migrate both to the Dialog primitive.
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/40 backdrop-blur-sm"
      onClick={close}
      aria-hidden="false"
    >
      {/* Modal */}
      <div
        role="dialog"
        aria-label="Command palette"
        aria-modal="true"
        className="relative w-full max-w-lg rounded-lg border border-[var(--color-border)] bg-card shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input row */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--color-border)]">
          <Search
            size={16}
            className="shrink-0 text-[var(--color-muted)]"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls="cmdk-list"
            aria-activedescendant={
              flatCommands[selectedIndex]
                ? `cmdk-item-${flatCommands[selectedIndex].id}`
                : undefined
            }
            placeholder="Search commands…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)] font-mono">
            Esc
          </kbd>
        </div>

        {/* Results list */}
        <ul
          id="cmdk-list"
          ref={listRef}
          role="listbox"
          aria-label="Commands"
          className="max-h-80 overflow-y-auto py-2"
        >
          {filteredCommands.length === 0 && (
            <li className="px-4 py-6 text-sm text-center text-[var(--color-muted)]">
              No commands found
            </li>
          )}
          {filteredCommands.map((section) => (
            <li key={section.heading} role="presentation">
              <p
                className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]"
                aria-hidden="true"
              >
                {section.heading}
              </p>
              <ul role="group" aria-label={section.heading}>
                {section.commands.map((cmd) => {
                  const idx = flatIndex++;
                  const isSelected = idx === selectedIndex;
                  return (
                    // eslint-disable-next-line jsx-a11y/click-events-have-key-events -- list item with role="option"; keyboard navigation (↑↓/Enter) is handled at the parent dialog level via handleKeyDown, matching the WAI-ARIA combobox pattern.
                    <li
                      key={cmd.id}
                      id={`cmdk-item-${cmd.id}`}
                      role="option"
                      aria-selected={isSelected}
                      data-index={idx}
                      className={[
                        "flex items-center gap-3 px-4 py-2 text-sm cursor-pointer select-none",
                        isSelected
                          ? "bg-[var(--color-primary-subtle)] text-[var(--color-ink)]"
                          : "text-[var(--color-ink)] hover:bg-[var(--color-primary-subtle)]",
                      ].join(" ")}
                      onClick={() => handleSelect(cmd)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <span className="shrink-0 text-[var(--color-muted)]">
                        {cmd.icon}
                      </span>
                      <span className="flex-1 truncate">{cmd.label}</span>
                      {cmd.shortcut && (
                        <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-muted)]">
                          {cmd.shortcut}
                        </kbd>
                      )}
                      {isSelected && (
                        <span className="sr-only">(selected)</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>

        {/* Footer hint */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-[var(--color-border)] text-[10px] text-[var(--color-muted)]">
          <span>
            <kbd className="font-mono">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="font-mono">↵</kbd> select
          </span>
          <span>
            <kbd className="font-mono">Esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}

// Hook for consuming ⌘K open state externally (optional convenience)
export { RECENT_KEY };
