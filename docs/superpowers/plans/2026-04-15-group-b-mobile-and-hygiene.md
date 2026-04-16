# Group B — Mobile UX + Type/Dead-Code Hygiene

**Sonnet orchestrator + Ollama fan-out. Branch base: `origin/main`. All work lives under `apps/mobile/` and `packages/` only.**

---

## Why this grouping

Four backlog rows that all live outside `apps/web/` and touch disjoint subtrees. Group A (the other Sonnet instance) is restricted to `apps/web/`, so this group can run concurrently without conflict.

The mix here is deliberate:
- **One quick prerequisite** (TD-05) that unblocks tighter typing across mobile tRPC calls
- **One mechanical hygiene sweep** (ON-37) — high Ollama leverage
- **One a11y test scaffold** (A11Y-006) — pattern repeated across screens, ideal for fan-out
- **One UX feature** (UX-05) — needs Sonnet judgment, Ollama assists with shells

---

## Stories included

| ID | Story | Branch | Approx |
|---|---|---|---|
| TD-05 | Regenerate `@carelog/supabase-types` after messaging migration | `chore/td-05-regen-types` | 15 min |
| ON-37 | `ts-prune` unused-exports sweep (mobile + packages) | `chore/on37-ts-prune` | 3 hr |
| A11Y-006 | Mobile a11y snapshot test per top-level screen | `feat/a11y-006-mobile-a11y-snapshots` | 3 hr |
| UX-05 | Mobile-optimized journal entry (bottom-sheet + horizontal mood row) | `feat/ux-05-mobile-journal-bottom-sheet` | 4 hr |

Total: ~10 hr of work compressed by Ollama fan-out.

---

## Recommended execution order

`TD-05` is a prerequisite — it deletes `as any` casts in `messagesRepository.ts` and any new tRPC types referenced by mobile screens. **Run it first**, merge, then start the other three in parallel.

```
T0:   └── TD-05 (Sonnet — too small to delegate) ──┐
                                                    ↓ merge
T1:   ┌── ON-37   (Ollama fan-out per package) ────┐
      ├── A11Y-006 (Ollama fan-out per screen) ────┤
      └── UX-05   (Sonnet + Ollama for shells) ────┘
```

After T1 merges, run `/backlog-sync` to update the §0 status board.

**Concurrency note:** ON-37 may want to delete unused exports from `packages/shared` while A11Y-006 imports from mobile screens. Mobile screens ≠ `packages/shared` exports, so the two should not collide. If ON-37 finds an export that A11Y-006 just started using, leave it (mark as live).

---

## Story details

### TD-05 — Regenerate Supabase types

**Files allowed:**
- `packages/supabase-types/**` (regenerated output only)
- `apps/mobile/lib/supabase/messagesRepository.ts` (remove `as any` casts)
- Any other file with `as any` directly attributable to the messaging migration (verify with grep)

**Work:**
1. Confirm messaging migration is in `supabase/migrations/` (it shipped via PR #49 / ON-43).
2. Run `/supabase-types` skill (or `pnpm --filter @carelog/supabase-types regenerate` per the skill's docs).
3. Open `apps/mobile/lib/supabase/messagesRepository.ts` — remove `as any` casts that the freshly generated types now satisfy.
4. Run `pnpm typecheck` — must be clean with zero new errors.

**AC:** `pnpm typecheck` clean; zero `as any` in `messagesRepository.ts`; types package diff committed alongside the cast removal.

**Do this in Sonnet directly** — too small to dispatch.

---

### ON-37 — `ts-prune` unused-exports sweep

**Files allowed (in this branch only):**
- Anywhere under `apps/mobile/`, `packages/shared/`, `packages/utils/` that `ts-prune` flags
- `apps/web/` is **OUT OF SCOPE** for this branch (Group A owns web)
- Skip `packages/supabase-types/` (auto-generated)

**Work:**
1. Run `pnpm dlx ts-prune -p apps/mobile/tsconfig.json > /tmp/tsprune-mobile.txt`
2. Run `pnpm dlx ts-prune -p packages/shared/tsconfig.json > /tmp/tsprune-shared.txt` (and same for `packages/utils`)
3. **Before deleting any export from a workspace `index.ts`**: grep across ALL apps/packages (including `apps/web`) to confirm zero consumers — Group A may import workspace exports even though it doesn't edit our files.
4. For each flagged export:
   - **True orphan** (zero grep hits anywhere) → delete the export and its definition
   - **False positive** (used dynamically, re-export, etc.) → annotate with `// ts-prune-ignore-next` + one-line reason
   - **Used only in tests** → keep, annotate
5. Re-run `ts-prune`; report should be ≥50% smaller.

**Fan out to Ollama:** one worker per package (mobile, shared, utils). Sonnet aggregates the decisions and applies the deletes (so a single agent owns the cross-package grep verification).

**AC:** `ts-prune` report reduced ≥50%; `pnpm typecheck` + `pnpm test` green for all workspaces; `pnpm --filter web typecheck` still passes (proves no shared export was wrongly deleted).

---

### A11Y-006 — Mobile a11y snapshot test per top-level screen

**Files allowed:**
- `apps/mobile/__tests__/a11y/*.test.tsx` (new dir + files)
- `apps/mobile/jest.config.*` (only if a setup tweak is needed; prefer not)

**Top-level screens** (one snapshot test per screen, fan out one Ollama worker per file):
- `journal/index.tsx`
- `medications/index.tsx`
- `documents/index.tsx`
- `team/index.tsx`
- `schedule/index.tsx`
- `expenses/index.tsx`
- `symptoms/index.tsx`
- `burnout/index.tsx`
- `benefits/index.tsx`
- `settings/index.tsx` (if exists in `apps/mobile/app/(app)/settings/`)
- `more/index.tsx`

(Verify exact paths via `apps/mobile/app/(app)/`.)

**Per-test pattern (give Ollama this template):**
```tsx
import { render } from '@testing-library/react-native';
import Screen from '../../app/(app)/<area>/index';

it('every Pressable on <area> screen has accessibilityLabel + accessibilityRole', () => {
  const { UNSAFE_root } = render(<Screen />);
  const pressables = UNSAFE_root.findAllByType(/* Pressable or Touchable */);
  for (const p of pressables) {
    expect(p.props.accessibilityLabel).toBeDefined();
    expect(p.props.accessibilityRole).toBeDefined();
  }
});
```

**AC:** every listed screen has its test; `cd apps/mobile && pnpm test` green. **Do NOT modify the screens** to make tests pass — if a Pressable lacks a label, file a follow-up `A11Y-*` row and skip that screen's test (note in PR description). ON-20 already swept icon-only buttons (PR #41), so most should already pass.

**Reference:** `apps/mobile/CLAUDE.md` for mobile testing harness conventions; ON-20 PR for the labeling pattern.

---

### UX-05 — Mobile-optimized journal entry (bottom-sheet + horizontal mood row)

**Files allowed:**
- `apps/mobile/app/(app)/journal/` (new entry/edit screens or bottom-sheet component)
- `apps/mobile/components/journal/` (new components)
- `apps/mobile/components/ui/BottomSheet.tsx` (only if no shared sheet primitive exists yet — verify first)

**Work:**
1. Read current `apps/mobile/app/(app)/journal/index.tsx` and the new-entry flow to understand current data model + tRPC mutations (`journal.create` or similar). **Do not change the data model.**
2. Replace the existing modal/full-screen new-entry UI with a bottom-sheet that slides up from the tab bar.
3. Inside the sheet:
   - Horizontal scrolling mood row (good / okay / difficult / crisis) using `--color-mood-*` token equivalents from mobile theme
   - Body textarea below
   - Save / Cancel actions
4. Use `useAppTheme()` for dark-mode support (the skeleton screens from ON-28 do this — copy the pattern).
5. Visual verify via `/mobile-ui` skill — capture screenshot of the bottom-sheet on iOS sim in both light and dark mode.

**Sonnet does the screen wiring; fan out to Ollama for:**
- Generating component shells (`MoodRow.tsx`, `BottomSheet.tsx` if needed)
- Adding RTL tests for the mood-row interaction
- Drafting accessibility labels for each mood button

**AC:** `cd apps/mobile && pnpm test && pnpm typecheck` green; `/mobile-ui` screenshot saved + referenced in PR; data model unchanged; existing tRPC mutations still used.

**Rules:** see `apps/mobile/CLAUDE.md` for mobile UI conventions; ON-26 / ON-28 for the empty-state + skeleton patterns to mirror.

---

## Subagent dispatch contract (paste into every Ollama prompt)

```
FILES ALLOWED: <exact list from story above>
BRANCH: <exact branch from story above>
DO NOT: touch apps/web/** (Group A owns it), modify screens to satisfy a11y tests,
        delete shared exports without grepping ALL apps first, change DB schemas,
        edit packages/supabase-types/* by hand
PHI RULE: posthog.identify/capture must use UUID — never email/name/free-text
VERIFY: `cd apps/mobile && pnpm typecheck && pnpm test` before reporting done.
        For ON-37: also run `pnpm --filter web typecheck` to prove web still builds.
RETURN: diff summary + list of files NOT changed
```

---

## Definition of done (every story)

- [ ] `pnpm typecheck` clean across affected workspaces
- [ ] Tests green (mobile vitest/jest + any package tests touched)
- [ ] `pnpm lint` clean
- [ ] For UX-05: `/mobile-ui` screenshot attached to PR
- [ ] Backlog row updated in same commit (`Status: 🔎 In review`, add `PR: #NNN`)
- [ ] PR opened via `/commit-push-pr`
- [ ] For ON-37: `pnpm --filter web typecheck` still passes (proves no Group-A breakage)

## Coordination note with Group A

If Group A's PRs land first while Group B is mid-flight, rebase against `origin/main` before pushing — there should be zero file conflicts (different subtrees), but `pnpm-lock.yaml` may shift if ON-37 adds `ts-prune` as a dev dep or A11Y-005 adds `vitest-axe`. Resolve lockfile conflicts by accepting both deps and re-running `pnpm install`.

## After all four merge

Run `/backlog-sync` to roll the four rows into §7 with their PR numbers and rewrite §0 status board counts.
