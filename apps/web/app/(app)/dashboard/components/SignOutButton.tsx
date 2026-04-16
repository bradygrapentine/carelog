"use client";

import { createClient } from "../../../../lib/supabase";
import { useRouter } from "next/navigation";
import { clearAll as clearOfflineQueue } from "../../../../lib/offline-queue";

export function SignOutButton() {
  const supabase = createClient();
  const router = useRouter();

  async function handleSignOut() {
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
    <button
      onClick={handleSignOut}
      className="text-sm text-muted-foreground hover:text-foreground/80"
    >
      Sign out
    </button>
  );
}
