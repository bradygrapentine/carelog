export function ProductPreview() {
  return (
    <section
      id="preview"
      className="bg-[var(--color-surface)] py-20"
      aria-labelledby="preview-heading"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 text-center">
          <h2
            id="preview-heading"
            className="text-3xl font-bold tracking-tight text-[var(--color-ink)]"
          >
            A shared journal your family will actually use
          </h2>
          <p className="mt-3 text-[var(--color-muted)]">
            Small, warm moments — logged once, visible to everyone who cares.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Journal entry card */}
          <div
            role="presentation"
            className="rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm"
            style={{ borderLeft: "3px solid var(--color-primary)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
              Journal entry
            </p>
            <p className="mt-2 text-sm font-semibold text-[var(--color-ink)]">
              📋 Mom had a good night
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Nurse Sarah · 8:30 AM
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              She ate a full breakfast and asked about the grandkids. Slept
              through the night without waking.
            </p>
            <div className="mt-4 flex gap-2">
              <span className="rounded-full bg-[var(--color-primary-subtle)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-primary)]">
                ❤️ 3
              </span>
              <span className="rounded-full bg-[var(--color-secondary-subtle)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-secondary)]">
                🙏 1
              </span>
            </div>
          </div>

          {/* Medication card */}
          <div
            role="presentation"
            className="flex flex-col justify-between rounded-2xl bg-[var(--color-primary)] p-5 shadow-md"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary-light)]">
                Medication
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                💊 Lisinopril due at 9:00 AM
              </p>
              <p className="mt-1 text-xs text-white/80">10 mg · with food</p>
            </div>
            <div className="mt-6 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--color-secondary)]" />
              <p className="text-xs text-white/90">
                3 days of supply remaining — order refill soon
              </p>
            </div>
          </div>

          {/* Team card */}
          <div
            role="presentation"
            className="rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
              Care team
            </p>
            <p className="mt-2 text-sm font-semibold text-[var(--color-ink)]">
              👥 5 people on your team
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              2 coordinators · 2 caregivers · 1 supporter
            </p>
            <div className="mt-4 flex -space-x-2">
              {["#7c3aed", "#a78bfa", "#d97706"].map((color) => (
                <span
                  key={color}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-white"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
              ))}
              <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[var(--color-primary-subtle)] text-xs font-medium text-[var(--color-primary)]">
                +2
              </span>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-[var(--color-muted)]">
              Roles keep things simple: coordinators organize, caregivers post
              updates, supporters read and react.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
