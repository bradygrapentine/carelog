"use client";

import { useState } from "react";
import { createClient } from "../../lib/supabase";
import { authenticatedFetch } from "../../lib/authenticatedFetch";
import posthog from "posthog-js";

export function OnboardingForm() {
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
      window.location.href = "/signin";
      return;
    }

    const res = await authenticatedFetch("/api/onboarding/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientName,
        recipientDob: recipientDob || null,
        orgName,
      }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      setError(data.error ?? "Something went wrong.");
      setLoading(false);
      return;
    }

    posthog.capture("care_team_created", { org_id: data.orgId });
    const pendingInvite = sessionStorage.getItem('pending_invite')
    window.location.href = pendingInvite ? '/invite/' + pendingInvite : '/dashboard'
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Who are you caring for?
          <span className="text-red-500 ml-1">*</span>
        </label>
        <input
          name="recipientName"
          type="text"
          required
          placeholder="e.g. Margaret Smith"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-400">
          Their name is stored securely and only visible to your care team.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Date of birth
          <span className="text-gray-400 ml-1">(optional)</span>
        </label>
        <input
          name="recipientDob"
          type="date"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          What would you like to call this care team?
          <span className="text-red-500 ml-1">*</span>
        </label>
        <input
          name="orgName"
          type="text"
          required
          placeholder="e.g. The Smith Family"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-400">
          This is how your team will be identified in the app.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 px-4 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Setting up your care team..." : "Create care team"}
      </button>

      <p className="text-center text-xs text-gray-400">
        You can invite team members after setup.
      </p>
    </form>
  );
}
