"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const TAB_PANELS: Record<string, string> = {
  journal: "journal",
  medications: "medications",
  team: "team",
  shifts: "shifts",
  documents: "documents",
  more: "more",
};

// Tabs that route to standalone pages (not journal panels)
const STANDALONE_ROUTES: Record<string, string> = {
  education: "/education",
};

const TABS: { id: string; label: string; icon: string }[] = [
  { id: "journal", label: "Journal", icon: "📋" },
  { id: "medications", label: "Medications", icon: "💊" },
  { id: "team", label: "Team", icon: "👥" },
  { id: "shifts", label: "Shifts", icon: "📅" },
  { id: "documents", label: "Documents", icon: "📁" },
  { id: "education", label: "Education", icon: "🎓" },
  { id: "more", label: "More", icon: "⋯" },
];

type Props = {
  userInitials: string;
  onSignOut?: () => void;
};

function AppTabBarInner({ userInitials, onSignOut }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const journalMatch = pathname?.match(/^\/journal\/([^/?]+)/);
  const recipientId = journalMatch ? journalMatch[1] : null;

  const panelParam = searchParams?.get("panel") ?? "journal";
  const activeTab = pathname?.startsWith("/education")
    ? "education"
    : panelParam in TAB_PANELS
      ? panelParam
      : "journal";

  function handleTabClick(tabId: string) {
    if (tabId in STANDALONE_ROUTES) {
      router.push(STANDALONE_ROUTES[tabId]!);
      return;
    }
    if (!recipientId) return;
    router.push("/journal/" + recipientId + "?panel=" + tabId);
  }

  return (
    <header className="sticky top-0 z-50 w-full bg-[var(--color-ink)] shadow-md">
      <div className="mx-auto flex max-w-screen-xl items-center justify-between px-4 md:px-6">
        {/* Logo — returns to dashboard */}
        <Link
          href="/dashboard"
          aria-label="Go to dashboard"
          className="flex items-center gap-2 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] focus:ring-offset-2 focus:ring-offset-[var(--color-ink)]"
        >
          <span
            className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--color-primary-light)]"
            aria-hidden="true"
          />
          <span className="text-sm font-bold text-white">CareSync</span>
        </Link>

        {/* Tab list — desktop (only inside a team context) */}
        {recipientId && (
          <nav
            role="tablist"
            aria-label="App navigation"
            className="hidden items-center overflow-x-auto md:flex"
          >
            {TABS.map(({ id, label }) => {
              const isActive = id === activeTab;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={id + "-panel"}
                  onClick={() => handleTabClick(id)}
                  className={cn(
                    "flex items-center gap-1.5 border-b-2 px-4 py-4 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] focus:ring-inset",
                    isActive
                      ? "border-[var(--color-primary-light)] text-white"
                      : "border-transparent text-violet-300 hover:text-white",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </nav>
        )}

        {/* Right-hand controls */}
        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            aria-label="Settings"
            className="flex h-8 w-8 items-center justify-center rounded-full text-violet-300 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] focus:ring-offset-1 focus:ring-offset-[var(--color-ink)]"
          >
            <Settings size={18} aria-hidden="true" />
          </Link>
          <button
            onClick={() => {
              if (window.confirm("Sign out of CareSync?")) onSignOut?.();
            }}
            aria-label="Sign out"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-semibold text-white transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] focus:ring-offset-1 focus:ring-offset-[var(--color-ink)]"
          >
            {userInitials}
          </button>
        </div>
      </div>

      {/* Mobile tab strip — only inside a team context */}
      {recipientId && (
        <div
          role="tablist"
          aria-label="App navigation"
          className="flex overflow-x-auto border-t border-white/10 md:hidden"
        >
          {TABS.map(({ id, label, icon }) => {
            const isActive = id === activeTab;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={id + "-panel"}
                onClick={() => handleTabClick(id)}
                className={cn(
                  "flex min-w-[4.5rem] flex-col items-center gap-0.5 border-b-2 px-3 py-2 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] focus:ring-inset",
                  isActive
                    ? "border-[var(--color-primary-light)] text-white"
                    : "border-transparent text-violet-300 hover:text-white",
                )}
              >
                <span aria-hidden="true">{icon}</span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Active panel title — sr-only h1 announces current panel to screen readers */}
      {recipientId && (
        <h1 className="sr-only">
          {TABS.find((t) => t.id === activeTab)?.label ?? "Journal"}
        </h1>
      )}
    </header>
  );
}

export function AppTabBar(props: Props) {
  return (
    <Suspense fallback={null}>
      <AppTabBarInner {...props} />
    </Suspense>
  );
}
