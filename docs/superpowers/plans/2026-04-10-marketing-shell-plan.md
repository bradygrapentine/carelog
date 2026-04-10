# Marketing Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `(marketing)` route group — a full-width sticky nav, footer, and six public pages (Landing, About, Contact, Pricing, Privacy, Terms) — replacing the current Next.js default placeholder at `/`.

**Architecture:** Next.js App Router route group `app/(marketing)/` with its own `layout.tsx`. All pages are server components (SSR). The contact form is the only client component (needs form state). A new `/api/contact` API route sends messages via Resend. The existing `app/page.tsx` is deleted and replaced by `app/(marketing)/page.tsx`.

**Tech Stack:** Next.js 16 App Router, Tailwind v4, shadcn/ui (Button, Card, Badge), Resend (already wired at `server/resend.server.ts`)

**Prerequisites:** Design system plan must be merged first (color tokens and `RoleBadge` must exist).

---

### Task 1: Marketing layout — nav and footer

**Files:**
- Create: `apps/web/app/(marketing)/layout.tsx`
- Create: `apps/web/components/marketing/MarketingNav.tsx`
- Create: `apps/web/components/marketing/MarketingFooter.tsx`
- Create: `apps/web/components/marketing/__tests__/MarketingNav.test.tsx`

- [ ] **Step 1: Write the failing nav test**

Create `apps/web/components/marketing/__tests__/MarketingNav.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { MarketingNav } from "../MarketingNav";

describe("MarketingNav", () => {
  it("renders Carelog logo text", () => {
    render(<MarketingNav />);
    expect(screen.getByText("Carelog")).toBeInTheDocument();
  });

  it("renders all nav links", () => {
    render(<MarketingNav />);
    expect(screen.getByRole("link", { name: /features/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /pricing/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /about/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /contact/i })).toBeInTheDocument();
  });

  it("renders sign in CTA", () => {
    render(<MarketingNav />);
    expect(screen.getByRole("link", { name: /sign in/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd apps/web && npx vitest run components/marketing/__tests__/MarketingNav.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create MarketingNav**

Create `apps/web/components/marketing/MarketingNav.tsx`:

```tsx
import Link from "next/link";

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--color-border)] bg-white/80 backdrop-blur-md">
      <nav
        className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2" aria-label="Carelog home">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-primary)]" aria-hidden="true" />
          <span className="text-base font-bold tracking-tight text-[var(--color-ink)]">
            Carelog
          </span>
        </Link>

        {/* Nav links */}
        <ul className="hidden items-center gap-8 md:flex" role="list">
          {[
            { label: "Features", href: "/#features" },
            { label: "Pricing",  href: "/pricing" },
            { label: "About",    href: "/about" },
            { label: "Contact",  href: "/contact" },
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
          className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]/90 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
        >
          Sign in
        </Link>
      </nav>
    </header>
  );
}
```

- [ ] **Step 4: Create MarketingFooter**

Create `apps/web/components/marketing/MarketingFooter.tsx`:

```tsx
import Link from "next/link";

export function MarketingFooter() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
        <p className="text-sm text-[var(--color-muted)]">
          © {new Date().getFullYear()} Carelog. Private, secure, and ad-free.
        </p>
        <nav aria-label="Footer navigation">
          <ul className="flex items-center gap-6" role="list">
            {[
              { label: "Privacy", href: "/privacy" },
              { label: "Terms",   href: "/terms" },
              { label: "Contact", href: "/contact" },
            ].map(({ label, href }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
```

- [ ] **Step 5: Create the marketing layout**

Create `apps/web/app/(marketing)/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import { MarketingNav } from "../../components/marketing/MarketingNav";
import { MarketingFooter } from "../../components/marketing/MarketingFooter";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-surface)]">
      <MarketingNav />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
```

- [ ] **Step 6: Run nav test**

```bash
cd apps/web && npx vitest run components/marketing/__tests__/MarketingNav.test.tsx
```

Expected: `3 passed`.

- [ ] **Step 7: Run full suite**

```bash
pnpm test
```

Expected: `Test Files 68 passed`.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/\(marketing\)/ apps/web/components/marketing/
git commit -m "feat(marketing): marketing layout shell — MarketingNav, MarketingFooter, layout"
```

---

### Task 2: Landing page — hero + feature grid

**Files:**
- Create: `apps/web/app/(marketing)/page.tsx`
- Create: `apps/web/components/marketing/HeroSection.tsx`
- Create: `apps/web/components/marketing/FeatureGrid.tsx`
- Delete: `apps/web/app/page.tsx` (the Next.js default placeholder)
- Create: `apps/web/components/marketing/__tests__/HeroSection.test.tsx`

- [ ] **Step 1: Write failing HeroSection test**

Create `apps/web/components/marketing/__tests__/HeroSection.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { HeroSection } from "../HeroSection";

describe("HeroSection", () => {
  it("renders the main headline", () => {
    render(<HeroSection />);
    expect(
      screen.getByRole("heading", { level: 1 })
    ).toHaveTextContent("Care made simple for families who show up every day");
  });

  it("renders primary CTA with correct href", () => {
    render(<HeroSection />);
    const cta = screen.getByRole("link", { name: /start free trial/i });
    expect(cta).toHaveAttribute("href", "/signin");
  });

  it("marks floating cards as decorative", () => {
    render(<HeroSection />);
    const cards = screen.getAllByRole("presentation");
    expect(cards.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd apps/web && npx vitest run components/marketing/__tests__/HeroSection.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Create HeroSection**

Create `apps/web/components/marketing/HeroSection.tsx`:

```tsx
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
        role="presentation"
        aria-hidden="true"
      >
        {/* Card 1 — journal entry */}
        <div
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
        <div className="absolute right-0 top-10 w-52 rotate-1 rounded-2xl bg-[var(--color-primary)] p-4 shadow-xl">
          <p className="text-sm font-semibold text-white">💊 Medication due</p>
          <p className="mt-1 text-xs text-[var(--color-primary-light)]">
            9:00 AM · Lisinopril
          </p>
        </div>

        {/* Card 3 — team */}
        <div className="absolute bottom-0 left-8 w-56 rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-lg">
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
```

- [ ] **Step 4: Create FeatureGrid**

Create `apps/web/components/marketing/FeatureGrid.tsx`:

```tsx
const FEATURES = [
  {
    icon: "📋",
    title: "Care Journal",
    description:
      "Log entries with mood tags, flag important moments for the doctor, and let family react with a heart.",
  },
  {
    icon: "💊",
    title: "Medications",
    description:
      "Track medications with dosage, schedule, and administration history. Scan prescriptions with OCR.",
  },
  {
    icon: "👥",
    title: "Care Team",
    description:
      "Invite coordinators, caregivers, aides, and family supporters. Each role sees exactly what they need.",
  },
  {
    icon: "📅",
    title: "Shifts",
    description:
      "Schedule and log caregiver shifts. Know who was there, when, and what happened.",
  },
  {
    icon: "📁",
    title: "Documents",
    description:
      "Upload insurance cards, discharge summaries, and advance directives — always accessible to your team.",
  },
  {
    icon: "📬",
    title: "Weekly Digest",
    description:
      "Every Monday, your team gets a digest of the week's entries, medications, and shifts by email.",
  },
] as const;

export function FeatureGrid() {
  return (
    <section id="features" className="bg-white py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-[var(--color-ink)]">
            Everything your care team needs
          </h2>
          <p className="mt-3 text-[var(--color-muted)]">
            Built for families who coordinate care across multiple people.
          </p>
        </div>
        <ul
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          role="list"
        >
          {FEATURES.map(({ icon, title, description }) => (
            <li
              key={title}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
            >
              <span className="text-2xl" aria-hidden="true">
                {icon}
              </span>
              <h3 className="mt-3 text-base font-semibold text-[var(--color-ink)]">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
                {description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Create the landing page and delete the placeholder**

Create `apps/web/app/(marketing)/page.tsx`:

```tsx
import { HeroSection } from "../../components/marketing/HeroSection";
import { FeatureGrid } from "../../components/marketing/FeatureGrid";
import { PricingPreview } from "../../components/marketing/PricingPreview";

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <FeatureGrid />
      <PricingPreview />
    </>
  );
}
```

Note: `PricingPreview` will be created in Task 4. For now, add a temporary placeholder so the page compiles:

Create `apps/web/components/marketing/PricingPreview.tsx` (temporary, replaced in Task 4):

```tsx
export function PricingPreview() {
  return null;
}
```

Delete `apps/web/app/page.tsx`:

```bash
rm apps/web/app/page.tsx
```

- [ ] **Step 6: Run hero test**

```bash
cd apps/web && npx vitest run components/marketing/__tests__/HeroSection.test.tsx
```

Expected: `3 passed`.

- [ ] **Step 7: Run full suite**

```bash
pnpm test
```

Expected: all passing.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/\(marketing\)/page.tsx apps/web/components/marketing/
git rm apps/web/app/page.tsx
git commit -m "feat(marketing): landing page — HeroSection + FeatureGrid"
```

---

### Task 3: About page

**Files:**
- Create: `apps/web/app/(marketing)/about/page.tsx`

- [ ] **Step 1: Create About page**

Create `apps/web/app/(marketing)/about/page.tsx`:

```tsx
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — Carelog",
  description: "Built by a caregiver, for caregivers.",
};

const VALUES = [
  {
    icon: "🔒",
    title: "Privacy-first",
    description:
      "Your family's health data is never sold, never shown to advertisers, and never leaves your care team.",
  },
  {
    icon: "💜",
    title: "Family-centered",
    description:
      "Every feature is designed around the reality of coordinating care across family members, aides, and professionals.",
  },
  {
    icon: "🌱",
    title: "Bootstrapped & independent",
    description:
      "No VC funding, no growth-at-all-costs pressure. We grow sustainably because we care about longevity.",
  },
] as const;

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-20">
      {/* Hero */}
      <div className="mb-16 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">
          Our story
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-[var(--color-ink)] md:text-5xl">
          Built by a caregiver,<br />for caregivers
        </h1>
      </div>

      {/* Origin story */}
      <div className="mb-16 rounded-3xl bg-[var(--color-primary-subtle)] p-10">
        <p className="text-lg leading-relaxed text-[var(--color-ink)]">
          Carelog started because coordinating care for a family member meant
          endless group texts, lost medication lists, and no shared memory of
          what happened during the night shift. We built the tool we wished
          existed — simple enough for the whole family, structured enough for
          the professionals on the team.
        </p>
      </div>

      {/* Values */}
      <div className="mb-16">
        <h2 className="mb-8 text-2xl font-bold text-[var(--color-ink)]">
          What we believe
        </h2>
        <ul className="grid gap-6 sm:grid-cols-3" role="list">
          {VALUES.map(({ icon, title, description }) => (
            <li
              key={title}
              className="rounded-2xl border border-[var(--color-border)] bg-white p-6"
            >
              <span className="text-2xl" aria-hidden="true">{icon}</span>
              <h3 className="mt-3 text-base font-semibold text-[var(--color-ink)]">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
                {description}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div className="text-center">
        <Link
          href="/signin"
          className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]/90 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
        >
          Start free trial
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run full suite**

```bash
pnpm test
```

Expected: all passing (no new tests for static pages — content is static and straightforward).

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(marketing\)/about/
git commit -m "feat(marketing): About page"
```

---

### Task 4: Pricing page + PricingCards component

**Files:**
- Create: `apps/web/components/marketing/PricingCards.tsx`
- Create: `apps/web/app/(marketing)/pricing/page.tsx`
- Modify: `apps/web/components/marketing/PricingPreview.tsx` (replace null stub)
- Create: `apps/web/components/marketing/__tests__/PricingCards.test.tsx`

- [ ] **Step 1: Write failing PricingCards test**

Create `apps/web/components/marketing/__tests__/PricingCards.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { PricingCards } from "../PricingCards";

describe("PricingCards", () => {
  it("renders both plan tiers", () => {
    render(<PricingCards />);
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("Family Plan")).toBeInTheDocument();
  });

  it("shows the $14/mo price", () => {
    render(<PricingCards />);
    expect(screen.getByText("$14")).toBeInTheDocument();
  });

  it("marks family plan as most popular", () => {
    render(<PricingCards />);
    expect(screen.getByText(/most popular/i)).toBeInTheDocument();
  });

  it("links Start free trial to signin", () => {
    render(<PricingCards />);
    const cta = screen.getAllByRole("link", { name: /start free trial/i })[0];
    expect(cta).toHaveAttribute("href", "/signin");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd apps/web && npx vitest run components/marketing/__tests__/PricingCards.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Create PricingCards**

Create `apps/web/components/marketing/PricingCards.tsx`:

```tsx
import Link from "next/link";

const FREE_FEATURES = [
  "1 caregiver account",
  "Care journal",
  "7-day history",
];

const FAMILY_FEATURES = [
  "Unlimited team members",
  "Full care journal + reactions",
  "Medications & shifts",
  "Documents vault",
  "Weekly email digest",
  "Unlimited history",
];

export function PricingCards() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 md:flex-row">
      {/* Free tier */}
      <div className="flex flex-1 flex-col rounded-2xl border border-[var(--color-border)] bg-white p-8">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-[var(--color-ink)]">Free</h3>
          <div className="mt-2 flex items-end gap-1">
            <span className="text-4xl font-extrabold text-[var(--color-muted)]">$0</span>
            <span className="mb-1 text-sm text-[var(--color-muted)]">/mo</span>
          </div>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Get started, no commitment.
          </p>
        </div>
        <ul className="mb-8 flex flex-col gap-3" role="list">
          {FREE_FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
              <span className="text-[var(--color-success)]" aria-hidden="true">✓</span>
              {f}
            </li>
          ))}
        </ul>
        <Link
          href="/signin"
          className="mt-auto inline-flex items-center justify-center rounded-xl border-2 border-[var(--color-border)] px-6 py-3 text-sm font-semibold text-[var(--color-muted)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
        >
          Get started
        </Link>
      </div>

      {/* Family Plan */}
      <div className="relative flex flex-1 flex-col rounded-2xl border-2 border-[var(--color-primary)] bg-white p-8">
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-primary)] px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
          Most popular
        </span>
        <div className="mb-6">
          <h3 className="text-lg font-bold text-[var(--color-ink)]">Family Plan</h3>
          <div className="mt-2 flex items-end gap-1">
            <span className="text-4xl font-extrabold text-[var(--color-primary)]">$14</span>
            <span className="mb-1 text-sm text-[var(--color-muted)]">/mo</span>
          </div>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Everything for the whole family team.
          </p>
        </div>
        <ul className="mb-8 flex flex-col gap-3" role="list">
          {FAMILY_FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
              <span className="text-[var(--color-success)]" aria-hidden="true">✓</span>
              {f}
            </li>
          ))}
        </ul>
        <Link
          href="/signin"
          className="mt-auto inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]/90 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
        >
          Start free trial
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create the Pricing page**

Create `apps/web/app/(marketing)/pricing/page.tsx`:

```tsx
import type { Metadata } from "next";
import { PricingCards } from "../../../components/marketing/PricingCards";

export const metadata: Metadata = {
  title: "Pricing — Carelog",
  description: "Simple pricing for families. $14/mo covers everyone.",
};

export default function PricingPage() {
  return (
    <div className="py-20">
      <div className="mx-auto mb-12 max-w-2xl px-6 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">
          Pricing
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-[var(--color-ink)]">
          Simple pricing for the whole family
        </h1>
        <p className="mt-4 text-[var(--color-muted)]">
          One family plan covers every member of your care team — coordinators,
          caregivers, aides, and family supporters.
        </p>
      </div>
      <PricingCards />
    </div>
  );
}
```

- [ ] **Step 5: Replace PricingPreview stub**

Open `apps/web/components/marketing/PricingPreview.tsx` and replace:

```tsx
import Link from "next/link";
import { PricingCards } from "./PricingCards";

export function PricingPreview() {
  return (
    <section className="py-20">
      <div className="mx-auto mb-12 max-w-xl px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-[var(--color-ink)]">
          Simple, honest pricing
        </h2>
        <p className="mt-3 text-[var(--color-muted)]">
          One plan for the whole family team.{" "}
          <Link href="/pricing" className="text-[var(--color-primary)] underline underline-offset-2">
            See full details →
          </Link>
        </p>
      </div>
      <PricingCards />
    </section>
  );
}
```

- [ ] **Step 6: Run PricingCards test**

```bash
cd apps/web && npx vitest run components/marketing/__tests__/PricingCards.test.tsx
```

Expected: `4 passed`.

- [ ] **Step 7: Run full suite**

```bash
pnpm test
```

Expected: all passing.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/\(marketing\)/pricing/ apps/web/components/marketing/
git commit -m "feat(marketing): Pricing page + PricingCards component"
```

---

### Task 5: Contact page + /api/contact route

**Files:**
- Create: `apps/web/components/marketing/ContactForm.tsx`
- Create: `apps/web/app/(marketing)/contact/page.tsx`
- Create: `apps/web/app/api/contact/route.ts`
- Create: `apps/web/app/api/contact/route.test.ts`
- Create: `apps/web/components/marketing/__tests__/ContactForm.test.tsx`

- [ ] **Step 1: Write failing API route test**

Create `apps/web/app/api/contact/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("../../../server/resend.server", () => ({
  resend: {
    emails: {
      send: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

function makeRequest(body: Record<string, string>) {
  return new Request("http://localhost/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/contact", () => {
  it("returns 400 when name is missing", async () => {
    const req = makeRequest({ email: "a@b.com", message: "hello" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when email is missing", async () => {
    const req = makeRequest({ name: "Alex", message: "hello" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when message is missing", async () => {
    const req = makeRequest({ name: "Alex", email: "a@b.com" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 on valid submission", async () => {
    const req = makeRequest({ name: "Alex", email: "a@b.com", message: "hello" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd apps/web && npx vitest run app/api/contact/route.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the API route**

Create `apps/web/app/api/contact/route.ts`:

```ts
import { NextResponse } from "next/server";
import { resend } from "../../../server/resend.server";

export async function POST(req: Request) {
  const body = await req.json();
  const { name, email, message } = body ?? {};

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (resend) {
    await resend.emails.send({
      from: "Carelog Contact <noreply@carelog.app>",
      to: ["hello@carelog.app"],
      replyTo: email,
      subject: `Contact form: ${name}`,
      text: `From: ${name} <${email}>\n\n${message}`,
    });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run API route test**

```bash
cd apps/web && npx vitest run app/api/contact/route.test.ts
```

Expected: `4 passed`.

- [ ] **Step 5: Write failing ContactForm test**

Create `apps/web/components/marketing/__tests__/ContactForm.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ContactForm } from "../ContactForm";

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ ok: true }),
});

describe("ContactForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all form fields", () => {
    render(<ContactForm />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/message/i)).toBeInTheDocument();
  });

  it("shows success message after submit", async () => {
    render(<ContactForm />);
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Alex" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => {
      expect(screen.getByText(/message sent/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 6: Run to verify it fails**

```bash
cd apps/web && npx vitest run components/marketing/__tests__/ContactForm.test.tsx
```

Expected: FAIL.

- [ ] **Step 7: Create ContactForm**

Create `apps/web/components/marketing/ContactForm.tsx`:

```tsx
"use client";

import { useState } from "react";

type Status = "idle" | "sending" | "sent" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const name    = (form.elements.namedItem("name")    as HTMLInputElement).value;
    const email   = (form.elements.namedItem("email")   as HTMLInputElement).value;
    const message = (form.elements.namedItem("message") as HTMLTextAreaElement).value;

    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      setStatus(res.ok ? "sent" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-2xl bg-[var(--color-primary-subtle)] p-8 text-center">
        <p className="text-2xl">💜</p>
        <p className="mt-2 font-semibold text-[var(--color-ink)]">Message sent!</p>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          We reply within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium text-[var(--color-ink)]">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="Your name"
          className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-[var(--color-ink)]">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="message" className="text-sm font-medium text-[var(--color-ink)]">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          placeholder="How can we help?"
          className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-1"
        />
      </div>

      {status === "error" && (
        <p role="alert" className="text-sm text-[var(--color-danger)]">
          Something went wrong. Please try again or email us directly.
        </p>
      )}

      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex items-center justify-center rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary)]/90 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
      >
        {status === "sending" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
```

- [ ] **Step 8: Create Contact page**

Create `apps/web/app/(marketing)/contact/page.tsx`:

```tsx
import type { Metadata } from "next";
import { ContactForm } from "../../../components/marketing/ContactForm";

export const metadata: Metadata = {
  title: "Contact — Carelog",
  description: "Get in touch. We reply within 24 hours.",
};

const FAQ = [
  {
    q: "Is my family's data private?",
    a: "Yes. Your data is never sold, never shown to advertisers, and is accessible only to the people you invite.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from the Subscriptions page in your account — no phone call required.",
  },
  {
    q: "Do you offer a free trial?",
    a: "Yes — start free with no credit card required. Upgrade when you're ready.",
  },
] as const;

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-20">
      <div className="mb-12 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">
          Get in touch
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight text-[var(--color-ink)]">
          We&#39;d love to hear from you
        </h1>
      </div>

      <div className="grid gap-12 md:grid-cols-2">
        {/* Left — form */}
        <div>
          <h2 className="mb-6 text-lg font-semibold text-[var(--color-ink)]">
            Send us a message
          </h2>
          <ContactForm />
        </div>

        {/* Right — info + FAQ */}
        <div className="flex flex-col gap-8">
          <div>
            <h2 className="mb-3 text-lg font-semibold text-[var(--color-ink)]">
              Contact details
            </h2>
            <p className="text-sm text-[var(--color-muted)]">
              Email:{" "}
              <a
                href="mailto:hello@carelog.app"
                className="text-[var(--color-primary)] underline underline-offset-2"
              >
                hello@carelog.app
              </a>
            </p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Response time: within 24 hours
            </p>
          </div>

          <div>
            <h2 className="mb-4 text-lg font-semibold text-[var(--color-ink)]">
              Frequently asked
            </h2>
            <ul className="flex flex-col gap-4" role="list">
              {FAQ.map(({ q, a }) => (
                <li key={q} className="rounded-2xl border border-[var(--color-border)] bg-white p-5">
                  <p className="text-sm font-semibold text-[var(--color-ink)]">{q}</p>
                  <p className="mt-1.5 text-sm text-[var(--color-muted)]">{a}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 9: Run ContactForm test**

```bash
cd apps/web && npx vitest run components/marketing/__tests__/ContactForm.test.tsx
```

Expected: `2 passed`.

- [ ] **Step 10: Run full suite**

```bash
pnpm test
```

Expected: all passing.

- [ ] **Step 11: Commit**

```bash
git add apps/web/app/\(marketing\)/contact/ apps/web/app/api/contact/ apps/web/components/marketing/ContactForm.tsx apps/web/components/marketing/__tests__/ContactForm.test.tsx
git commit -m "feat(marketing): Contact page + /api/contact route via Resend"
```

---

### Task 6: Legal pages — Privacy & Terms

**Files:**
- Create: `apps/web/components/marketing/LegalPageLayout.tsx`
- Create: `apps/web/app/(marketing)/privacy/page.tsx`
- Create: `apps/web/app/(marketing)/terms/page.tsx`

- [ ] **Step 1: Create LegalPageLayout**

Create `apps/web/components/marketing/LegalPageLayout.tsx`:

```tsx
type Section = {
  id: string;
  title: string;
};

type Props = {
  title: string;
  lastUpdated: string;
  sections: Section[];
  children: React.ReactNode;
};

export function LegalPageLayout({ title, lastUpdated, sections, children }: Props) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-20">
      <div className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-[var(--color-ink)]">
          {title}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Last updated: {lastUpdated}
        </p>
      </div>

      <div className="flex gap-12">
        {/* TOC sidebar — desktop only */}
        <nav
          className="hidden w-48 shrink-0 lg:block"
          aria-label="Table of contents"
        >
          <ul className="sticky top-24 flex flex-col gap-2" role="list">
            {sections.map(({ id, title }) => (
              <li key={id}>
                <a
                  href={"#" + id}
                  className="text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)]"
                >
                  {title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Prose */}
        <article className="prose prose-sm max-w-2xl text-[var(--color-muted)] [&_h2]:text-[var(--color-ink)] [&_h2]:font-bold [&_h2]:text-xl [&_h2]:mt-10 [&_h2]:mb-3">
          {children}
        </article>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create Privacy page**

Create `apps/web/app/(marketing)/privacy/page.tsx`:

```tsx
import type { Metadata } from "next";
import { LegalPageLayout } from "../../../components/marketing/LegalPageLayout";

export const metadata: Metadata = {
  title: "Privacy Policy — Carelog",
};

const SECTIONS = [
  { id: "information",  title: "Information we collect" },
  { id: "use",          title: "How we use it" },
  { id: "sharing",      title: "Sharing" },
  { id: "security",     title: "Security" },
  { id: "contact",      title: "Contact" },
];

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="April 10, 2026" sections={SECTIONS}>
      <h2 id="information">Information we collect</h2>
      <p>
        We collect the email address you use to sign in, and the care information
        your team logs in Carelog (journal entries, medications, shifts, documents).
        We do not collect payment information directly — billing is handled by Stripe.
      </p>

      <h2 id="use">How we use your information</h2>
      <p>
        We use your information to operate Carelog: to authenticate you, to deliver
        the weekly digest email, and to provide support when you contact us. We do
        not use your information for advertising.
      </p>

      <h2 id="sharing">Sharing</h2>
      <p>
        We do not sell your information. We share data with service providers
        (Supabase for database hosting, Resend for email, Stripe for billing) only
        to the extent necessary to operate the service.
      </p>

      <h2 id="security">Security</h2>
      <p>
        All data is encrypted in transit (TLS) and at rest. Access is limited to
        members of your care team. Row-level security in the database ensures
        one family&#39;s data cannot be accessed by another family&#39;s account.
      </p>

      <h2 id="contact">Contact</h2>
      <p>
        Questions about privacy? Email{" "}
        <a href="mailto:privacy@carelog.app" className="text-[var(--color-primary)]">
          privacy@carelog.app
        </a>
        .
      </p>
    </LegalPageLayout>
  );
}
```

- [ ] **Step 3: Create Terms page**

Create `apps/web/app/(marketing)/terms/page.tsx`:

```tsx
import type { Metadata } from "next";
import { LegalPageLayout } from "../../../components/marketing/LegalPageLayout";

export const metadata: Metadata = {
  title: "Terms of Service — Carelog",
};

const SECTIONS = [
  { id: "acceptance",   title: "Acceptance" },
  { id: "service",      title: "The service" },
  { id: "accounts",     title: "Accounts" },
  { id: "payment",      title: "Payment" },
  { id: "termination",  title: "Termination" },
  { id: "liability",    title: "Limitation of liability" },
];

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service" lastUpdated="April 10, 2026" sections={SECTIONS}>
      <h2 id="acceptance">Acceptance</h2>
      <p>
        By using Carelog you agree to these terms. If you do not agree, do not use
        the service.
      </p>

      <h2 id="service">The service</h2>
      <p>
        Carelog is a care coordination tool for families. We provide it as-is and
        may update features over time. We are not a medical provider and Carelog is
        not a substitute for professional medical advice.
      </p>

      <h2 id="accounts">Accounts</h2>
      <p>
        You are responsible for maintaining the security of your account. Notify us
        immediately at{" "}
        <a href="mailto:hello@carelog.app" className="text-[var(--color-primary)]">
          hello@carelog.app
        </a>{" "}
        if you suspect unauthorized access.
      </p>

      <h2 id="payment">Payment</h2>
      <p>
        The Family Plan is billed monthly at $14/mo. You may cancel at any time from
        the Subscriptions page. Cancellation takes effect at the end of the current
        billing period. We do not offer partial refunds.
      </p>

      <h2 id="termination">Termination</h2>
      <p>
        We may suspend or terminate accounts that violate these terms. You may
        delete your account at any time from the Team Admin page. Your data is
        retained for 30 days after deletion before permanent removal.
      </p>

      <h2 id="liability">Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Carelog is not liable for indirect,
        incidental, or consequential damages arising from your use of the service.
        Our total liability is limited to the amount you paid us in the 12 months
        before the claim.
      </p>
    </LegalPageLayout>
  );
}
```

- [ ] **Step 4: Run full suite**

```bash
pnpm test
```

Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(marketing\)/privacy/ apps/web/app/\(marketing\)/terms/ apps/web/components/marketing/LegalPageLayout.tsx
git commit -m "feat(marketing): Privacy + Terms pages with LegalPageLayout"
```

---

### Task 7: Type-check and final verification

- [ ] **Step 1: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Full test suite**

```bash
pnpm test
```

Expected: all passing.

- [ ] **Step 3: Verify routes exist**

```bash
ls apps/web/app/\(marketing\)/
```

Expected output includes: `layout.tsx page.tsx about/ contact/ pricing/ privacy/ terms/`

- [ ] **Step 4: Final commit if any cleanup needed**

```bash
git add -p
git commit -m "chore(marketing): cleanup and final type fixes"
```
