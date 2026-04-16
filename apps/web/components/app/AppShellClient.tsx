"use client";

import { createClient } from "@/lib/supabase";
import { clearAll as clearOfflineQueue } from "@/lib/offline-queue";
import { AppTabBar } from "./AppTabBar";

type Props = {
  userInitials: string;
  children: React.ReactNode;
};

export function AppShellClient({ userInitials, children }: Props) {
  function handleSignOut() {
    const supabase = createClient();
    clearOfflineQueue().finally(() => {
      supabase.auth.signOut().then(() => {
        window.location.href = "/signin";
      });
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-surface)]">
      <AppTabBar userInitials={userInitials} onSignOut={handleSignOut} />
      <main role="main" className="flex-1">
        {children}
      </main>
    </div>
  );
}
