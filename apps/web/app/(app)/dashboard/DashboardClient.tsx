"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase";
import type { User } from "@supabase/supabase-js";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type CareTeam = {
  org: { id: string; name: string };
  recipientId: string;
};

type Props = {
  user: User;
};

export function DashboardClient({ user }: Props) {
  const router = useRouter();
  const [teams, setTeams] = useState<CareTeam[]>([]);
  const [loading, setLoading] = useState(true);

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
      const { data: memberships } = await supabase
        .from("memberships")
        .select("org_id, recipient_id, organizations(id, name)")
        .eq("user_id", user.id)
        .not("accepted_at", "is", null);

      type Membership = {
        org_id: string;
        recipient_id: string;
        organizations: { id: string; name: string } | null;
      };

      if (memberships) {
        const seen = new Set<string>();
        const result: CareTeam[] = [];

        for (const m of memberships as unknown as Membership[]) {
          const org = m.organizations;
          if (!org || seen.has(org.id)) continue;
          seen.add(org.id);

          // Each org can have multiple recipients (agency model), but for
          // family use we only need the first one to navigate to the journal.
          const { data: recipients } = await supabase
            .from("care_recipients")
            .select("id")
            .eq("org_id", org.id)
            .limit(1);

          if (recipients?.[0]) {
            result.push({ org, recipientId: recipients[0].id });
          }
        }
        setTeams(result);
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
      <div className="max-w-4xl mx-auto py-12 px-4">
        <h1 className="text-2xl font-semibold text-foreground mb-2">
          Your care teams
        </h1>
        <p className="text-foreground/80 mb-8">
          Coordinate care, track medications, and support your team.
        </p>

        {teams.length === 0 ? (
          <Card className="p-8 text-center">
            <CardContent className="p-0">
              <p className="text-muted-foreground text-sm mb-6">
                You do not have any care teams yet. Set one up to get started.
              </p>
              <a
                href="/onboarding"
                className="inline-block px-6 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
              >
                Set up a care team
              </a>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {teams.map((team) => (
              <Card
                key={team.org.id}
                className="cursor-pointer hover:border-border/80 transition-colors"
                onClick={() => {
                  router.push("/journal/" + team.recipientId);
                }}
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold text-foreground truncate">
                        {team.org.name}
                      </h2>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        View care journal
                      </p>
                    </div>
                    <svg
                      className="w-5 h-5 text-muted-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </CardContent>
              </Card>
            ))}
            <a
              href="/onboarding"
              className="block text-center text-sm text-muted-foreground hover:text-foreground/80 py-2"
            >
              Add another care team
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
