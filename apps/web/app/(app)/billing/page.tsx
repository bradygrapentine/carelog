"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function BillingPage() {
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<{
    id: string;
    name: string;
    plan: string;
    stripe_id: string | null;
  } | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        window.location.href = "/signin";
        return;
      }

      const { data: membership } = await supabase
        .from("memberships")
        .select("org_id, role, organizations(id, name, plan, stripe_id)")
        .eq("user_id", user.id)
        .not("accepted_at", "is", null)
        .limit(1)
        .single();

      if (membership) {
        const orgData = membership.organizations as unknown as {
          id: string;
          name: string;
          plan: string;
          stripe_id: string | null;
        };
        setOrg(orgData);
        setRole(membership.role);
      }
      setLoading(false);
    });
  }, []);

  async function handleManage() {
    if (!org) return;
    const res = await fetch("/api/stripe/portal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orgId: org.id }),
    });
    if (res.ok) {
      const { url } = await res.json();
      window.location.href = url;
    }
  }

  async function handleUpgrade(interval: "month" | "year") {
    if (!org) return;
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orgId: org.id, interval }),
    });
    if (res.ok) {
      const { url } = await res.json();
      window.location.href = url;
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-[var(--color-muted)]">Loading...</p>
      </div>
    );
  }

  if (role !== "coordinator") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-sm text-center">
          <CardContent className="pt-6">
            <p className="text-sm text-[var(--color-muted)]">
              Contact your coordinator to manage billing.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPaid = org?.plan !== "free";

  return (
    <div className="mx-auto max-w-lg px-6 py-12">
      <h1 className="mb-8 text-2xl font-bold text-[var(--color-ink)]">
        Billing
      </h1>

      <Card>
        <CardHeader>
          <p className="text-lg font-bold text-[var(--color-ink)]">
            {isPaid ? "Family Plan" : "Free Plan"}
          </p>
        </CardHeader>
        <CardContent>
          {isPaid ? (
            <div>
              <p className="mb-4 text-sm text-[var(--color-muted)]">
                Your team has full access to all Carelog features.
              </p>
              <Button onClick={handleManage}>Manage subscription</Button>
            </div>
          ) : (
            <div>
              <p className="mb-4 text-sm text-[var(--color-muted)]">
                Upgrade to unlock unlimited team members, medications, shifts,
                documents, and more.
              </p>
              <div className="flex gap-3">
                <Button onClick={() => handleUpgrade("month")}>$14/mo</Button>
                <Button variant="outline" onClick={() => handleUpgrade("year")}>
                  $120/yr (save 29%)
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
