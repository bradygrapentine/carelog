"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase";
import type { User } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, ChevronRight } from "lucide-react";
import { BriefHero } from "@/components/dashboard/BriefHero";
import { MedCard } from "@/components/dashboard/MedCard";
import { MoodCard } from "@/components/dashboard/MoodCard";

type CareTeam = {
  org: { id: string; name: string };
  recipientId: string;
  eventCount: number;
  months: number;
};

export function formatCareStats(count: number, months: number): string {
  if (count === 0) return "";
  const eventLabel = count === 1 ? "1 event" : `${count} events`;
  if (months === 0) return `${eventLabel} · just started`;
  if (months === 1) return `${eventLabel} · 1 month`;
  return `${eventLabel} · ${months} months`;
}

/** Derive a URL-safe org slug: first 8 chars of name lowercased, falling back to org id. */
function deriveOrgSlug(org: { id: string; name: string }): string {
  const namePart = org.name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 8);
  return namePart.length >= 3 ? namePart : org.id;
}

type ReferralCardProps = {
  org: { id: string; name: string };
  userId: string;
};

function ReferralCard({ org, userId }: ReferralCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const slug = deriveOrgSlug(org);
    const url = `${window.location.origin}/signup?ref=${slug}`;

    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback for environments where clipboard API is unavailable
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }

    // Fire server-side PostHog event — UUID only, no PII
    void fetch("/api/referral/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orgId: org.id, userId }),
    });

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [org, userId]);

  return (
    <Card className="shadow-sm gap-2">
      <CardHeader className="-mt-4 px-4 py-3 bg-[var(--color-primary-subtle)] border-b border-[var(--color-border)]">
        <CardTitle className="text-sm">Refer a family</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 pb-4 px-4">
        <p className="text-sm text-muted-foreground mb-4">
          Know another family who could use coordination support? Share CareSync
          with them.
        </p>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy referral link to clipboard"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 min-h-[40px]"
        >
          {copied ? "Copied!" : "Copy referral link"}
        </button>
      </CardContent>
    </Card>
  );
}

type Props = {
  user: User;
};

export function DashboardClient({ user }: Props) {
  const router = useRouter();
  const [teams, setTeams] = useState<CareTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCoordinator, setIsCoordinator] = useState(false);
  const [firstOrg, setFirstOrg] = useState<{ id: string; name: string } | null>(
    null,
  );

  useEffect(() => {
    const supabase = createClient();

    (async () => {
      // Pending invite bridge: when a user visits /invite/TOKEN while not signed in,
      // the token is saved to sessionStorage before they're redirected to /signin.
      // After sign-in always lands here (/dashboard), we check for that saved token
      // and immediately bounce them back to their invite URL to complete acceptance.
      const pendingInvite = sessionStorage.getItem("pending_invite");
      if (pendingInvite) {
        sessionStorage.removeItem("pending_invite");
        router.push("/invite/" + pendingInvite);
        return;
      }

      // Pending billing bridge: pricing page stores selected plan in sessionStorage
      // before redirecting to /signin. After sign-in, we check for it here and
      // redirect to Stripe Checkout.
      const pendingPlan = sessionStorage.getItem("pendingPlan");
      if (pendingPlan) {
        sessionStorage.removeItem("pendingPlan");
        try {
          const { interval } = JSON.parse(pendingPlan);
          // Need org to create checkout — fetch memberships first, then use first org
          const { data: memberships } = await supabase
            .from("memberships")
            .select("org_id")
            .eq("user_id", user.id)
            .not("accepted_at", "is", null)
            .limit(1);

          if (memberships && memberships[0]) {
            const res = await fetch("/api/stripe/checkout", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                orgId: memberships[0].org_id,
                interval: interval ?? "month",
              }),
            });
            if (res.ok) {
              const { url } = await res.json();
              router.push(url);
              return;
            }
          }
        } catch {
          // If checkout fails, continue to dashboard normally
        }
      }

      // Only fetch accepted (active) memberships — pending invites have accepted_at = null.
      // Also fetch role to determine if user is a coordinator for any org.
      const { data: memberships } = await supabase
        .from("memberships")
        .select("org_id, recipient_id, role, organizations(id, name)")
        .eq("user_id", user.id)
        .not("accepted_at", "is", null);

      type Membership = {
        org_id: string;
        recipient_id: string;
        role: string;
        organizations: { id: string; name: string } | null;
      };

      if (memberships) {
        const seen = new Set<string>();
        const result: CareTeam[] = [];
        let coordinatorOrg: { id: string; name: string } | null = null;

        for (const m of memberships as unknown as Membership[]) {
          const org = m.organizations;
          if (!org || seen.has(org.id)) continue;
          seen.add(org.id);

          // Track first coordinator org for referral card
          if (m.role === "coordinator" && coordinatorOrg === null) {
            coordinatorOrg = org;
          }

          // Each org can have multiple recipients (agency model), but for
          // family use we only need the first one to navigate to the journal.
          const { data: recipients } = await supabase
            .from("care_recipients")
            .select("id")
            .eq("org_id", org.id)
            .limit(1);

          if (recipients?.[0]) {
            // Parallel queries: count of events and earliest event date
            const [countResult, earliestResult] = await Promise.all([
              supabase
                .from("care_events")
                .select("*", { count: "exact", head: true })
                .eq("org_id", org.id),
              supabase
                .from("care_events")
                .select("created_at")
                .eq("org_id", org.id)
                .order("created_at", { ascending: true })
                .limit(1),
            ]);

            const eventCount = countResult.count ?? 0;
            let months = 0;
            if (eventCount > 0 && earliestResult.data?.[0]?.created_at) {
              const daysDiff =
                (Date.now() -
                  new Date(earliestResult.data[0].created_at).getTime()) /
                86400000;
              months = Math.round(daysDiff / 30.44);
            }

            result.push({
              org,
              recipientId: recipients[0].id,
              eventCount,
              months,
            });
          }
        }
        setTeams(result);
        if (coordinatorOrg !== null) {
          setIsCoordinator(true);
          setFirstOrg(coordinatorOrg);
        }
      }

      setLoading(false);
    })();
  }, [user.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-surface)]">
        <div className="max-w-4xl mx-auto py-12 px-4 space-y-4">
          <Skeleton className="h-7 w-48 rounded" />
          <Skeleton className="h-4 w-72 rounded" />
          <div className="space-y-3 mt-4">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <div className="max-w-5xl mx-auto py-12 px-4">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="text-2xl font-semibold text-foreground">
            Your care teams
          </h1>
          <button
            type="button"
            onClick={() => router.push("/visit-summary")}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-primary-subtle)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 min-h-[40px] shrink-0"
            aria-label="Generate visit summary"
          >
            <Printer className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Generate visit summary</span>
            <span className="sm:hidden">Visit summary</span>
          </button>
        </div>
        <p className="text-foreground/80 mb-8">
          Coordinate care, track medications, and support your team.
        </p>

        {teams.length > 0 && (
          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-[1.6fr_1fr]">
            <BriefHero />
            <div className="flex flex-col gap-4">
              <MedCard />
              <MoodCard />
            </div>
          </div>
        )}

        {teams.length === 0 ? (
          <Card className="p-8 text-center">
            <CardContent className="p-0">
              <p className="text-muted-foreground text-sm mb-6">
                You do not have any care teams yet. Set one up to get started.
              </p>
              <Link
                href="/onboarding"
                className="inline-block px-6 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
              >
                Set up a care team
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {teams.map((team) => (
              <Link
                key={team.org.id}
                href={"/journal/" + team.recipientId}
                aria-label={`Open care journal for ${team.org.name}`}
                className="block rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
              >
                <Card className="cursor-pointer hover:border-[var(--color-tertiary)]/40 transition-colors">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-tertiary-subtle)] text-sm font-semibold text-[var(--color-tertiary)]"
                        aria-hidden="true"
                      >
                        {team.org.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-sm font-semibold text-foreground truncate">
                          {team.org.name}
                        </h2>
                        {team.eventCount > 0 && (
                          <p className="text-xs text-muted-foreground truncate">
                            {formatCareStats(team.eventCount, team.months)}
                          </p>
                        )}
                      </div>
                      <ChevronRight
                        className="w-4 h-4 text-muted-foreground shrink-0"
                        aria-hidden="true"
                      />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
            <Link
              href="/onboarding"
              className="block text-center text-sm text-muted-foreground hover:text-foreground/80 py-2 rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
            >
              Add another care team
            </Link>
            {isCoordinator && firstOrg !== null && (
              <ReferralCard org={firstOrg} userId={user.id} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
