# UX-109b + UX-112 + Theme Test Stub Cleanup — Plan

**Date:** 2026-05-10 (post-merge of #429 + #430)
**Predecessors:** UX-109a (PR #429 — globals.css burnt-orange tokens), UX-110 (PR #430 — dark mode retired). Both merged into main.

## Three independent tracks

| Track | Title | Files | Effort | Mode |
|---|---|---|---|---|
| **A** | UX-109b — raw-hex callsite sweep | `apps/web/app/**`, `apps/web/components/**` | ~90 min | Worktree, single Opus agent, opens PR for review (no auto-merge) |
| **B** | UX-112 — medication-import polish | onboarding medication-import surface | ~60 min | Worktree, single Opus agent, opens PR for review (no auto-merge) |
| **C** | Theme test stub cleanup | 2 stubbed test files | ~5 min | Direct edit by orchestrator, single chore PR, auto-merge |

A and B are independent (different files) and dispatch in parallel. C runs serially in the orchestrator session before/after.

---

## Track A — UX-109b raw-hex callsite sweep

### Why

UX-109a swapped tokens in `globals.css`, but raw hex like `#7c3aed`, `#d97706`, `#e76f51`, plus Sage hex (`#5a6b51`-ish), and explicit Tailwind classes referencing the old palette (`bg-purple-*`, `text-amber-*`, `bg-emerald-*` if used as brand color) survive across components. Visual surfaces still render the old colors anywhere a hardcoded value beats the token.

### Scope contract

**Files allowed — modify or delete:**
- Any file under `apps/web/app/` or `apps/web/components/` that contains a raw retired hex or a brand-color Tailwind class.

**Replacement rules:**
- `#7c3aed` (purple) → `var(--color-primary)` (or appropriate primary tint per context).
- `#d97706` (amber secondary) → `var(--color-secondary)` (deep rust `#A0480B`).
- `#e76f51` (coral tertiary) → DROP — coral is retired. If the call site genuinely needs accent, fall back to `var(--color-primary-light)` or the deep variant.
- Any Sage hex (e.g., `#5a6b51`, `#8a9d80`, `#c8d5be`) → `var(--color-primary)` family.
- Tailwind brand-color classes (`bg-purple-700`, `text-amber-500`, `border-emerald-300`, etc., when used as BRAND, not semantic) → switch to `var(--color-primary)` family via `style={{ background: 'var(--color-primary)' }}` OR use the closest in-family Tailwind orange class (`bg-orange-700`).
- **DO NOT replace** semantic Tailwind colors used for status (`text-red-600` for errors, `text-green-600` for success — those map to semantic tokens, leave them).

**Files NOT to touch:**
- `apps/web/app/globals.css` — already done by UX-109a.
- `apps/web/lib/pdfTokens.ts` — already updated by UX-109a.
- `apps/mobile/**` — separate scope.
- Test files (`*.test.ts`, `*.test.tsx`) unless a hardcoded hex assertion needs updating to the new value.
- Brand asset files (favicon, OG images) — follow-up.
- `docs/`, `BACKLOG.md`, `.claude/` — out of scope.

### Procedure

1. **Inventory pass** (read-only):
   - `grep -rn "#7c3aed\|#d97706\|#e76f51" apps/web --include="*.ts" --include="*.tsx" --include="*.css"` — count files.
   - `grep -rn "bg-purple\|text-purple\|border-purple\|bg-amber\|text-amber\|bg-emerald" apps/web/app apps/web/components --include="*.ts" --include="*.tsx"` — brand-color Tailwind classes.
   - `grep -rni "sage" apps/web/app apps/web/components --include="*.ts" --include="*.tsx"` — Sage references.
2. **Triage** — for each hit, decide replacement per rules above. Skip semantic-color hits.
3. **Edit in batches** — group by file, commit atomically per logical chunk (e.g., one commit per app section).
4. **Verify** — `cd apps/web && npx vitest run --reporter=dot 2>&1 | tail -5`, `npx tsc --noEmit 2>&1 | tail -10`, `npx eslint --quiet app/ components/ 2>&1 | tail -10`.
5. **Visual spot-check** — list all touched routes/surfaces in the PR body so reviewer knows where to look.

### Acceptance

- `grep -c "#7c3aed\|#d97706\|#e76f51" apps/web/app apps/web/components` returns 0.
- No `bg-purple-*` / `text-purple-*` / brand-amber Tailwind classes remain in app/components (semantic OK).
- Vitest green.
- PR body lists every surface touched + a "review these visually" checklist.
- **Does NOT auto-merge.** Owner reviews diff in browser before merging.

---

## Track B — UX-112 medication-import polish

### Why

Per BACKLOG row UX-112 + owner ask 2026-05-10: the onboarding "Preview your medication import" card stacks vertically with the textarea filling the width and a lonely sage-green "Start your family's log" pill below. Wants:

1. Two-column layout: paste textarea LEFT, live preview / explanatory copy RIGHT.
2. Restyle CTA to match new burnt-orange brand (UX-109a) with clearer hierarchy.
3. Subheader above the button + 1-line blurb describing what happens on click.

### Scope contract

**Files allowed — modify only:**
- The onboarding medication-import preview component (likely under `apps/web/app/onboarding/` — find via `grep -rln "Preview your medication import\|family's log" apps/web`).
- Its direct children (preview component, paste box, CTA button).

**Files NOT to touch:**
- Anything outside the onboarding medication-import flow.
- `apps/web/app/globals.css` — tokens already set.
- Other onboarding screens / steps.

### Procedure

1. **Locate** — `grep -rln "Start your family's log" apps/web` to find the file.
2. **Read the surrounding components** to understand the layout primitives in use (Card, CardHeader, CardContent per `.claude/rules/ui-standards.md`).
3. **Apply UI standards** (per `.claude/rules/ui-standards.md` — load before editing):
   - Use shadcn `<Card>` with the tinted `CardHeader` pattern.
   - Two-column layout: `grid grid-cols-1 lg:grid-cols-2 gap-6` (responsive, stacks on mobile per ui-standards "mobile-first" rule).
   - LEFT column: `<Label>Medication list</Label>` + `<Textarea>` with the paste affordance.
   - RIGHT column: explanatory copy + parsed preview list (if any) + the CTA block at the bottom.
   - CTA block: subheader ("Ready to start logging?" or similar editorial), 1-line blurb ("We'll create your care team and seed today's brief from your medications."), then the button.
   - CTA button: use new burnt-orange primary. `bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]` etc.
   - Touch targets ≥ 40×40 (per ui-standards).
   - Focus rings retained.
4. **Verify** — vitest, tsc, eslint, plus Chrome DevTools rendering test on the local dev server (smoke walk: navigate to onboarding, confirm side-by-side renders at 1440px, stacks at 375px).

### Acceptance

- Side-by-side at `lg:` breakpoint, stacks on mobile.
- New CTA hierarchy: subheader + blurb + button.
- Burnt-orange CTA matches token, hover/pressed states use the ramp.
- Vitest green.
- WCAG: button text contrast ≥ 4.5:1 on its background.
- PR body includes a screenshot or a "tested at 375 / 768 / 1440" note.
- **Does NOT auto-merge.** Owner reviews.

---

## Track C — Theme test stub cleanup

### Why

UX-110 (PR #430) intentionally stubbed two test files rather than delete them, per the dispatch rule "do not delete tests to make them green." The stubs (`describe.skip` tombstones) point at `ThemeSwitcher.tsx` and `ThemeToggle.tsx` files that no longer exist. Pure trash now.

### Scope

**Delete:**
- `apps/web/components/theme/__tests__/ThemeSwitcher.test.tsx`
- `apps/web/components/theme/__tests__/ThemeToggle.test.tsx`
- The empty `apps/web/components/theme/__tests__/` directory if it becomes empty.
- The empty `apps/web/components/theme/` directory if it becomes empty.

**Also check:** `apps/web/components/ui/__tests__/tinted-card.test.tsx` has a single `it.skip` for the `tone="dark"` block. KEEP the file (rest still runs); but evaluate whether the skipped block can be deleted (the `tone="dark"` prop is a no-op alias per UX-110 — the skipped test is testing dead behavior).

### Procedure (orchestrator-direct, no subagent)

1. `git rm apps/web/components/theme/__tests__/ThemeSwitcher.test.tsx`
2. `git rm apps/web/components/theme/__tests__/ThemeToggle.test.tsx`
3. `rmdir apps/web/components/theme/__tests__/ apps/web/components/theme/` if empty.
4. Read `apps/web/components/ui/__tests__/tinted-card.test.tsx` — if the `it.skip` block clearly tests dead behavior, delete that block (not the whole file).
5. Run `cd apps/web && npx vitest run --reporter=dot 2>&1 | tail -5` — should be 1971 → 1971 passed (skipped count drops by 2-3).
6. Commit + push + open PR + auto-merge (small mechanical cleanup).

---

## Sequencing

- **Phase 1 (parallel):** Track A + Track B dispatched simultaneously in worktrees.
- **Phase 2 (after Phase 1 merges OR in parallel):** Track C — orchestrator-direct, can interleave any time.

A and B don't conflict (A touches non-onboarding surfaces; B touches onboarding only — verify with grep before dispatch).

## Risk register

- **A grep miss.** A regex inventory may miss raw hex hidden in template literals or computed style strings. Mitigation: review the agent's PR diff carefully; raw-hex audit is additive, follow-up sweeps are cheap.
- **B layout breaks at narrow widths.** Mitigation: scope contract requires testing at 375 / 768 / 1440 and includes the screenshot/note in PR body.
- **C deletes too much** if `tinted-card.test.tsx` `it.skip` isn't actually dead. Mitigation: orchestrator owns Track C, easier to judge inline.

## Validation pass (after all 3 land)

1. Local visual smoke walk via `live-test`: dashboard, journal, onboarding, marketing — confirm new palette + no dark-mode artifacts + onboarding side-by-side renders.
2. Vitest green.
3. `gh pr checks <num>` green for each.
4. Final BACKLOG sync via `/backlog-sync` to mark UX-109b, UX-112, and the test cleanup as shipped.

## Out of scope (file as backlog if still wanted)

- Brand asset regeneration (favicon, OG images, signin block) — visual not just CSS, needs design pass.
- `apps/mobile/` palette swap — separate scope.
- Test that asserts "no PII ever passes to posthog.identify or posthog.capture" — see `docs/project-info/runbooks/POSTHOG_USAGE.md` (or filed as TD-XXX in BACKLOG).
