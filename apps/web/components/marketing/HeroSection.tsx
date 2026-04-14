import Image from "next/image";
import Link from "next/link";

export function HeroSection() {
  return (
    <section className="relative mx-auto flex max-w-7xl flex-col items-center gap-12 px-6 py-20 md:flex-row md:items-center md:gap-16 md:py-28">
      {/* Soft decorative background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[var(--color-primary-subtle)] opacity-60 blur-3xl" />
        <div className="absolute top-32 right-0 h-80 w-80 rounded-full bg-[var(--color-secondary-subtle)] opacity-60 blur-3xl" />
      </div>

      {/* Left — copy */}
      <div className="flex flex-1 flex-col gap-6">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-secondary)]" />
          Family caregiving, simplified
        </p>
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-[var(--color-ink)] md:text-5xl lg:text-6xl">
          Care made simple for families who{" "}
          <span className="relative inline-block">
            <span className="relative z-10">show up</span>
            <span
              aria-hidden="true"
              className="absolute inset-x-0 bottom-1 -z-0 h-3 bg-[var(--color-secondary-subtle)]"
            />
          </span>{" "}
          every day
        </h1>
        <p className="max-w-lg text-lg leading-relaxed text-[var(--color-text-secondary)]">
          Coordinate medications, shifts, and journal entries across your
          family, caregivers, and volunteers — all in one calm, shared space.
        </p>
        <p className="max-w-lg text-base leading-relaxed text-[var(--color-muted)]">
          Built for the daughter managing mom's appointments while working
          full-time. For the aide updating the family on a hard night. For the
          brother who lives three states away and wants to help. Private,
          ad-free, HIPAA-conscious, $14/mo for the whole family.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signin"
            className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[var(--color-primary)]/90 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
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

        {/* Social-proof avatar strip — real families already caring together */}
        <div className="mt-2 flex items-center gap-3">
          <div className="flex -space-x-3">
            {[
              {
                src: "/images/hero-5.png",
                alt: "A caregiver sitting with an elderly woman at home",
              },
              {
                src: "/images/hero-6.png",
                alt: "Community members helping an older woman in a garden",
              },
              {
                src: "/images/hero-3.png",
                alt: "A physical therapist supporting a child with a walker",
              },
              {
                src: "/images/hero-4.png",
                alt: "A caregiver walking with an elderly man in a park",
              },
            ].map((img) => (
              <span
                key={img.src}
                className="relative inline-block h-10 w-10 overflow-hidden rounded-full border-2 border-white shadow-sm ring-1 ring-black/5"
              >
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              </span>
            ))}
          </div>
          <p className="text-xs leading-tight text-[var(--color-muted)]">
            Caring families <br className="sm:hidden" />
            across the country
          </p>
        </div>
      </div>

      {/* Right — photo collage */}
      <div className="relative hidden w-full flex-1 md:block">
        <div className="relative aspect-[5/6] w-full">
          {/* Lead image — intergenerational family care */}
          <div className="absolute left-0 top-0 h-[72%] w-[68%] overflow-hidden rounded-3xl shadow-xl ring-1 ring-black/5">
            <Image
              src="/images/hero-2.png"
              alt="Three generations — grandmother, mother, and daughter — laughing together at home"
              fill
              sizes="(min-width: 768px) 40vw, 90vw"
              className="object-cover"
              priority
            />
          </div>

          {/* Secondary — caregiver at home */}
          <div className="absolute right-0 top-[18%] h-[50%] w-[52%] overflow-hidden rounded-3xl shadow-xl ring-1 ring-black/5">
            <Image
              src="/images/hero-5.png"
              alt="An adult daughter sitting and talking warmly with her elderly mother at home"
              fill
              sizes="(min-width: 768px) 30vw, 60vw"
              className="object-cover"
            />
          </div>

          {/* Tertiary — professional care */}
          <div className="absolute bottom-0 left-[18%] h-[38%] w-[44%] overflow-hidden rounded-3xl shadow-xl ring-1 ring-black/5">
            <Image
              src="/images/hero-3.png"
              alt="A physical therapist and parent supporting a young child learning to walk with a walker"
              fill
              sizes="(min-width: 768px) 25vw, 60vw"
              className="object-cover"
            />
          </div>

          {/* Quaternary — outdoor moment */}
          <div className="absolute -top-4 right-0 h-[22%] w-[28%] overflow-hidden rounded-2xl shadow-lg ring-1 ring-black/5">
            <Image
              src="/images/hero-4.png"
              alt="A caregiver walking alongside an elderly man in a park on an autumn day"
              fill
              sizes="(min-width: 768px) 15vw, 35vw"
              className="object-cover"
            />
          </div>

          {/* Floating stat badge */}
          <div
            role="presentation"
            className="absolute bottom-6 right-2 flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-white/95 px-4 py-3 shadow-lg backdrop-blur"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-secondary-subtle)] text-[var(--color-secondary)]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 21s-7-4.35-7-10a5 5 0 019-3 5 5 0 019 3c0 5.65-7 10-7 10z"
                />
              </svg>
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--color-ink)]">
                Caring together
              </p>
              <p className="text-xs text-[var(--color-muted)]">
                One shared journal for the whole family
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
