import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function HeroSection() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24 md:py-32 lg:py-40">
      <p className="eyebrow-mono text-[var(--color-muted)]">
        CareSync · Built by a caregiver, for caregivers
      </p>

      <h1 className="headline-display mt-6 max-w-4xl text-4xl text-[var(--color-ink)] md:text-5xl lg:text-6xl">
        For the daughter working full-time. For the aide on the{" "}
        <em>hard night</em>. For the brother <em>three states away</em>.
      </h1>

      <p className="mt-8 max-w-xl text-lg leading-relaxed text-[var(--color-text-secondary)]">
        $14/mo for the whole family. HIPAA-conscious. No ads, no data sale.
      </p>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link
          href="/signin"
          className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-[var(--color-app-shell-text)] transition-colors hover:bg-[var(--color-primary)]/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)]"
        >
          Start your family&rsquo;s log
        </Link>
        <Link
          href="/#how-it-works"
          className="group inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface)] sm:ml-2"
        >
          See how it works
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>

      <p className="mt-6 text-xs text-[var(--color-muted)]">
        No credit card required. Cancel anytime.
      </p>
    </section>
  );
}
