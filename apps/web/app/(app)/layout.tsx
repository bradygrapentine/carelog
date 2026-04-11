import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";
import { AppShellClient } from "../../components/app/AppShellClient";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const email = user.email ?? "";
  const userInitials = email.slice(0, 2).toUpperCase();

  return (
    <AppShellClient userInitials={userInitials}>{children}</AppShellClient>
  );
}
