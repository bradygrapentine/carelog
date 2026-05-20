import { createServerSupabase } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import { NotificationsClient } from "./NotificationsClient";

export const dynamic = "force-dynamic";

// ON-81: in-app task-notification feed + per-user task notification preferences.
export default async function NotificationsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");
  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <NotificationsClient />
    </main>
  );
}
