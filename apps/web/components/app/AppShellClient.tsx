"use client";

import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { clearAll as clearOfflineQueue } from "@/lib/offline-queue";
import { AppTabBar } from "./AppTabBar";
import { SageRail } from "./SageRail";
import { SageTopBar } from "./SageTopBar";
import { CommandPalette } from "@/components/CommandPalette";
import { QuickLogFab } from "@/components/QuickLogFab";
import { LiveRegion } from "@/components/a11y/LiveRegion";

type Props = {
  userInitials: string;
  children: React.ReactNode;
};

const NAV_ID_TO_PATH: Record<string, string> = {
  brief: "/dashboard",
  today: "/dashboard",
  meds: "/medications",
  shifts: "/shifts",
  journal: "/journal",
  profile: "/profile",
  docs: "/documents",
  visits: "/visits",
};

const PATH_TO_NAV_ID: Record<string, string> = {
  dashboard: "brief",
  medications: "meds",
  shifts: "shifts",
  journal: "journal",
  profile: "profile",
  documents: "docs",
  visits: "visits",
};

const PATH_TO_TITLE: Record<string, string> = {
  brief: "Daily brief",
  meds: "Medications",
  shifts: "Shifts",
  journal: "Journal",
  profile: "Profile",
  docs: "Documents",
  visits: "Visit summaries",
};

export function AppShellClient({ userInitials, children }: Props) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const sageShell = searchParams?.get("shell") === "sage";

  async function handleSignOut() {
    const supabase = createClient();
    try {
      await clearOfflineQueue();
      await supabase.auth.signOut();
    } catch {
      // best-effort logout even if cleanup fails
    } finally {
      window.location.href = "/signin";
    }
  }

  if (sageShell) {
    const firstSegment = pathname?.split("/").filter(Boolean)[0] ?? "dashboard";
    const activeId = PATH_TO_NAV_ID[firstSegment] ?? "brief";
    const title = PATH_TO_TITLE[activeId] ?? "CareSync";

    function navigate(id: string) {
      const dest = NAV_ID_TO_PATH[id];
      if (!dest) return;
      const url = `${dest}?shell=sage`;
      router.push(url);
    }

    return (
      <div className="flex min-h-screen bg-[var(--color-surface)]">
        <SageRail
          active={activeId}
          onNavigate={navigate}
          recipient={{ name: "Margaret H.", age: 82, relationship: "Mom" }}
        />
        <div className="flex flex-1 flex-col min-w-0">
          <SageTopBar title={title} />
          <main role="main" className="flex-1">
            {children}
          </main>
        </div>
        <CommandPalette onSignOut={handleSignOut} />
        <QuickLogFab />
        <LiveRegion />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-surface)]">
      <AppTabBar userInitials={userInitials} onSignOut={handleSignOut} />
      <main role="main" className="flex-1">
        {children}
      </main>
      <CommandPalette onSignOut={handleSignOut} />
      <QuickLogFab />
      <LiveRegion />
    </div>
  );
}
