import Image from "next/image";
import Link from "next/link";

const steps = [
  {
    n: "01",
    title: "Invite your circle",
    body: "Add family, caregivers, and volunteers. Each person gets a role, coordinator, supporter, or aide, so they see only what they need to.",
  },
  {
    n: "02",
    title: "Log the day together",
    body: "One shared journal for medications, moods, appointments, and small moments. Everyone contributes; nobody has to remember everything alone.",
  },
  {
    n: "03",
    title: "See the whole picture",
    body: "Weekly briefs, coverage gaps, and a quiet feed of what's going well. Bring it to the next doctor's visit or the next hard conversation.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-[var(--color-surface)]">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 md:grid-cols-2 md:items-center md:gap-16 md:py-28">
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl ring-1 ring-[var(--color-border)]">
          <Image
            src="/images/hero-4.png"
            alt="A caregiver walking alongside an elderly man in a park on an autumn day"
            fill
            sizes="(min-width: 768px) 45vw, 90vw"
            className="object-cover"
          />
        </div>

        <div>
          <p className="eyebrow-mono">How it works</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
            A shared rhythm, not another app to manage
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[var(--color-text-secondary)]">
            CareSync is designed to feel like a quiet family notebook, not a
            hospital portal and not a chat app. Three small steps and your whole
            circle is on the same page.
          </p>

          <ol className="mt-8 flex flex-col gap-6">
            {steps.map((s) => (
              <li key={s.n} className="flex gap-4">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-semibold text-[var(--color-app-shell-text)]"
                  aria-hidden="true"
                >
                  {s.n}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--color-ink)]">
                    {s.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <Link
            href="/signin"
            className="mt-8 inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-[var(--color-app-shell-text)] transition-colors hover:bg-[var(--color-primary)]/90 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
          >
            Start your family&rsquo;s log
          </Link>
        </div>
      </div>
    </section>
  );
}
