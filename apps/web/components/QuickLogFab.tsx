"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Plus,
  X,
  Pill,
  Smile,
  FileText,
  Activity,
  Utensils,
  Droplets,
} from "lucide-react";
import { cn } from "@/lib/utils";

type QuickLogAction = {
  id: string;
  label: string;
  icon: React.ReactNode;
  panel?: string;
  disabled?: boolean;
  comingSoon?: boolean;
};

const ACTIONS: QuickLogAction[] = [
  {
    id: "medication",
    label: "Log medication",
    icon: <Pill size={20} aria-hidden="true" />,
    panel: "medications",
  },
  {
    id: "mood",
    label: "Log mood",
    icon: <Smile size={20} aria-hidden="true" />,
    panel: "journal",
  },
  {
    id: "note",
    label: "Log note",
    icon: <FileText size={20} aria-hidden="true" />,
    panel: "journal",
  },
  {
    id: "bp",
    label: "Log BP",
    icon: <Activity size={20} aria-hidden="true" />,
    panel: "journal",
  },
  {
    id: "meal",
    label: "Log meal",
    icon: <Utensils size={20} aria-hidden="true" />,
    disabled: true,
    comingSoon: true,
  },
  {
    id: "hydration",
    label: "Log hydration",
    icon: <Droplets size={20} aria-hidden="true" />,
    disabled: true,
    comingSoon: true,
  },
];

export function QuickLogFab() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const journalMatch = pathname?.match(/^\/journal\/([^/?]+)/);
  const recipientId = journalMatch ? journalMatch[1] : null;

  const close = useCallback(() => setOpen(false), []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  // TD-150: when there's no recipientId in the URL (e.g. on /dashboard),
  // Quick log can't target a journal. Items are rendered disabled with a
  // hint banner above; clicks fall through to a no-op (defense-in-depth
  // since `disabled` HTMLButtonElement already blocks click handlers).
  function handleActionClick(action: QuickLogAction) {
    if (action.disabled) return;
    if (!recipientId) return;
    close();
    if (action.panel) {
      router.push(`/journal/${recipientId}?panel=${action.panel}`);
    }
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          aria-hidden="true"
          onClick={close}
          data-testid="quick-log-backdrop"
        />
      )}

      {/* FAB container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* Expanded menu */}
        {open && (
          <div
            id="quick-log-menu"
            role="menu"
            aria-label="Quick log actions"
            aria-describedby={
              recipientId ? undefined : "quick-log-no-recipient-hint"
            }
            className="flex flex-col gap-2 rounded-xl bg-card p-3 shadow-xl border border-[var(--color-border)]"
          >
            {!recipientId && (
              <p
                id="quick-log-no-recipient-hint"
                className="px-2 py-1 text-xs text-[var(--color-muted)] border-b border-[var(--color-border)] mb-1"
              >
                Open a recipient&apos;s journal first to log
              </p>
            )}
            {ACTIONS.map((action) => {
              const blocked = action.disabled || !recipientId;
              return (
                <button
                  key={action.id}
                  type="button"
                  role="menuitem"
                  onClick={() => handleActionClick(action)}
                  disabled={blocked}
                  aria-disabled={blocked ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-left transition-colors",
                    "focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2",
                    blocked
                      ? "cursor-not-allowed opacity-50 text-[var(--color-muted)]"
                      : "text-[var(--color-ink)] hover:bg-[var(--color-primary-subtle)]",
                  )}
                >
                  <span
                    className={
                      blocked
                        ? "text-[var(--color-muted)]"
                        : "text-[var(--color-primary)]"
                    }
                  >
                    {action.icon}
                  </span>
                  <span>{action.label}</span>
                  {action.comingSoon && (
                    <span className="ml-auto text-xs text-[var(--color-muted)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full px-2 py-0.5">
                      Soon
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* FAB button */}
        <button
          type="button"
          aria-label="Quick log"
          aria-expanded={open}
          aria-controls="quick-log-menu"
          onClick={() => setOpen((prev) => !prev)}
          // A11Y-021: icon-only FAB (X / Plus), WCAG 1.4.11 non-text 3:1 ✓ — primary write-action FAB stays filled-primary by design
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200",
            "bg-[var(--color-primary)] text-white",
            "hover:scale-110 active:scale-95",
            "focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2",
          )}
        >
          {open ? (
            <X size={24} aria-hidden="true" />
          ) : (
            <Plus size={24} aria-hidden="true" />
          )}
        </button>
      </div>
    </>
  );
}
