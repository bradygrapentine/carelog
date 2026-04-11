import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";
import { BillingClient } from "./BillingClient";

export default async function BillingPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { data: membership } = await supabase
    .from("memberships")
    .select("org_id, role, organizations(id, name, plan)")
    .eq("user_id", user.id)
    .not("accepted_at", "is", null)
    .limit(1)
    .single();

  if (!membership) redirect("/dashboard");

  const org = membership.organizations as unknown as {
    id: string;
    name: string;
    plan: string;
  };

  return <BillingClient org={org} role={membership.role} />;
}
