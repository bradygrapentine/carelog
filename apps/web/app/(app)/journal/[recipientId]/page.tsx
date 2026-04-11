import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";
import { ErrorBoundary } from "../../../../components/ErrorBoundary";
import { JournalClient } from "./JournalClient";

export default async function JournalPage({
  params,
}: Readonly<{
  params: Promise<{ recipientId: string }>;
}>) {
  const { recipientId } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  return (
    <ErrorBoundary>
      <Suspense>
        <JournalClient recipientId={recipientId} user={user} />
      </Suspense>
    </ErrorBoundary>
  );
}
