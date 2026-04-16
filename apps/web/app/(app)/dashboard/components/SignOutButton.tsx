"use client";

import { createClient } from "../../../../lib/supabase";
import { useRouter } from "next/navigation";
import { clearAll as clearOfflineQueue } from "../../../../lib/offline-queue";

export function SignOutButton() {
  const supabase = createClient();
  const router = useRouter();

  async function handleSignOut() {
    await clearOfflineQueue();
    await supabase.auth.signOut();
    router.push("/signin");
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
