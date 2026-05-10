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

**Cause hypothesis (high confidence):** `SignInForm` submit uses `bg-[var(--color-primary-light)]` (`#E48A4A`) with white text. Light variant is ~2.5:1, well below 4.5:1 AA. UX-109 swap landed `--color-primary-pressed` (`#9C4A14`, 5.67:1 ✓) for exactly this case.

**Files:**
- `apps/web/app/signin/SignInForm.tsx` — change submit button bg to `--color-primary` (`#D2691E`) + on-hover `--color-primary-pressed`. **Verify the rendered text-on-bg pair clears 4.5:1 with white text.** If `--color-primary` (`#D2691E`, ~3.45:1) doesn't clear AA with white, switch to `--color-primary-pressed` (`#9C4A14`, 5.67:1 ✓) as the resting state.
- Sweep: `grep -rn "color-primary-light" apps/web/app apps/web/components` for any other button/CTA using the light variant as the BG with white FG. File a follow-up if more than 2 sites surface; in-scope to fix in this PR if it's only the signin button.

**Tests:**
- Unit: snapshot/className assertion that the submit button uses the AA-passing token, not `--color-primary-light`.
- Manual: Chrome DevTools Lighthouse a11y audit on `/signin` — must pass color-contrast.

**Acceptance:**
- Lighthouse a11y on `/signin` clears color-contrast.
- Visual regression: button still reads as the brand burnt-orange (don't drift to a different hue family).

---

## UX-113 (P2) — Marketing landing missing illustration at desktop

**Cause hypothesis (medium confidence):** A `hidden lg:block` paired image that points to an asset that 404s, OR a CSS `background-image` URL that broke during a prior rename. Mobile rendering is fine — confirms the asset exists for some breakpoint, just not the desktop variant.

**Investigation steps (read-only, ≤10 min):**
1. `grep -rn "shared rhythm" apps/web` to find the section component.
2. Inspect the JSX for `lg:` / `xl:` conditional image elements.
3. `grep -rn "shared-rhythm\|sharedRhythm\|caregiver" apps/web/public apps/web/app/(marketing)` to find the candidate asset paths.
4. Open browser devtools Network tab on `/` at 1440px → look for the 4xx on the missing image.

**Files (anticipated):**
- One component under `apps/web/app/(marketing)/` or `apps/web/components/marketing/`.
- Possibly `apps/web/public/` if a missing asset needs adding back.

**Fix paths:**
- (a) Asset missing → restore the asset OR repoint the `src` to the existing mobile asset and let it scale.
- (b) Wrong className conditional (e.g. `hidden lg:hidden` instead of `lg:block`) → fix the className.
- (c) Background-image URL stale → update to existing asset path.

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

**Files:**
- `apps/web/components/QuickLogFab.tsx` (or wherever the FAB pair is composed — likely a shared `(app)/layout.tsx` slot).
- The AI assistant FAB component (search: `grep -rn "Open AI Assistant\|AssistantFab\|sparkle" apps/web/components`).

**Tests:**
- Existing FAB a11y test should re-pass with smaller AI FAB still ≥40×40 touch target.
- Add: assertion that the AI FAB does NOT have the same `bg-[var(--color-primary)]` className as the Quick log FAB.

**Acceptance:**
- AI FAB is visually subordinate to Quick log.
- Both still keyboard-reachable, both still ≥40×40 touch target, both retain `aria-label`.

---

## TD-118 (P2) — Defense-in-depth: misconfigured service role key

**Cause (confirmed during smoke walk):** Local `apps/web/.env.local` had a production `sb_secret_*` key in `SUPABASE_SERVICE_ROLE_KEY`. `supabaseAdmin` silently fell back to anon → first server-side write (`POST /api/onboarding/create`) 500'd with an RLS error that pointed at the wrong cause.

**Fix — two parts:**

### Part 1: server-boot validation
- New helper `apps/web/lib/validateServiceRoleKey.ts`:
  - Decodes the `SUPABASE_SERVICE_ROLE_KEY` JWT (no signature verification — just parse the payload).
  - Asserts `role === "service_role"`.
  - On failure: log a CRITICAL `console.error` with a clear message AND throw to refuse to start in dev. In production, log loudly but don't crash (avoid taking down a deploy on a transient env-load issue — let the wrapped error in Part 2 surface to users).
- Call site: `apps/web/lib/supabaseAdmin.ts` module-load.
- Skip in test envs (NODE_ENV === "test") to avoid breaking the suite.

### Part 2: error wrapping
- In `supabaseAdmin.ts` (or the call sites that use it for writes), wrap thrown PostgrestErrors whose `code` is RLS-class (`42501`) or whose message matches `/row-level security/i` with a clearer prefix:
  > "Supabase admin client may not be authenticated as service_role — check `SUPABASE_SERVICE_ROLE_KEY` env. Underlying error: <original>"

**Files:**
- New: `apps/web/lib/validateServiceRoleKey.ts`
- New: `apps/web/lib/__tests__/validateServiceRoleKey.test.ts`
- Modified: `apps/web/lib/supabaseAdmin.ts`

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
- Mark all 5 backlog rows `🟢 Ready` → `🔵 In review` via `/backlog-sync` after PRs open.
