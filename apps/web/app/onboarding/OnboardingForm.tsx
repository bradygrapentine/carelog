"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase";
import { authenticatedFetch } from "../../lib/authenticatedFetch";
import posthog from "posthog-js";
import { ErrorBanner } from "../../components/ui/ErrorBanner";

export function OnboardingForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Read form values BEFORE any async calls
    const form = e.currentTarget;
    const recipientName = (
      form.elements.namedItem("recipientName") as HTMLInputElement
    ).value;
    const recipientDob = (
      form.elements.namedItem("recipientDob") as HTMLInputElement
    ).value;
    const orgName = (form.elements.namedItem("orgName") as HTMLInputElement)
      .value;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/signin");
      return;
    }

    let res: Response;
    try {
      res = await authenticatedFetch("/api/onboarding/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName,
          recipientDob: recipientDob || null,
          orgName,
        }),
      });
    } catch {
      setError(
        "We couldn't reach the server. Check your connection and try again.",
      );
      setLoading(false);
      return;
    }

    let data: { orgId?: string; error?: string };
    try {
      data = await res.json();
    } catch {
      setError("We couldn't finish setup. Try again, or email hello@care-log.org if it keeps failing.");
      setLoading(false);
      return;
    }

    if (!res.ok || data.error) {
      setError("We couldn't finish setup. Try again, or email hello@care-log.org if it keeps failing.");
      setLoading(false);
      return;
    }

    try {
      posthog.capture("care_team_created", { org_id: data.orgId });
      posthog.identify(user.id, { org_id: data.orgId }); // UUID + org_id only — never email (PHI)
    } catch {
      // PostHog failures are non-blocking — proceed to redirect.
    }
    const pendingInvite = sessionStorage.getItem("pending_invite");
    const target = pendingInvite ? "/invite/" + pendingInvite : "/dashboard";
    router.replace(target);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-foreground/80 mb-1">
          Who are you caring for?
          <span className="text-[var(--color-danger)] ml-1">*</span>
        </label>
        <input
          name="recipientName"
          type="text"
          required
          placeholder="e.g. Margaret Smith"
          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Their name is stored securely and only visible to your care team.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground/80 mb-1">
          Date of birth
          <span className="text-muted-foreground ml-1">(optional)</span>
        </label>
        <input
          name="recipientDob"
          type="date"
          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground/80 mb-1">
          What would you like to call this care team?
          <span className="text-[var(--color-danger)] ml-1">*</span>
        </label>
        <input
          name="orgName"
          type="text"
          required
          placeholder="e.g. The Smith Family"
          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          This is how your team will be identified in the app.
        </p>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 px-4 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Setting up your care team..." : "Create care team"}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        You can invite team members after setup.
      </p>
    </form>
  );
}
