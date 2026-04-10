# Carelog UI Redesign — Design Spec

**Date:** 2026-04-10
**Status:** Approved
**Scope:** Full SPA redesign — 10 pages across two shells

---

## 1. Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Color palette | Violet & Plum | Warm, emotionally intelligent; wellness-adjacent without being clinical |
| Hero layout | Split — copy left, visual right | Immediate product visibility; classic SaaS conversion pattern |
| Hero visual | Floating feature cards | Shows journal, medications, team at a glance; modern and dynamic |
| Marketing nav | Full-width sticky bar | Clean, predictable, works everywhere; frosted blur on scroll |
| App shell | Top tab bar on dark plum | Horizontal tabs, full-width content, maps naturally to mobile bottom bar |
| Architecture | Two-shell (marketing + app) | Clean separation; SSR for marketing, CSR for app; standard Next.js pattern |

---

## 2. Design System

### Color Tokens

```css
--color-primary:        #7c3aed;   /* Violet 600 */
--color-primary-light:  #a78bfa;   /* Violet 400 */
--color-primary-subtle: #ede9fe;   /* Violet 100 */
--color-ink:            #1e0a3c;   /* Deep plum — headings, tab bar bg */
--color-surface:        #faf5ff;   /* Violet 50 — page backgrounds */
--color-muted:          #6b7280;   /* Gray 500 — body text */
--color-border:         #ede9fe;   /* Violet 100 — card borders */
--color-warning:        #f59e0b;   /* Amber 400 */
--color-success:        #10b981;   /* Emerald 400 */
--color-danger:         #ef4444;   /* Red 500 */
```

Add to `apps/web/app/globals.css` as CSS custom properties. Map to shadcn/ui semantic tokens (`--primary`, `--primary-foreground`, etc.) in `tailwind.config.ts`.

### Typography

- **Font:** Geist (already in stack via `next/font/google`)
- **Hero headline:** 48px / 800 weight / −1px letter-spacing
- **Section heading:** 24px / 700 weight
- **Body:** 16px / 400 weight / `--color-muted`
- **Label/overline:** 12px / 600 weight / uppercase / 0.5px tracking / `--color-primary`

### Shape Scale

| Token | Radius | Usage |
|---|---|---|
| `rounded-md` | 6px | Badges, tags |
| `rounded-xl` | 10px | Buttons, inputs, small cards |
| `rounded-2xl` | 14px | Cards, panels |
| `rounded-3xl` | 20px | Hero sections, large containers |
| `rounded-full` | 9999px | Pill CTAs, avatars |

### Button Variants

| Variant | Style |
|---|---|
| Primary | `bg-primary text-white rounded-xl hover:bg-primary/90` |
| Secondary | `border-2 border-primary text-primary rounded-xl hover:bg-primary-subtle` |
| Ghost | `bg-primary-subtle text-primary rounded-xl hover:bg-primary/20` |
| Destructive | `bg-danger text-white rounded-xl` |

---

## 3. Routing Architecture

### Two-Shell Pattern

```
app/
├── (marketing)/                  ← MarketingLayout: full-width nav + footer
│   ├── layout.tsx
│   ├── page.tsx                  ← Landing / Hero
│   ├── about/page.tsx
│   ├── contact/page.tsx
│   ├── pricing/page.tsx
│   ├── privacy/page.tsx
│   └── terms/page.tsx
│
├── (app)/                        ← AppLayout: auth check + top tab bar
│   ├── layout.tsx
│   ├── dashboard/page.tsx        ← existing DashboardClient, moved here
│   ├── team/
│   │   ├── page.tsx              ← Team panel (SPA destination)
│   │   └── admin/page.tsx        ← Team Admin (coordinator-only full page)
│   └── subscriptions/page.tsx
│
├── signin/                       ← outside both shells
│   ├── page.tsx
│   ├── SignInForm.tsx
│   └── actions.ts
│
└── layout.tsx                    ← root: font, providers, Supabase
```

### Auth Guard

`(app)/layout.tsx` runs a server-side auth check via `createServerSupabase()`. Unauthenticated requests redirect to `/signin`. Coordinators accessing `/team/admin` are validated server-side; non-coordinators receive a 403 redirect to `/dashboard`.

---

## 4. Marketing Shell

### MarketingLayout (`(marketing)/layout.tsx`)

- Full-width sticky top nav: `bg-white/80 backdrop-blur-md border-b border-border`
- Logo left (violet square + "Carelog" wordmark)
- Nav links: Features · Pricing · About · Contact
- CTA button right: "Sign in" (primary, `rounded-xl`)
- Footer: links (Privacy · Terms · Contact), tagline, copyright

### Landing Page (`/`)

**Above the fold — split layout:**

- Left (55%):
  - Overline: "Family caregiving, simplified" (primary, uppercase, small)
  - H1 (48px/800): "Care made simple for families who show up every day"
  - Body (18px/muted): "Coordinate medications, shifts, and journals — together. Private, ad-free, $14/mo for the whole family."
  - CTAs: "Start free trial" (primary) + "See how it works" (secondary)
  - Micro-copy: "No credit card required · Cancel anytime"
- Right (45%): three floating feature cards at slight rotations
  - Card 1 (white, violet border-left): journal entry snippet + reaction count
  - Card 2 (violet bg, white text): medication due alert
  - Card 3 (white, violet border-left): team member avatars + count

**Below the fold:**
1. Feature grid (3-col): Journal · Medications · Team · Shifts · Documents · Digest
2. Social proof / testimonial quotes (2 cards)
3. Pricing preview (links to /pricing)
4. Footer

### About Page (`/about`)

- Centered hero: "Built by a caregiver, for caregivers"
- Origin story: 2-col (text left, warm illustration right)
- Values: 3 cards — Privacy-first · Family-centered · Bootstrapped & independent
- CTA: "Start free trial"

### Contact Page (`/contact`)

- 2-col layout:
  - Left: contact form (name, email, message) — POST to `/api/contact` → Resend
  - Right: email address, response time ("We reply within 24 hours"), FAQ accordion (3 items)
- Success/error states handled inline (no page navigation)

### Pricing Page (`/pricing`)

Two tiers side by side:

| | Free | Family Plan |
|---|---|---|
| Price | $0/mo | $14/mo |
| Members | 1 caregiver | Unlimited |
| Features | Journal only | All features |
| CTA | "Get started" | "Start free trial" (highlighted, "Most popular" badge) |

Feature comparison checklist below the cards.

### Privacy Policy (`/privacy`) & Terms (`/terms`)

- Shared `LegalPageLayout`:
  - Sticky table-of-contents sidebar (desktop only, collapses on mobile)
  - Prose content area (max-w-2xl, generous line-height)
  - "Last updated: [date]" below page title
- Content: static TSX — no dynamic data needed

---

## 5. App Shell

### AppLayout (`(app)/layout.tsx`)

- Dark plum top bar (`bg-[--color-ink]`):
  - Left: logo mark + "Carelog" wordmark (white)
  - Center/right: tab links — Journal · Medications · Team · Shifts · Documents · More
  - Right: user avatar (initials, violet bg) + dropdown (Profile · Subscriptions · Sign out)
- Active tab: white text + 2px bottom border in `--color-primary-light`
- Inactive tabs: `text-violet-300 hover:text-white`
- Mobile: tabs collapse to scrollable horizontal strip; consider bottom nav bar at ≤640px

### Dashboard SPA (`/dashboard`)

Existing `DashboardClient` panel-switching pattern migrated into the `(app)` shell. Active panel renders in `bg-surface` content area below the tab bar. Panels:

- **Journal** — existing JournalTimeline + JournalEntryForm
- **Medications** — existing medications panel
- **Team** — member cards, invite form (coordinator-only)
- **Shifts** — existing shifts panel
- **Documents** — existing documents panel
- **More** — links to Settings, Subscriptions, Sign out

### Team Panel (within Dashboard SPA)

- Member cards: avatar (initials + violet bg), display name, role badge, last active
- Role badges: Coordinator (violet), Caregiver (amber), Aide (slate), Supporter (gray)
- Pending invites: card with email, role, expiry countdown, "Resend" / "Cancel" actions
- Coordinator-only: "Invite member" button → inline Sheet with email + role selector

### Team Admin Page (`/team/admin`)

Full page within `(app)/` shell — coordinator-only.

Sections:
1. **Org settings** — org name, care recipient name (PATCH `/api/org`)
2. **Member management** — table: avatar, name, role dropdown (save on change), "Remove" button (confirm dialog)
3. **Danger zone** — "Delete organization" (confirm modal, requires typing org name)

Non-coordinator access: server-side redirect to `/dashboard`.

### Subscriptions Page (`/subscriptions`)

- Current plan card: plan name, price, next renewal date, status badge
- Feature checklist (what's included)
- Upgrade/downgrade CTA (Stripe Checkout — layout-only, CTAs disabled until Stripe is wired)
- Billing history table: date, amount, status, "Invoice" link
- Cancel subscription: link → confirm modal with retention message

### Sign In Page (`/signin`)

Full-screen centered layout on `bg-surface`:
- Carelog logo mark (violet square) + wordmark
- Card (`bg-white rounded-2xl shadow-sm border border-border`):
  - "Sign in to Carelog" heading
  - OTP email form (existing `SignInForm` reskinned)
  - Primary violet submit button
- Below card: "Private, secure, and ad-free" micro-copy

---

## 6. Accessibility Requirements

- All interactive elements: visible focus ring (`ring-2 ring-primary ring-offset-2`)
- Color contrast: all text/bg combos meet WCAG AA (4.5:1 normal text, 3:1 large text)
- Tab bar: `role="tablist"`, each tab `role="tab"`, `aria-selected`, `aria-controls`
- Floating hero cards: `aria-hidden="true"` (decorative)
- Form labels: explicit `<label htmlFor>` — no placeholder-only labels
- Modals/drawers: focus trap, `role="dialog"`, `aria-modal="true"`, Escape to close

---

## 7. Component Inventory

### New components

| Component | Path | Notes |
|---|---|---|
| `MarketingLayout` | `app/(marketing)/layout.tsx` | Nav + footer |
| `MarketingNav` | `components/marketing/MarketingNav.tsx` | Sticky, blur on scroll |
| `MarketingFooter` | `components/marketing/MarketingFooter.tsx` | Links + tagline |
| `HeroSection` | `components/marketing/HeroSection.tsx` | Split layout + floating cards |
| `FeatureGrid` | `components/marketing/FeatureGrid.tsx` | 3-col feature cards |
| `PricingCards` | `components/marketing/PricingCards.tsx` | Free + Family tiers |
| `ContactForm` | `components/marketing/ContactForm.tsx` | Client component, Resend |
| `LegalPageLayout` | `components/marketing/LegalPageLayout.tsx` | TOC sidebar + prose |
| `AppLayout` | `app/(app)/layout.tsx` | Tab bar + auth guard |
| `AppTabBar` | `components/app/AppTabBar.tsx` | Dark plum, active state |
| `UserMenu` | `components/app/UserMenu.tsx` | Avatar dropdown |
| `TeamPanel` | `components/app/TeamPanel.tsx` | Member cards + invite |
| `TeamAdminPage` | `app/(app)/team/admin/page.tsx` | Full page, coordinator-only |
| `SubscriptionsPage` | `app/(app)/subscriptions/page.tsx` | Plan card + billing |
| `RoleBadge` | `components/ui/RoleBadge.tsx` | Reusable role indicator |

### Existing components to reskin (design tokens only — no logic changes)

- `SignInForm` — violet palette, `rounded-xl` inputs
- `JournalTimeline` — border-left accent in `--color-primary`
- `JournalEntryForm` — primary button, surface background
- `SidebarNav` → replaced by `AppTabBar`

---

## 8. Out of Scope

- Stripe integration (subscriptions page is layout-only)
- Dark mode
- Mobile app (Expo) changes
- Animation / transition polish (layer on after)
- New backend API routes (all existing routes unchanged)
