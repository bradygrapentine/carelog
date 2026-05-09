import Link from "next/link";

// UX-108: brand-mark-only nav for auth/onboarding shells. The full
// MarketingNav has nav links + sign-in CTA that are nonsensical on /signin
// and /onboarding; the slim variant gives those pages a way back to "/"
// without offering destinations the user can't or shouldn't take mid-flow.
export function MarketingNavSlim() {
  return (
    <header className="w-full border-b border-[var(--color-border)] bg-card/80 backdrop-blur-md">
      <nav
        className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"
        aria-label="Main navigation"
      >
        <Link
          href="/"
          className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2 rounded-lg"
          aria-label="CareSync home"
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-primary)]"
            aria-hidden="true"
          />
          <span className="text-base font-bold tracking-tight text-[var(--color-ink)]">
            CareSync
          </span>
        </Link>
      </nav>
    </header>
  );
}
