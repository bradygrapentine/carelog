import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";
import EntryDetailClient from "./EntryDetailClient";

export default async function EntryDetailPage({
  params,
}: {
  params: Promise<{ recipientId: string; eventId: string }>;
}) {
  const { recipientId, eventId } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  return (
    <EntryDetailClient
      recipientId={recipientId}
      eventId={eventId}
      userId={user.id}
    />
  );
}
