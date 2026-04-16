# Group A — Web UI Polish & A11Y Primitives

**Sonnet orchestrator + Ollama fan-out. Branch base: `origin/main`. All work lives under `apps/web/` only.**

---

## Why this grouping

Four Ready/Deferred backlog rows that all live inside `apps/web/` and touch disjoint files. Each one is mechanical-with-judgment — perfect for an Ollama fan-out where Sonnet writes the contract and reviews the diff, while Ollama drafts the per-file edits.

**File-isolation guarantee:** every story in this group writes to a different subtree of `apps/web/`. The other Sonnet instance (Group B) is restricted to `apps/mobile/` + `packages/`, so the two sessions can run concurrently without merge conflicts.

---

## Stories included

| ID | Story | Branch | Approx |
|---|---|---|---|
| ON-48 | Neutral design tokens + brief-page hex sweep | `feat/on48-neutral-tokens` | 1 hr |
| A11Y-005 | `vitest-axe` assertions on shared web primitives | `feat/a11y-005-vitest-axe` | 2 hr |
| UX-06 | Sidebar tooltip labels (shadcn `Tooltip`) | `feat/ux-06-sidebar-tooltips` | 1 hr |
| UX-10 | Export styling for `/brief/[token]` + `/care/[token]` | `feat/ux-10-export-styling` | 2 hr |

Total: ~6 hr of mechanical work compressed by parallel Ollama dispatch.

---

## Recommended execution order

`UX-10` and `ON-48` both touch `apps/web/app/brief/[shareToken]/page.tsx`. **Do ON-48 first**, merge, then start UX-10 from refreshed main. The other two (A11Y-005, UX-06) are fully independent and can run in parallel from the start.

```
T0:   ┌── ON-48 (Ollama) ─────┐
      ├── A11Y-005 (Ollama) ──┤
      └── UX-06 (Ollama) ─────┘
                ↓ merge ON-48
T1:   └── UX-10 (Ollama) ─────┘
```

Sonnet stays as the orchestrator: writes scope contracts, dispatches via `/ollama`, runs `pnpm typecheck && pnpm test && pnpm lint` after each Ollama return, opens PRs via `/commit-push-pr`.

---

## Story details

### ON-48 — Neutral design tokens + brief-page hex sweep

**Files allowed:**
- `apps/web/app/globals.css` (add tokens to `@theme inline` block)
- `apps/web/app/brief/[shareToken]/page.tsx` (replace inline hex)

**Work:**
1. In `globals.css`, add inside the `@theme inline` block:
   - `--color-neutral-50: #f9fafb;`
   - `--color-neutral-100: #f3f4f6;`
   - `--color-neutral-200: #e5e7eb;`
   - `--color-neutral-400: #9ca3af;`
   - `--color-neutral-700: #374151;`
   - `--color-white: #ffffff;`
2. In the brief page, find the 19 `TODO` comments flagging missing neutrals; replace inline hex (`#fff`, `gray-50`, etc.) with `var(--color-neutral-*)` / `var(--color-white)`. Delete the workaround `TODO` comments as you replace each one.
3. Verify zero raw hex remain in the brief page: `grep -nE '#[0-9a-fA-F]{3,8}' apps/web/app/brief/[shareToken]/page.tsx`.

**AC:** `pnpm typecheck` clean; `pnpm test` green; visual spot-check via `chrome-devtools-mcp` on `/brief/[shareToken]` (use any seeded share token from local dev).

**Rules to enforce:** see `.claude/rules/ui-standards.md` § "Design tokens — always consume, never invent". No new tokens beyond the six listed above.

---

### A11Y-005 — `vitest-axe` assertions on shared web primitives

**Files allowed:**
- `apps/web/components/ui/__tests__/*.test.tsx` (new files)
- `apps/web/package.json` (add `vitest-axe` dev dep, only if not already present)
- `apps/web/vitest.config.ts` or equivalent setup file (only to wire global `expect.extend(toHaveNoViolations)` if needed)

**Work — fan out to Ollama, one component per worker:**
1. `Card.test.tsx` — render `<Card><CardHeader><CardTitle>Title</CardTitle></CardHeader><CardContent>body</CardContent></Card>`, assert `axe(container)` returns no violations.
2. `Button.test.tsx` — render default + `variant="outline"` + `disabled` + icon-only-with-`aria-label` cases.
3. `Input.test.tsx` — wrapped with associated `<Label htmlFor>`.
4. `Label.test.tsx` — confirm `htmlFor` association renders properly.
5. `Dialog.test.tsx` — open state, ensure `aria-modal`, focus-trap announce.

Each test file: import the primitive from `apps/web/components/ui/<name>.tsx`, render via `@testing-library/react`, run `axe`, assert no violations. Keep test files <40 lines each.

**AC:** `pnpm --filter web test` green; new tests show in vitest output; no a11y violations reported. **Do NOT modify the primitives themselves** — if axe surfaces a real violation, stop, file a follow-up `A11Y-*` row, and skip that primitive's test.

**Reference:** see how `e2e/helpers.ts` already wires `checkA11y()` for E2E (post A11Y-001 in §7) — same axe rules apply.

---

### UX-06 — Sidebar tooltip labels (shadcn `Tooltip`)

**Files allowed:**
- `apps/web/components/sidebar/SidebarNav.tsx`
- `apps/web/components/sidebar/SidebarRail.tsx`
- `apps/web/components/sidebar/__tests__/SidebarNav.test.tsx` (extend if exists, create otherwise)

**Work:**
1. Wrap each icon-rail nav item in a shadcn `<Tooltip>` (already in `apps/web/components/ui/tooltip.tsx`). Tooltip content = the page label.
2. Tooltip should appear on hover AND on keyboard focus (shadcn default behavior — verify, don't override).
3. Ensure `aria-label` on the rail button stays — Tooltip is supplementary, not a replacement for the accessible name.
4. Test: snapshot or RTL `userEvent.hover` then `getByRole('tooltip')`.

**AC:** typecheck + test green; manual: `pnpm web` → collapse sidebar → hover icons → tooltip appears with correct label; Tab through items → tooltip appears on focus.

**Rules:** see `.claude/rules/ui-standards.md` § "Component hierarchy" + "Accessibility". Do NOT remove existing `aria-label`s.

---

### UX-10 — Export styling for `/brief/[token]` + `/care/[token]`

**Depends on ON-48 being merged first** (shares the brief page).

**Files allowed:**
- `apps/web/app/brief/[shareToken]/page.tsx`
- `apps/web/app/care/[shareToken]/page.tsx` (or whatever the outer-circle public route is named — verify with Glob)
- New: `apps/web/app/brief/[shareToken]/print.css` and matching for care if a print stylesheet pattern fits

**Work:**
1. Audit both share pages — identify any inline styling that diverges from the token system (now that ON-48 added neutrals, this should be straightforward).
2. Add a print-friendly variant: `@media print` rules to hide nav chrome, expand cards, switch to high-contrast neutrals.
3. Ensure both pages respect `--color-ink`, `--color-surface`, `--color-border` for headings/cards, and the new `--color-neutral-*` for fills.
4. Add a snapshot test or visual spot-check via `chrome-devtools-mcp` capturing both pages at desktop + mobile widths in light mode.

**AC:** typecheck + lint clean; pages render identically in screen mode; print-preview (Cmd+P) shows clean printable layout; no raw hex.

---

## Subagent dispatch contract (paste into every Ollama prompt)

```
FILES ALLOWED: <exact list from story above>
BRANCH: <exact branch from story above>
DO NOT: touch files outside list, add features outside ticket, edit components in A11Y tests
PHI RULE: n/a (no analytics calls in scope)
VERIFY: run `pnpm typecheck` and `pnpm --filter web test` before reporting done
RETURN: diff summary + list of files NOT changed (for confirmation)
```

---

## Definition of done (every story)

- [ ] `pnpm typecheck` clean
- [ ] `pnpm --filter web test` green
- [ ] `pnpm lint` clean
- [ ] No raw hex in changed files (`grep -nE '#[0-9a-fA-F]{3,8}'` returns 0)
- [ ] Keyboard-traversable; visible focus rings preserved
- [ ] Backlog row updated in same commit (`Status: 🔎 In review`, add `PR: #NNN`)
- [ ] PR opened via `/commit-push-pr`

## After all four merge

Run `/backlog-sync` to roll the four rows into §7 with their PR numbers and rewrite the §0 status board.
