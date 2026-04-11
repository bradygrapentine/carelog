import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";
import { TeamAdminClient } from "./TeamAdminClient";

export default async function TeamAdminPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id, role")
    .eq("user_id", user.id)
    .not("accepted_at", "is", null)
    .single();

  if (!membership || membership.role !== "coordinator") {
    redirect("/dashboard");
  }

  return <TeamAdminClient orgId={membership.org_id} userId={user.id} />;
}
