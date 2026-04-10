import Link from "next/link";

export function HeroSection() {
  return (
    <section className="mx-auto flex max-w-6xl flex-col items-center gap-16 px-6 py-20 md:flex-row md:items-center md:py-28">
      {/* Left — copy */}
      <div className="flex flex-1 flex-col gap-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">
          Family caregiving, simplified
        </p>
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-[var(--color-ink)] md:text-5xl">
          Care made simple for families who show up every day
        </h1>
        <p className="max-w-md text-lg leading-relaxed text-[var(--color-muted)]">
          Coordinate medications, shifts, and journals — together. Private,
          ad-free, $14/mo for the whole family.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signin"
            className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]/90 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
          >
            Start free trial
          </Link>
          <Link
            href="/#features"
            className="inline-flex items-center justify-center rounded-xl border-2 border-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
          >
            See how it works
          </Link>
        </div>
        <p className="text-xs text-[var(--color-muted)]">
          No credit card required · Cancel anytime
        </p>
      </div>

      {/* Right — floating feature cards (decorative) */}
      <div
        className="relative hidden h-80 w-full flex-1 md:flex"
      >
        {/* Card 1 — journal entry */}
        <div
          role="presentation"
          className="absolute left-0 top-0 w-56 -rotate-2 rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-lg"
          style={{ borderLeft: "3px solid var(--color-primary)" }}
        >
          <p className="text-sm font-semibold text-[var(--color-ink)]">
            📋 Mom had a good night
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Nurse Sarah · 8:30 AM
          </p>
          <div className="mt-3 flex gap-2">
            <span className="rounded-full bg-[var(--color-primary-subtle)] px-2 py-0.5 text-xs text-[var(--color-primary)]">
              ❤️ 3
            </span>
          </div>
        </div>

        {/* Card 2 — medication alert */}
        <div role="presentation" className="absolute right-0 top-10 w-52 rotate-1 rounded-2xl bg-[var(--color-primary)] p-4 shadow-xl">
          <p className="text-sm font-semibold text-white">💊 Medication due</p>
          <p className="mt-1 text-xs text-[var(--color-primary-light)]">
            9:00 AM · Lisinopril
          </p>
        </div>

        {/* Card 3 — team */}
        <div role="presentation" className="absolute bottom-0 left-8 w-56 rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-lg">
          <p className="text-sm font-semibold text-[var(--color-ink)]">
            👥 5 people on your team
          </p>
          <div className="mt-2 flex -space-x-2">
            {["#7c3aed", "#a78bfa", "#ddd6fe"].map((color, i) => (
              <span
                key={i}
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-white"
                style={{ backgroundColor: color }}
              />
            ))}
            <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[var(--color-primary-subtle)] text-xs font-medium text-[var(--color-primary)]">
              +2
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
