"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { AppTabBar } from "./AppTabBar";
import type { AppTab } from "./AppTabBar";

// Auth is intentionally client-side — matches DashboardClient pattern.
// In local dev the session cookie name doesn't match what @supabase/ssr
// expects; this resolves automatically on Supabase Cloud.
export function AppShellClient({ children }: { children: React.ReactNode }) {
  const [userInitials, setUserInitials] = useState("…");
  const [activeTab, setActiveTab] = useState<AppTab>("journal");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        window.location.href = "/signin";
        return;
      }
      const email = user.email ?? "";
      setUserInitials(email.slice(0, 2).toUpperCase());
    });
  }, []);

  function handleSignOut() {
    const supabase = createClient();
    supabase.auth.signOut().then(() => {
      window.location.href = "/signin";
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-surface)]">
      <AppTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        userInitials={userInitials}
        onSignOut={handleSignOut}
      />
      <main id={activeTab + "-panel"} role="tabpanel" className="flex-1">
        {children}
      </main>
    </div>
  );
}
