import Link from "next/link";

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--color-border)] bg-card/80 backdrop-blur-md">
      <nav
        className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2"
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

        {/* Nav links */}
        <ul className="hidden items-center gap-8 md:flex" role="list">
          {[
            { label: "Features", href: "/#features" },
            { label: "Pricing", href: "/pricing" },
            { label: "Compare", href: "/compare" },
            { label: "CareZone users", href: "/carezone-alternative" },
            { label: "About", href: "/about" },
            { label: "Contact", href: "/contact" },
          ].map(({ label, href }) => (
            <li key={href}>
              <Link
                href={href}
                className="text-sm font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <Link
          href="/signin"
          className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-app-shell-text)] transition-colors hover:bg-[var(--color-primary)]/90 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
        >
          Sign in
        </Link>
      </nav>
    </header>
  );
}
