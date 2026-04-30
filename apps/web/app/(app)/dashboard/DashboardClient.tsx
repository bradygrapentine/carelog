"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../lib/supabase";
import type { User } from "@supabase/supabase-js";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, ChevronRight } from "lucide-react";
import { BriefHero } from "@/components/dashboard/BriefHero";
import { MedCard } from "@/components/dashboard/MedCard";
import { MoodCard } from "@/components/dashboard/MoodCard";
import {
  DashboardViewToggle,
  loadDashboardView,
  type DashboardView,
} from "@/components/dashboard/DashboardViewToggle";
import { RecipientSummaryCard } from "@/components/dashboard/RecipientSummaryCard";
import { NowBoard } from "@/components/dashboard/NowBoard";

type CareTeam = {
  org: { id: string; name: string };
  recipientId: string;
  recipientName: string | null;
  role: string;
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

type Props = {
  user: User;
};

export function DashboardClient({ user }: Props) {
  const router = useRouter();
  const [teams, setTeams] = useState<CareTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(
    null,
  );
  // View toggle state — hydrated from localStorage on mount (single is default)
  const [dashboardView, setDashboardView] = useState<DashboardView>("single");

  // Hydrate view preference from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    setDashboardView(loadDashboardView());
  }, []);

  // Default the chip selection to the first team once data loads.
  useEffect(() => {
    if (teams.length > 0 && selectedRecipientId === null) {
      setSelectedRecipientId(teams[0]!.recipientId);
    }
  }, [teams, selectedRecipientId]);

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

          // Fetch recipient display name from the PHI-safe display_names cache
          // (RLS allows team members to read; identity_vault is service_role only).
          let recipientName: string | null = null;
          if (recipients?.[0]) {
            const { data: dn } = await supabase
              .from("display_names")
              .select("full_name")
              .eq("recipient_id", recipients[0].id)
              .maybeSingle();
            recipientName = dn?.full_name ?? null;
          }

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
              recipientName,
              role: m.role,
              eventCount,
              months,
            });
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

  // Derive focused team: use selectedRecipientId when set (handles multi-team
  // switcher); fall back to first team for N=1 or before the chip has been clicked.
  const focusedTeam =
    teams.find((t) => t.recipientId === selectedRecipientId) ??
    teams[0] ??
    null;
  const recipientFullName = focusedTeam?.recipientName ?? null;
  const recipientFirstName = recipientFullName
    ? recipientFullName.split(" ")[0] ?? recipientFullName
    : null;

  // Whether to show layout B (stacked) — only possible when N > 1
  const isStackedView = teams.length > 1 && dashboardView === "stacked";
  // Whether to show the UX-056 Now Board timeline.
  const isNowView = dashboardView === "now";

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <div className="max-w-5xl mx-auto py-12 px-4">
        {/* Heading row: recipient name (layout A) or "Your care recipients" (layout B) */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            {isStackedView ? (
              <h1 className="text-2xl font-semibold text-[var(--color-ink)]">
                Your care recipients
              </h1>
            ) : recipientFirstName ? (
              <h1 className="headline-display text-[clamp(2rem,4vw,2.5rem)]">
                Caring for <em>{recipientFirstName}</em>
              </h1>
            ) : (
              <h1 className="text-2xl font-semibold text-foreground">
                Your care dashboard
              </h1>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* View toggle — shown whenever the user has any care teams.
                The "stacked" option only renders when N > 1. */}
            {teams.length > 0 && (
              <DashboardViewToggle
                view={dashboardView}
                onChange={setDashboardView}
                showStacked={teams.length > 1}
              />
            )}
            <button
              type="button"
              onClick={() => router.push("/visit-summary")}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm font-medium text-[var(--color-ink)] hover:bg-[var(--color-primary-subtle)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 min-h-[40px]"
              aria-label="Generate visit summary"
            >
              <Printer className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Generate visit summary</span>
              <span className="sm:hidden">Visit summary</span>
            </button>
          </div>
        </div>

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
        ) : isNowView ? (
          /*
            UX-056: Now Board timeline view — past / now / up next, mood-bordered cards.
            Wired to focusedTeam (selectedRecipientId-driven) so the recipient
            switcher chips below also re-target the timeline.
          */
          <>
            <div className="mb-6">
              <NowBoard recipientId={focusedTeam?.recipientId} />
            </div>
            {teams.length >= 2 && (
              <div className="mb-6">
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                  Your care recipients
                </p>
                <div className="flex flex-wrap gap-2">
                  {teams.map((team) => {
                    const isSelected = team.recipientId === selectedRecipientId;
                    const firstName =
                      team.recipientName?.split(" ")[0] ?? team.org.name;
                    return (
                      <button
                        key={team.org.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() =>
                          setSelectedRecipientId(team.recipientId)
                        }
                        className={
                          "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 " +
                          (isSelected
                            ? "bg-[var(--color-primary-subtle)] border-[var(--color-primary)] text-[var(--color-primary)]"
                            : "bg-card border-[var(--color-border)] text-foreground hover:border-[var(--color-primary)]/40")
                        }
                      >
                        {firstName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : isStackedView ? (
          /*
            Layout B (UX-039b): stacked-by-recipient view.
            Each recipient gets a summary card with a brief excerpt and CTA.
            Shown only when N > 1 AND the user has toggled to "stacked".
          */
          <>
            <div className="space-y-4 mb-6">
              {teams.map((team) => {
                const firstName =
                  team.recipientName?.split(" ")[0] ?? team.org.name;
                return (
                  <RecipientSummaryCard
                    key={team.recipientId}
                    recipientId={team.recipientId}
                    orgId={team.org.id}
                    firstName={firstName}
                    fullName={team.recipientName}
                  />
                );
              })}
            </div>
            <Link
              href="/onboarding"
              className="text-sm text-muted-foreground hover:text-foreground/80 py-2 rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
            >
              Add another care team
            </Link>
          </>
        ) : (
          /*
            Layout A (UX-039a + UX-039b): single-focused view.
            BriefHero + MedCard + MoodCard wired to the focused (selected) team.
            Multi-team: chip strip below for switching — clicking a chip now
            rewires BriefHero/MedCard/MoodCard to the selected recipient (UX-039b).
            ReferralCard moved to Settings (UX-039a).
          */
          <>
            {/* BriefHero + side cards — wired to focusedTeam (selectedRecipientId-driven) */}
            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-[1.6fr_1fr]">
              <BriefHero
                recipientId={focusedTeam?.recipientId}
                orgId={focusedTeam?.org.id}
              />
              <div className="flex flex-col gap-4">
                <MedCard
                  recipientId={focusedTeam?.recipientId}
                  orgId={focusedTeam?.org.id}
                />
                <MoodCard
                  recipientId={focusedTeam?.recipientId}
                  orgId={focusedTeam?.org.id}
                />
              </div>
            </div>

            {/* Secondary chrome: recipient switcher chips — hidden when N=1 */}
            {teams.length >= 2 && (
              <div className="mb-6">
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                  Your care recipients
                </p>
                <div className="flex flex-wrap gap-2">
                  {teams.map((team) => {
                    const isSelected = team.recipientId === selectedRecipientId;
                    const firstName =
                      team.recipientName?.split(" ")[0] ?? team.org.name;
                    const initials = (team.recipientName ?? team.org.name)
                      .split(" ")
                      .map((w) => w[0] ?? "")
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();
                    return (
                      <button
                        key={team.org.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() =>
                          setSelectedRecipientId(team.recipientId)
                        }
                        className={
                          "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 " +
                          (isSelected
                            ? "bg-[var(--color-primary-subtle)] border-[var(--color-primary)] text-[var(--color-primary)]"
                            : "bg-card border-[var(--color-border)] text-foreground hover:border-[var(--color-primary)]/40")
                        }
                      >
                        <span
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-tertiary-subtle)] text-[10px] font-semibold text-[var(--color-tertiary)]"
                          aria-hidden="true"
                        >
                          {initials}
                        </span>
                        {firstName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Open journal CTA + add team link */}
            <div className="flex flex-wrap items-center gap-4 mb-4">
              {focusedTeam && (
                <Link
                  href={"/journal/" + focusedTeam.recipientId}
                  aria-label={`Open care journal for ${focusedTeam.org.name}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary)]/90 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
                >
                  Open care journal
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              )}
              <Link
                href="/onboarding"
                className="text-sm text-muted-foreground hover:text-foreground/80 py-2 rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
              >
                Add another care team
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
