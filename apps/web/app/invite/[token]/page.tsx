"use client";

import { use, useEffect, useState } from "react";
import { createClient } from "../../../lib/supabase";
import { authenticatedFetch } from "../../../lib/authenticatedFetch";

type Props = {
  params: Promise<{ token: string }>;
};

export default function InvitePage({ params }: Props) {
  // In Next.js 16 App Router, dynamic route params are a Promise.
  // React.use() unwraps the Promise synchronously within a client component.
  const { token } = use(params);
  const [status, setStatus] = useState<
    "loading" | "ready" | "accepting" | "done" | "error"
  >("loading");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [role, setRole] = useState("");

  useEffect(() => {
    fetch("/api/invite/" + token)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          setStatus("error");
        } else {
          setEmail(data.email);
          setOrgName(data.orgName);
          setRole(data.role);
          setStatus("ready");
        }
      })
      .catch(() => {
        setError("Failed to load invite.");
        setStatus("error");
      });
  }, [token]);

  async function handleAccept() {
    setStatus("accepting");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // Save the token to sessionStorage before redirecting to sign-in.
      // DashboardClient reads this after sign-in completes and bounces the user
      // back here so they can finish accepting the invite.
      sessionStorage.setItem("pending_invite", token);
      window.location.href = "/signin";
      return;
    }

    // Invite tokens are email-scoped: the accepting user must match the invited email.
    // We check client-side first to show a clear error before hitting the API.
    if (user.email?.toLowerCase().trim() !== email.toLowerCase().trim()) {
      setError(
        "You are signed in as " +
          user.email +
          " but this invite was sent to " +
          email +
          ". Please sign out and sign in with " +
          email +
          " to accept.",
      );
      setStatus("error");
      return;
    }

    const res = await authenticatedFetch("/api/invite/" + token + "/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      setError(data.error ?? "Failed to accept.");
      setStatus("error");
      return;
    }

    setStatus("done");
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 2000);
  }

  const roleLabels: Record<string, string> = {
    coordinator: "Coordinator",
    caregiver: "Caregiver",
    supporter: "Supporter",
    aide: "Professional aide",
  };

  if (status === "loading")
    return (
      <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );

  if (status === "done")
    return (
      <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center px-4">
        <div className="bg-card border border-border rounded-xl p-8 shadow-sm max-w-md w-full text-center">
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            You have joined the team
          </h1>
          <p className="text-sm text-muted-foreground">
            Taking you to your dashboard...
          </p>
        </div>
      </div>
    );

  if (status === "error")
    return (
      <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center px-4">
        <div className="bg-card border border-border rounded-xl p-8 shadow-sm max-w-md w-full text-center">
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Invite not found
          </h1>
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <a
            href="/signin"
            className="inline-block px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg"
          >
            Go to Carelog
          </a>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center px-4">
      <div className="bg-card border border-border rounded-xl p-8 shadow-sm max-w-md w-full">
        <h1 className="text-xl font-semibold text-foreground mb-2">
          You have been invited to join a care team
        </h1>
        <div className="bg-[var(--color-surface)] rounded-lg p-4 my-6 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Team</span>
            <span className="text-sm font-medium text-foreground">
              {orgName}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Your role</span>
            <span className="text-sm font-medium text-foreground">
              {roleLabels[role] ?? role}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Invited email</span>
            <span className="text-sm font-medium text-foreground">{email}</span>
          </div>
        </div>
        <button
          onClick={handleAccept}
          disabled={status === "accepting"}
          className="w-full py-2.5 px-4 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {status === "accepting" ? "Joining..." : "Accept invitation"}
        </button>
        <p className="text-center text-xs text-muted-foreground mt-4">
          You will need to sign in or create an account to continue.
        </p>
      </div>
    </div>
  );
}
