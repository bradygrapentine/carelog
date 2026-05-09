import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";
import { AppShellClient } from "../../components/app/AppShellClient";
import { AIAssistantProvider } from "@/components/ai/AIAssistantProvider";
import { PostHogInit } from "@/components/PostHogInit";
import { Toaster } from "sonner";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const email = user.email ?? "";
  const userInitials = email.slice(0, 2).toUpperCase();

  // TD-108: pick a primary org for multi-org caregivers. `.single()` errors
  // (PGRST116) for users with 2+ accepted memberships and silently nulls
  // orgId, breaking the AI assistant for them. Use earliest accepted_at as
  // the stable "primary" — a per-user "default org" preference can layer on
  // later if needed (filed as follow-up if 2+ users complain).
  const { data: memberships } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .not("accepted_at", "is", null)
    .order("accepted_at", { ascending: true })
    .limit(1);
  const orgId = memberships?.[0]?.org_id ?? null;

  return (
    <>
      <PostHogInit />
      <Toaster position="top-right" richColors />
      <AppShellClient userInitials={userInitials}>
        <AIAssistantProvider orgId={orgId ?? ""}>
          {children}
        </AIAssistantProvider>
      </AppShellClient>
    </>
  );
}
