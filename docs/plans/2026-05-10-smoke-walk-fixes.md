# Smoke-Walk Fix Plan — 2026-05-10

**Backlog rows:** UX-113, UX-114, UX-115, A11Y-020, TD-118 (filed in PR #437)
**Source:** `/live-test` smoke walk through dashboard → journal → recipient profile and the marketing surfaces, after UX-109 burnt-orange palette + UX-112 medication-import side-by-side landed.

## Order, sequencing, and parallelism

A11Y-020 is P1 (live AA failure on the primary auth CTA) and ships first, alone. UX-113/114/115 are independent UI fixes touching disjoint files — safe to parallelize. TD-118 is a server-boot guard plus an error-wrapping helper; independent of the UI work; sized to fit alongside.

| Wave | Story | Branch | Depends on |
|---|---|---|---|
| 1 | A11Y-020 | `fix/a11y-020-signin-contrast` | none |
| 2a | UX-113 | `fix/ux-113-shared-rhythm-illustration` | none |
| 2b | UX-114 | `fix/ux-114-about-duplicate-cta` | none |
| 2c | UX-115 | `fix/ux-115-dashboard-double-fab` | none |
| 2d | TD-118 | `fix/td-118-service-role-guard` | none |

All wave-2 PRs open simultaneously, each in its own worktree (`/Users/bradygrapentine/projects/carelog/.worktrees/<branch>`). Wave 1 ships and merges first to avoid a token-color rebase tangle on the auth surface.

---

## A11Y-020 (P1) — `/signin` button contrast

**Cause (CONFIRMED — adversarial review correction):** `apps/web/app/signin/SignInForm.tsx:130,172` already uses `bg-[var(--color-primary)]` (`#D2691E`) with white text. White-on-`#D2691E` ≈ **3.80:1** — fails the 4.5:1 AA floor for body text. The original hypothesis (`--color-primary-light`) was wrong; the actual offender is `--color-primary` itself.

**Files:**
- `apps/web/app/signin/SignInForm.tsx` — change submit button resting-state bg to `--color-primary-pressed` (`#9C4A14`, **5.67:1 ✓**). Hover can darken further to `--color-primary-deep` (`#6B3210`, 9.52:1 AAA). Do NOT use `--color-primary` for the resting state with white text — it fails AA.
- Sweep: `grep -rn "bg-\[var(--color-primary)\]" apps/web/app apps/web/components` for any other CTA pairing white text with `--color-primary` resting bg. **Expected zero additional sites** beyond the signin button (decorative `--color-primary` usage with non-white FG is fine). If grep returns >0 hits with white text, file a follow-up A11Y row — do NOT fix in this PR.

**Tests:**
- Unit: snapshot/className assertion that the submit button uses the AA-passing token, not `--color-primary-light`.
- Manual: Chrome DevTools Lighthouse a11y audit on `/signin` — must pass color-contrast.

**Acceptance:**
- Lighthouse a11y on `/signin` clears color-contrast.
- Visual regression: button still reads as the brand burnt-orange (don't drift to a different hue family).

---

## UX-113 (P2) — Marketing landing missing illustration at desktop

**Cause (REVISED — adversarial review correction):** The original hypothesis (`hidden lg:block` paired image with a 404 asset) is **wrong**. `apps/web/components/marketing/HowItWorks.tsx:25-33` renders the image unconditionally inside a `md:grid-cols-2`; asset `apps/web/public/images/hero-4.png` exists and serves 200. The desktop "empty grey rectangle" symptom must come from something else — candidates: (a) `object-cover` cropping the visible region out at the wider aspect ratio, (b) image `className` collapsing to zero height when the parent grid behaves differently between `md` and `lg`, (c) a sibling element overlaying the image, (d) the wrong section was screenshotted during the smoke walk.

**Investigation steps (READ-ONLY, ≤15 min, no edits before owner sign-off):**
1. Open `apps/web/components/marketing/HowItWorks.tsx` and inspect the image container's grid + sizing classNames.
2. Reproduce in browser at 1440px with devtools open: inspect the image element, confirm it's actually present in the DOM, check computed `height`/`width`/`object-fit`/`object-position`.
3. If the image is rendered at zero-height: fix the parent grid sizing.
4. If the image is rendered tall but the visible portion is empty: adjust `object-position` or swap to `object-contain`.
5. If the section being reported isn't `HowItWorks` at all: re-locate via the actual headline string in the screenshot and update this plan before touching code.

**Files (anticipated, narrowed):**
- `apps/web/components/marketing/HowItWorks.tsx` — most likely.
- Possibly `apps/web/public/images/hero-4.png` if the asset itself is corrupt or has wrong dimensions.

**Fix paths:**
- (a) Grid collapse → fix the parent `grid` template / image classNames.
- (b) `object-cover` cropping out the focal point → switch to `object-contain` or adjust `object-position`.
- (c) Sibling overlay → fix z-index / positioning.
- If root cause is "asset is wrong artwork for the desktop slot," flag for owner approval before substituting brand artwork.

**Tests:**
- Manual at 375px / 768px / 1440px — image present at every breakpoint.
- No new vitest test (asset-path bug, not a logic bug).

**Acceptance:**
- "A shared rhythm" section renders the caregiver illustration at 1440px.
- No console 404 for the asset.

---

## UX-114 (P3) — `/about` duplicate "Start your family's log" CTAs

**Cause (high confidence):** UX-112 (PR #435) added an in-card CTA inside the medication-import preview. The pre-existing page-level CTA below the card was not removed, so two identical buttons stack.

**Decision (default, can be flipped during impl if context contradicts):** **keep the in-card CTA** (it's adjacent to the action it triggers); **remove the page-level CTA**. If the page-level button is functionally a sticky bottom-bar serving a different role, keep it and remove the in-card one instead — implementer judges from the rendered file.

**Files:**
- `apps/web/app/(marketing)/about/page.tsx` (or wherever the page composes the medication-import card + the page CTA).

**Tests:**
- Existing vitest for the page should be re-snapshotted if one exists.
- Manual: only one "Start your family's log" button visible on `/about`.

**Acceptance:**
- Single CTA renders on `/about`.
- The retained CTA's keyboard tab order still leads naturally from the card content.

---

## UX-115 (P3) — Dashboard double-FAB ambiguity

**Cause (high confidence):** Two filled-primary FABs render bottom-right (Quick log "+" and AI sparkle). Identical visual weight = no primary/secondary hierarchy.

**Fix (default):** keep Quick log filled-primary (it's the primary write action); switch the AI assistant FAB to **outline + smaller**:
- Background: transparent or `--color-surface`.
- Border: `border border-[var(--color-primary)]`.
- Icon color: `text-[var(--color-primary)]`.
- Size: 40×40 (vs 56×56 on the primary FAB) — still ≥40 touch-target minimum.
- Stack vertically with `gap-3`, AI assistant ABOVE Quick log so the primary action sits at thumb-rest.

**Files (CONFIRMED via review):**
- `apps/web/components/QuickLogFab.tsx` — Quick log FAB (keep filled-primary).
- `apps/web/components/ai/AIFab.tsx:15` — AI assistant FAB (currently `bg-[var(--color-primary)]`, `right-24`); change to outline + smaller.

**Tests:**
- Existing FAB a11y test should re-pass with smaller AI FAB still ≥40×40 touch target.
- Add: assertion that the AI FAB does NOT have the same `bg-[var(--color-primary)]` className as the Quick log FAB.

**Acceptance:**
- AI FAB is visually subordinate to Quick log.
- Both still keyboard-reachable, both still ≥40×40 touch target, both retain `aria-label`.

---

## TD-118 (P2) — Defense-in-depth: misconfigured service role key

**Cause (confirmed during smoke walk):** Local `apps/web/.env.local` had a production `sb_secret_*` key in `SUPABASE_SERVICE_ROLE_KEY`. `supabaseAdmin` silently fell back to anon → first server-side write (`POST /api/onboarding/create`) 500'd with an RLS error that pointed at the wrong cause.

**Fix — two parts (file paths CORRECTED):**

The actual admin module is `apps/web/server/supabaseAdmin.server.ts` (not `apps/web/lib/supabaseAdmin.ts`). It already throws on missing env at line 17 and exposes the client via a lazy `Proxy` (line 29). Validation must run inside `getClient()` on first use, NOT at module import — `import` happens before env values are reliably available in some runtime paths.

### Part 1: lazy-first-use validation
- New helper `apps/web/server/validateServiceRoleKey.ts`:
  - Decodes the `SUPABASE_SERVICE_ROLE_KEY` JWT (no signature verification — just parse the payload).
  - Asserts `role === "service_role"`.
  - On failure behavior, by environment:
    - `NODE_ENV === "test"` → skip (don't break the suite).
    - `NODE_ENV === "development"` → log CRITICAL + **throw** (fail loudly so devs notice immediately).
    - `VERCEL_ENV === "preview"` → log CRITICAL + **do NOT throw** (preview env-var typos shouldn't 500 the build).
    - Otherwise (production) → log CRITICAL + do NOT throw (let Part 2's wrapped error surface to users; don't take down a deploy).
- Call site: invoke once inside `getClient()` in `supabaseAdmin.server.ts`, gated by a module-level `validated` boolean so it runs exactly once per process.

### Part 2: error wrapping
- In `supabaseAdmin.server.ts`, wrap thrown PostgrestErrors whose `code === "42501"` or whose message matches `/row-level security/i` with a clearer prefix:
  > "Supabase admin client may not be authenticated as service_role — check `SUPABASE_SERVICE_ROLE_KEY` env. Underlying error: <original>"

### Part 3: `.env.example` doc
- Add a comment to `.env.example` (or `apps/web/.env.example`) above `SUPABASE_SERVICE_ROLE_KEY` documenting that it must be a JWT with `role: "service_role"` — NOT a `sb_secret_*` production-style key.

**Files:**
- New: `apps/web/server/validateServiceRoleKey.ts`
- New: `apps/web/server/__tests__/validateServiceRoleKey.test.ts` (server vitest project)
- Modified: `apps/web/server/supabaseAdmin.server.ts`
- Modified: `apps/web/.env.example` (or repo-root `.env.example` if that's the canonical location — check before editing).

**Tests:**
- `validateServiceRoleKey.test.ts`:
  - Valid `service_role` JWT → returns true.
  - JWT with `role: "anon"` → throws.
  - Non-JWT string (e.g., `sb_secret_abc`) → throws with "not a JWT" message.
  - Missing env → throws with "env var unset" message.
- `supabaseAdmin.test.ts` (extend existing if present):
  - Mock RLS error → wrapped error contains the SUPABASE_SERVICE_ROLE_KEY hint.

**Acceptance:**
- Dev server boot prints a clear CRITICAL error when SUPABASE_SERVICE_ROLE_KEY is wrong, BEFORE any request comes in.
- Onboarding RLS-class errors include the env-var hint in their message.

---

## Out of scope (file as follow-ups if discovered during impl)

- Full audit of every CTA across the app for AA contrast (A11Y-020 sweeps `/signin` only; broader audit = new A11Y row).
- Marketing landing visual regression suite (UX-113 fixes the symptom; building a regression harness is a separate PP/TD row).
- FAB consolidation into a single trigger-with-menu (UX-115 default differentiates them; consolidation is a larger UX redesign).

## Risk

- **A11Y-020 sweep finds widespread `--color-primary-light` misuse.** Mitigation: cap PR at 3 sites; file a follow-up A11Y row for the rest.
- **UX-113 root cause is the asset itself missing from `apps/web/public/`** (not a className bug). Mitigation: in that case the fix needs the original asset OR a substitute — flag for owner approval before substituting brand artwork.
- **TD-118 Part 1 crash-on-boot in dev** could break workflows for devs whose env files are temporarily incomplete. Mitigation: only crash when the env var is PRESENT but malformed; if it's UNSET, log and let the existing "missing env" error path handle it.

## After implementation

- Re-run `/live-test` smoke walk (same routes) to confirm all five surfaced fixes hold.
- **Reminder per ADR-0002: feature/fix PRs do NOT touch `BACKLOG.md`.** Status flips happen via `/backlog-sync` reading conventional-commit subjects from git log + PR list. Each PR's commit subject must include the story ID (e.g. `fix(a11y-020): …`) so sync can find it.
