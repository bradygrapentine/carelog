import { Suspense } from "react";
import { createServerSupabase } from "@/lib/supabaseServer";
import { redirect } from "next/navigation";
import { ThreadList } from "./ThreadList";
import { MessageView } from "./MessageView";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
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

  const orgId = membership?.org_id ?? null;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      <aside
        aria-label="Conversations"
        className="w-72 shrink-0 border-r border-[var(--color-border)] overflow-y-auto"
      >
        <Suspense
          fallback={
            <div className="p-4 space-y-3">
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-3/4 rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-5/6 rounded" />
            </div>
          }
        >
          <ThreadList orgId={orgId} userId={user.id} />
        </Suspense>
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden">
        <Suspense
          fallback={
            <div className="flex-1 p-6 space-y-3">
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          }
        >
          <MessageView />
        </Suspense>
      </main>
    </div>
  );
}
