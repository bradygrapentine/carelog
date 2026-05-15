/**
 * UX-064 — discoverable Recipient Profile page.
 *
 * Server component. PHI rule: identity values flow through
 * `identityRepository.resolveIdentity` (service role); the client
 * `<RecipientProfile>` only ever sees already-decrypted strings.
 *
 * Mood, caregivers, and the family-written "About" paragraph are not
 * yet wired — see PR body for follow-up rows. v1 ships name + age +
 * conditions to land the route + identity flow.
 */

import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { createServerSupabase } from "@/lib/supabaseServer";
import {
  resolveIdentity,
  parseEmergencyInfo,
} from "@/server/repositories/identityRepository";
import { getCareTeamForRecipient } from "@/server/repositories/membershipsRepository";
import { getRecipientPreferences } from "@/server/repositories/recipientsRepository";
import { RecipientProfile } from "@/components/app/RecipientProfile";
import { LikesDislikesList } from "@/components/app/LikesDislikesList";
import { CareTeamList } from "@/components/app/CareTeamList";
import { EmergencyFooterCard } from "@/components/app/EmergencyFooterCard";

export const metadata: Metadata = {
  title: "Recipient profile",
};

function ageFromDob(dob: string | null): number | undefined {
  if (!dob) return undefined;
  const ms = Date.now() - new Date(dob).getTime();
  if (!Number.isFinite(ms) || ms < 0) return undefined;
  const years = ms / (365.25 * 24 * 60 * 60 * 1000);
  return Math.floor(years);
}

function conditionsFromDiagnoses(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw
    .map((entry) => {
      if (typeof entry === "string") return entry;
      if (
        entry &&
        typeof entry === "object" &&
        "name" in entry &&
        typeof (entry as { name: unknown }).name === "string"
      ) {
        return (entry as { name: string }).name;
      }
      return null;
    })
    .filter((s): s is string => Boolean(s && s.trim()));
  return out.length > 0 ? out : undefined;
}

export default async function RecipientProfilePage({
  params,
}: {
  params: Promise<{ recipientId: string }>;
}) {
  const { recipientId } = await params;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  // RLS scopes care_recipients to orgs the caller belongs to. A null result
  // means either the recipient doesn't exist or the caller has no access —
  // either way, treat as 404 to avoid leaking existence.
  const { data: recipient } = await supabase
    .from("care_recipients")
    .select("id, org_id, identity_token, diagnoses")
    .eq("id", recipientId)
    .single();

  if (!recipient) notFound();

  const [identity, careTeam, preferences] = await Promise.all([
    resolveIdentity(recipient.identity_token, recipient.org_id),
    getCareTeamForRecipient(supabase, recipient.org_id, recipient.id),
    getRecipientPreferences(supabase, recipient.org_id, recipient.id),
  ]);

  // UX-094: compose the full profile page. Likes/dislikes, care team, and
  // emergency-footer data are not yet plumbed — the components render their
  // empty states. Data wiring is follow-up work (see UX-066 + new rows TBD).
  return (
    <main className="mx-auto max-w-2xl px-4 lg:px-8 py-6 space-y-6">
      <RecipientProfile
        name={identity.full_name}
        age={ageFromDob(identity.dob)}
        conditions={conditionsFromDiagnoses(recipient.diagnoses)}
      />
      <LikesDislikesList
        likes={preferences.likes}
        dislikes={preferences.dislikes}
      />
      <CareTeamList members={careTeam} />
      <EmergencyFooterCard
        {...parseEmergencyInfo(identity.contact_info ?? {})}
      />
    </main>
  );
}
