import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/server/supabaseAdmin.server";
import { HistoryExportClient } from "./HistoryExportClient";
import { ChevronLeft } from "lucide-react";

export const metadata = {
  title: "Export care history — Carelog",
};

export default async function HistoryExportPage() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {}
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Look up coordinator membership + recipient for this user
  const { data: membership } = await supabaseAdmin
    .from("memberships")
    .select("org_id, role, accepted_at, care_recipients(id)")
    .eq("user_id", user.id)
    .eq("role", "coordinator")
    .not("accepted_at", "is", null)
    .limit(1)
    .single();

  // If not a coordinator, redirect back to settings with a message
  if (!membership) {
    redirect("/settings");
  }

  // Get the first recipient for this org (coordinators typically have one active org)
  const { data: recipient } = await supabaseAdmin
    .from("care_recipients")
    .select("id")
    .eq("org_id", membership.org_id)
    .limit(1)
    .single();

  if (!recipient) {
    redirect("/settings");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 lg:px-8">
      <div className="mb-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 rounded"
          aria-label="Back to settings"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Back to settings
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-[var(--color-ink)]">
        Export care history
      </h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Download a complete record of all care activity for sharing with
        healthcare providers or a new facility.
      </p>

      <div className="mt-8">
        <HistoryExportClient
          orgId={membership.org_id}
          recipientId={recipient.id}
        />
      </div>
    </div>
  );
}
