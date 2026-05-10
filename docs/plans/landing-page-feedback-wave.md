# Wave: Landing Page Feedback (2026-04-28)

> **⚠ Deprecated merge-policy mention:** This document was written when the repo used Mergify and a `queue` label. As of 2026-05-10, Mergify is no longer in use; the canonical merge flow is `gh pr merge --auto --squash` via GitHub native auto-merge. References to Mergify / `--add-label queue` below are kept as historical record. See `.claude/CLAUDE.md` §Merge Policy.


Source: 8-issue feedback list raised by Brady on 2026-04-27.

| # | Issue | Status going in | Track |
|---|---|---|---|
| 1 | Dark UI / needs tertiary color | Coral tertiary added (PR #233) | A — extend |
| 2 | Pricing low-contrast text | Fixed (PR #232) | — done |
| 3 | Navbar color/contrast | Re-evaluate after #233 lands | B |
| 4 | Slow page navigation | Not started | C |
| 5 | Competitor comparison missing | Not started; pair = CaringBridge + Lotsa Helping Hands | D |
| 6 | Supabase auth NetworkError (prod) | Project was paused; unpause in progress | E (user) |
| 7 | Illegible contact form inputs | Fixed (PR #232) | — done |
| 8 | Contact form: no confirmation email | Code correct; Vercel/Resend config | E (user) |

---

## Track A — Coral tertiary extension

**Goal**: spread `--color-tertiary` from the hero into the rest of the marketing surface so it reads as an intentional system color, not a one-off accent.

**Files**: `apps/web/components/marketing/FeatureGrid.tsx`, `apps/web/components/marketing/HowItWorks.tsx`, `apps/web/components/marketing/PricingCards.tsx`, `apps/web/app/(marketing)/pricing/page.tsx`.

**Scope**:
- FeatureGrid: feature card icon backgrounds — alternate violet-subtle / coral-subtle / amber-subtle across the grid (or pick one slot per row to be coral).
- HowItWorks: step number badges currently use primary; swap step 2 (or middle step) to tertiary so the three steps form a violet→coral→violet rhythm.
- PricingCards: keep the violet-bordered "Most popular" card; recolor the "Save 29%" badge from `success-subtle/success` to `tertiary-subtle/tertiary` (semantic clash is minor — it's a marketing chip, not a status indicator).
- Pricing eyebrow ("Pricing"): leave violet to anchor the heading.

**Acceptance**:
- `npx tsc --noEmit` clean.
- Vitest green.
- Visual: hero, features, how-it-works, pricing all show tertiary in at least one prominent place. No raw hex.

**Branch**: `feat/tertiary-coral-extend`. **Depends on**: #233 merged.

---

## Track B — Navbar polish (assess, then act)

**Goal**: confirm whether issue #3 still feels off after #232 + #233 land. If so, propose a concrete navbar refresh; if not, close.

**Process**:
1. After #232 + #233 merged + dev reload, screenshot the navbar in both light + dark modes via chrome-devtools.
2. Send Brady before/after; ask "still looks off, or shipped?".
3. If still off: propose 2–3 candidates (e.g., raise contrast on link text from `--color-muted` → `--color-text-primary`; add a coral underline on hover; swap "Sign in" CTA color).
4. Implement the chosen variant in `apps/web/components/marketing/MarketingNav.tsx`.

**Branch**: `fix/marketing-navbar-contrast` (only if needed). **Depends on**: #233.

---

## Track C — Page-navigation perf (#4)

**Goal**: identify why navigation feels slow and fix the top 1–2 offenders. No premature optimization.

**Process**:
1. Boot dev server, navigate landing → pricing → contact via chrome-devtools `performance_start_trace` / `performance_stop_trace`.
2. Run `lighthouse_audit` on each marketing page; capture LCP, TBT, CLS.
3. Triage:
   - **If client-side nav is slow** (e.g., 800ms+ between clicks): likely Next.js dev-mode RSC overhead; capture a prod build trace (`pnpm build && pnpm start`) before declaring it a bug.
   - **If LCP is slow**: probable causes are hero images (currently `next/image` priority on hero-2.png — verify `sizes` is right; check actual served size); webfont CLS.
   - **If TBT is high**: hunt large client bundles (Testimonials, ProductPreview, PricingCards are `"use client"` — check if they need to be).
4. Apply the smallest fix that meaningfully moves the needle. Document trade-offs in PR.

**Likely fixes (prioritised by leverage)**:
- Convert components that don't need state to server components (`Testimonials`, sections of `WhoItsFor`, `HowItWorks`).
- Add `loading="lazy"` to non-priority hero images.
- Verify `font-display: swap` on Geist + Fraunces (next/font defaults are usually fine).
- Audit `sessionStorage` use in `PricingCards` — could the click-handler be a server action redirect instead?

**Files**: TBD by trace; almost certainly under `apps/web/components/marketing/` and possibly `apps/web/app/layout.tsx`.

**Acceptance**:
- Lighthouse Performance score on `/`, `/pricing`, `/contact` in prod build ≥ 90 desktop, ≥ 75 mobile.
- LCP < 2.5s desktop, < 4s mobile (PageSpeed thresholds).
- A short PR description with before/after numbers.

**Branch**: `perf/marketing-page-nav`.

---

## Track D — Competitor comparison page (#5)

**Goal**: add `/compare` (and update navbar to link) drawing a stark contrast against CaringBridge + Lotsa Helping Hands.

**Files** (new + edits):
- New: `apps/web/app/(marketing)/compare/page.tsx`
- New: `apps/web/components/marketing/CompareTable.tsx`
- Edit: `apps/web/components/marketing/MarketingNav.tsx` (add "Compare" link)
- Edit: `apps/web/app/sitemap.ts` (add `/compare` URL)

**Content blueprint** (drafted in plan, refined in PR):

Eyebrow: "Compare"
Headline: "Carelog vs. CaringBridge vs. Lotsa Helping Hands"
Subhead: "Which one fits your family?"

Comparison table (rows / Carelog ✅ / CaringBridge / Lotsa Helping Hands):
| | Carelog | CaringBridge | Lotsa Helping Hands |
|---|---|---|---|
| **Built for** | Day-to-day family caregiving | Sharing health updates with friends | Coordinating community help (meals, rides) |
| Care journal with reactions | ✅ | ✅ (one-way blog) | ❌ |
| Medication tracking | ✅ | ❌ | ❌ |
| Caregiver shift schedule | ✅ | ❌ | ⚠️ Calendar only |
| Documents vault | ✅ | ❌ | ❌ |
| Whole-team roles (caregiver/aide/family) | ✅ | ❌ | ⚠️ Volunteers only |
| Private + ad-free | ✅ ($14/mo family) | ⚠️ Donation-supported | ❌ Ad-supported |
| HIPAA-conscious | ✅ | ⚠️ Limited | ❌ |
| Founded | 2026 (modern web) | 1997 | 2007 |

Followed by 2 short "Pick X if…" cards:
- "Pick CaringBridge if you only need to broadcast updates to a wide circle."
- "Pick Lotsa Helping Hands if your need is short-term meal/ride sign-ups for a single event."
- "Pick Carelog if you're managing the day-to-day across medications, shifts, and a multi-role care team."

JSON-LD: `Product` schema with `comparison` reference (optional — may skip).

SEO: `metadata.title = "Carelog vs CaringBridge vs Lotsa Helping Hands — Family Caregiving Compared"`. Canonical `/compare`. OG image reuse.

**Acceptance**:
- `/compare` renders, listed in sitemap, linked from navbar.
- Table is keyboard-traversable, contrast ≥ 4.5:1, mobile-friendly (no horizontal scroll at 320px — use stacked cards on mobile if needed).
- All claims in the table are factually defensible (the agent should cite each row's source in PR description).

**Branch**: `feat/marketing-compare-page`.

---

## Track E — User config (out-of-band)

These are not code changes; tracking so they don't drop:

- **#6 (auth)**: After Supabase project finishes restoring (1–2 min), visit `/signin` in prod and confirm sign-in works. If still NetworkError, check Supabase Dashboard → Authentication → URL Configuration: `Site URL` and `Redirect URLs` must include the prod domain.
- **#8 (contact email)**:
  1. Vercel → carelog project → Settings → Environment Variables: confirm `RESEND_API_KEY` is set for Production.
  2. Resend dashboard → Domains: confirm `carelog.app` (sender domain for `noreply@carelog.app`) is verified.
  3. Confirm `hello@carelog.app` actually receives mail (MX records / inbox).
  4. Submit a test contact form on prod and watch the Vercel function log + Resend "Logs" tab.

Outcome to report back: which of those 4 was the actual blocker.

---

## Dispatch plan

Three branches can run in parallel — disjoint file sets:

| Track | Branch | Files | Mode |
|---|---|---|---|
| A | `feat/tertiary-coral-extend` | FeatureGrid, HowItWorks, PricingCards, pricing/page.tsx | Sonnet (judgment, 4 files) |
| C | `perf/marketing-page-nav` | TBD by trace | Sonnet (investigative + implementation) |
| D | `feat/marketing-compare-page` | new compare/, CompareTable.tsx, MarketingNav.tsx, sitemap.ts | Sonnet (new content + route) |

Track B sequenced after A lands. Track E happens in parallel as user actions.

Per CLAUDE.md merge policy: each track opens its own PR, gets the `queue` label, Mergify owns ordering. No PR touches `BACKLOG.md` (status is reconstructed via `/backlog-sync` post-wave).

**Pre-dispatch checklist** (per `/worktree-subagents`):
- `git fetch origin && git rev-parse origin/main` — base SHA noted.
- 3 worktrees under `.worktrees/` with symlinked `node_modules`.
- Each subagent gets a scope contract: file-touch list, branch name, "no BACKLOG.md edits", verify-then-commit.
- Sonnet-tier tasks; no PHI surface here so no special review gate.

**Estimated wall time**: ~30 min if Tracks A/C/D run in parallel and merge cleanly; +15 min for Track B follow-up.

**Backlog sync**: run `/backlog-sync` after the wave completes — it'll reconstruct status from commit subjects (`feat(...)`, `perf(...)`, etc.).
