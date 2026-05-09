import { redirect } from "next/navigation";
import { SignInForm } from "./SignInForm";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { PostHogInit } from "../../components/PostHogInit";
import { MarketingNavSlim } from "@/components/marketing/MarketingNavSlim";
import { createServerSupabase } from "@/lib/supabaseServer";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  // TD-109: send already-authenticated users straight to /dashboard.
  // The (app) layout would do this anyway after a round-trip, but this
  // skips rendering the OTP form entirely for an authed visitor.
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const params = await searchParams;

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <PostHogInit />
      <MarketingNavSlim />
      <div className="flex flex-col items-center px-4 py-16">
        <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-card px-8 py-10 shadow-sm">
          <h1 className="headline-display mb-6 text-center text-3xl text-[var(--color-ink)]">
            Sign in to <em>CareSync</em>
          </h1>

          {params.error && (
            <ErrorBanner className="mb-4">
              {params.error === "auth_callback_failed"
                ? "That sign-in link didn't work. Try sending a new code."
                : params.error}
            </ErrorBanner>
          )}

          {params.message && (
            <div className="mb-4 rounded-xl bg-[var(--color-primary-subtle)] px-4 py-3 text-sm text-[var(--color-primary)]">
              {params.message}
            </div>
          )}

          <SignInForm />
        </div>

        <p className="mt-6 text-center text-xs text-[var(--color-muted)]">
          Private, secure, and ad-free. Your family&apos;s information never
          leaves your care team.
        </p>
      </div>
    </div>
  );
}
