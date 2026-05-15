"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase";
import posthog from "posthog-js";

// Map Supabase OTP error messages to plainspoken, actionable copy.
// Default falls back to a generic-but-actionable line so users always know
// what to do next, even when Supabase returns a string we haven't seen.
function friendlyOtpError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (m.includes("expired")) {
    return "The code expired. Send a new one.";
  }
  if (m.includes("invalid") || m.includes("not match")) {
    return "That code didn't match. Check the digits or send a new code.";
  }
  return "Couldn't sign you in. Try again, or send a fresh code.";
}

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.toLowerCase().trim(),
      options: { shouldCreateUser: true },
    });
    if (error) {
      setError(friendlyOtpError(error.message));
      setLoading(false);
      return;
    }
    posthog.capture("sign_in_otp_requested");
    setSent(true);
    setLoading(false);
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.toLowerCase().trim(),
      token: otp.trim(),
      type: "email",
    });
    if (error) {
      setError(friendlyOtpError(error.message));
      setLoading(false);
      return;
    }
    if (data.user) {
      posthog.identify(data.user.id); // UUID only — never email (PHI)
      posthog.capture("sign_in_completed");
    }
    setLoading(false);
    router.replace("/dashboard");
  }

  if (sent) {
    return (
      <form onSubmit={handleVerifyOtp} className="space-y-6">
        <div className="text-center mb-2">
          <div className="w-12 h-12 bg-[var(--color-primary-subtle)] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-[var(--color-primary)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-medium text-[var(--color-ink)] mb-1">
            Check your email
          </h2>
          <p className="text-sm text-[var(--color-muted)]">
            We sent a 6-digit code to <strong>{email}</strong>
          </p>
        </div>
        <div>
          <label
            htmlFor="otp"
            className="block text-sm font-medium text-[var(--color-ink)] mb-1.5"
          >
            Enter your code
          </label>
          <input
            id="otp"
            type="text"
            inputMode="numeric"
            value={otp}
            onChange={(e) =>
              setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            placeholder="123456"
            required
            maxLength={6}
            className="w-full rounded-xl border border-[var(--color-border)] px-3 py-3 text-center text-2xl font-mono tracking-[0.4em] text-[var(--color-ink)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1"
          />
        </div>
        {error && (
          <p className="text-sm text-[var(--color-danger)] text-center">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || otp.length !== 6}
          className="w-full rounded-xl bg-[var(--color-primary-pressed)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-deep)] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-pressed)] focus:ring-offset-2"
        >
          {loading ? "Verifying..." : "Verify code"}
        </button>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setOtp("");
            setError(null);
          }}
          className="w-full text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          Use a different email
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSendOtp} className="space-y-6">
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-[var(--color-ink)] mb-1.5"
        >
          Email address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1"
        />
      </div>
      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      <button
        type="submit"
        disabled={loading || !email}
        className="w-full rounded-xl bg-[var(--color-primary-pressed)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-deep)] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-pressed)] focus:ring-offset-2"
      >
        {loading ? "Sending..." : "Continue with email"}
      </button>
      <p className="text-center text-xs text-[var(--color-muted)]">
        We'll email you a 6-digit code. No password needed.
      </p>
    </form>
  );
}
