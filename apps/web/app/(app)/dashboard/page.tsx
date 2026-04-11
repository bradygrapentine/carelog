import { createServerSupabase } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import { ErrorBoundary } from "../../../components/ErrorBoundary";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  return (
    <ErrorBoundary>
      <DashboardClient user={user} />
    </ErrorBoundary>
  );
}
