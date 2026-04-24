"use client";

import { createClient } from "@/lib/supabase";
import { clearAll as clearOfflineQueue } from "@/lib/offline-queue";
import { AppTabBar } from "./AppTabBar";
import { CommandPalette } from "@/components/CommandPalette";
import { QuickLogFab } from "@/components/QuickLogFab";

type Props = {
  userInitials: string;
  children: React.ReactNode;
};

export function AppShellClient({ userInitials, children }: Props) {
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

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-surface)]">
      <AppTabBar userInitials={userInitials} onSignOut={handleSignOut} />
      <main role="main" className="flex-1">
        {children}
      </main>
      <CommandPalette onSignOut={handleSignOut} />
      <QuickLogFab />
    </div>
  );
}
