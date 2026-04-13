import { createServerSupabase } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import { ErrorBoundary } from "../../../components/ErrorBoundary";
import { DashboardClient } from "./DashboardClient";
import { DashboardViewTracker } from "./DashboardViewTracker";

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .not("accepted_at", "is", null)
    .limit(1)
    .maybeSingle();

  return (
    <ErrorBoundary>
      <DashboardViewTracker orgId={membership?.org_id ?? undefined} />
      <DashboardClient user={user} />
    </ErrorBoundary>
  );
}
