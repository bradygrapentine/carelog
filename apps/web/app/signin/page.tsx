import { SignInForm } from "./SignInForm";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-surface)] px-4 py-16">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary)]"
          aria-hidden="true"
        />
        <span className="text-xl font-bold tracking-tight text-[var(--color-ink)]">
          CareSync
        </span>
      </div>

      {/* Card */}
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-card px-8 py-10 shadow-sm">
        <h1 className="mb-6 text-center text-xl font-bold text-[var(--color-ink)]">
          Sign in to CareSync
        </h1>

        {params.error && (
          <div
            role="alert"
            className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-[var(--color-danger)]"
          >
            {params.error === "auth_callback_failed"
              ? "Something went wrong. Please try again."
              : params.error}
          </div>
        )}

        {params.message && (
          <div className="mb-4 rounded-xl bg-[var(--color-primary-subtle)] px-4 py-3 text-sm text-[var(--color-primary)]">
            {params.message}
          </div>
        )}

        <SignInForm />
      </div>

      {/* Trust tagline */}
      <p className="mt-6 text-center text-xs text-[var(--color-muted)]">
        Private, secure, and ad-free. Your family&apos;s information never
        leaves your care team.
      </p>
    </div>
  );
}
