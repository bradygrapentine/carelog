import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";
import { AppShellClient } from "../../components/app/AppShellClient";
import { AIAssistantProvider } from "@/components/ai/AIAssistantProvider";
import { Toaster } from "sonner";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const email = user.email ?? "";
  const userInitials = email.slice(0, 2).toUpperCase();

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  const orgId = membership?.org_id ?? null;

  return (
    <>
      <Toaster position="top-right" richColors />
      <AppShellClient userInitials={userInitials}>
        {orgId ? (
          <AIAssistantProvider orgId={orgId}>{children}</AIAssistantProvider>
        ) : (
          children
        )}
      </AppShellClient>
    </>
  );
}
