# Accessibility — Tooling Plan

Snapshot: 2026-04-14. Lists the a11y tooling options available to Carelog, what's already wired, what's easy to add, and concrete stories. Goal: make a11y regressions catchable locally and in CI, not only during manual review.

---

## What's already in place

| Layer | Asset | Notes |
|---|---|---|
| Web design rules | `.claude/rules/ui-standards.md` | WCAG 2.2 AA checklist, token system, focus/contrast rules |
| Web E2E | 40+ Playwright specs under `e2e/` | Uses `getByRole`/`getByLabel` — implicitly exercises a11y trees |
| Web unit | `@testing-library/react` | Encourages role-based queries, not DOM structure |
| Mobile unit | `@testing-library/react-native` | Same role-based philosophy |
| Claude tooling | `chrome-devtools-mcp:a11y-debugging` skill | On-demand audit of running web app |
| Manual | VoiceOver / TalkBack | Ad-hoc device testing |

**Gap**: nothing fails the build on an a11y regression today. Every check is either documentary or opt-in during review.

---

## Tooling options — scored

### Web

| Tool | What it catches | Cost to add | Fail build? |
|---|---|---|---|
| **`eslint-plugin-jsx-a11y`** | Missing alt, role misuse, labels, tabindex misuse, onClick on non-interactive | XS — one config change (included in `eslint-config-next` by default, verify + bump to `recommended`) | Yes (eslint already fails CI) |
| **`@axe-core/playwright`** | Runtime a11y violations on real rendered pages: contrast, ARIA, landmarks | S — one dep + helper in `e2e/helpers.ts`, apply to existing 40+ specs via a single `afterEach` | Yes (Playwright is in CI) |
| **`vitest-axe` / `jest-axe`** | Same as above but at component test level | S — one dep + optional `expect(container).toHaveNoViolations()` on key components | Yes (vitest is in CI) |
| **Lighthouse CI** via `chrome-devtools-mcp` | Contrast, landmarks, mobile a11y, + perf | S — already MCP-accessible, script to run on each PR preview URL | Optional gate |
| **Token contrast validator** (custom script) | Regressions when someone edits `globals.css` tokens | XS — ~30 line Node script that parses `@theme inline` and checks WCAG ratios across token pairs | Yes |
| **Storybook a11y addon** | Component-level a11y while designing | M — assumes Storybook exists (it doesn't yet); heavier lift | Opt-in |

### Mobile (React Native / Expo)

| Tool | What it catches | Cost to add | Fail build? |
|---|---|---|---|
| **`eslint-plugin-react-native-a11y`** | Missing `accessibilityLabel`, `accessibilityRole`, hit-slop on small touchables | XS — one dep + eslint config | Yes |
| **`@testing-library/react-native` a11y queries** (existing) | Enforce `getByRole` / `getByLabelText` in component tests — treat DOM-text queries as smell | XS — lint rule or convention, use `getByRole` over `getByText` | Soft |
| **Detox / Maestro a11y hooks** | End-to-end assertions that elements have labels | M — requires an E2E runner (Maestro is the Carelog-friendly option) | Yes |
| **RN AccessibilityInfo** runtime checks | Detect VoiceOver/TalkBack status, adapt animations | XS — already available, use where relevant | No |
| **Manual VoiceOver / TalkBack** | Real screen-reader UX | Included in `mobile-ui` skill (see below) | No |
| **Tap target validator** | Interactive elements < 44×44 pt | S — RN testing-library allows reading `hitSlop` + layout props; write a helper | Yes |

---

## Recommended wiring (priority order)

### Phase 1 — low-cost, high-coverage (do now)

1. **Axe + Playwright** — one `afterEach` hook in `e2e/helpers.ts` that runs `AxeBuilder` after every page load. Fails the spec on serious+ violations. Covers 40+ specs in one pass. Story **A11Y-001**.
2. **`eslint-plugin-jsx-a11y` at `recommended`** on web. Verify `eslint-config-next` already includes it, bump severity from `warn` → `error` where relevant. Story **A11Y-002**.
3. **`eslint-plugin-react-native-a11y`** on mobile. Matches the web approach. Story **A11Y-003**.
4. **Token contrast validator script** `scripts/a11y-contrast.mjs` — parses `apps/web/app/globals.css` tokens, checks WCAG ratios for every ink/bg pairing used in the system, fails on < 4.5:1 for text or < 3:1 for large/borders. Wire into `pnpm lint`. Story **A11Y-004**.

### Phase 2 — deeper signal (once Phase 1 is green)

5. **`vitest-axe` on key web components** — Card/Form primitives, journal panels, invite flow. Story **A11Y-005**.
6. **Mobile a11y snapshot tests** — for each screen, assert every interactive node has a `role` and a label. Story **A11Y-006**.
7. **Lighthouse CI on Vercel preview URLs** — use the `chrome-devtools-mcp:debug-optimize-lcp` + `a11y-debugging` skills in a scheduled `/loop` or per-PR check. Story **A11Y-007**.

### Phase 3 — experiential (ongoing)

8. **VoiceOver / TalkBack cadence** — every PR touching mobile UI must be exercised under a screen reader once. Document the flow in the `mobile-ui` skill. Story **A11Y-008**.
9. **Reduced motion / reduced transparency** audits — respect `prefers-reduced-motion` on web and `AccessibilityInfo.isReduceMotionEnabled()` on mobile. Story **A11Y-009**.
10. **Color-blindness spot-check** — run key screens through a colorblindness simulator (Chrome DevTools ships one). Story **A11Y-010**.

---

## Stories

| ID | Priority | Effort | Story |
|---|---|---|---|
| A11Y-001 | P0 | S | Wire `@axe-core/playwright` into `e2e/helpers.ts` `afterEach`. Fail on `serious`/`critical` violations. |
| A11Y-002 | P0 | XS | Confirm `eslint-plugin-jsx-a11y` in web eslint config at `recommended`; add any missing rules (`alt-text`, `click-events-have-key-events`). |
| A11Y-003 | P1 | XS | Add `eslint-plugin-react-native-a11y` to mobile, set `recommended`. |
| A11Y-004 | P1 | S | Write `scripts/a11y-contrast.mjs` + `pnpm a11y:contrast` script; fail on sub-AA pairings in the token matrix. |
| A11Y-005 | P2 | M | Add `vitest-axe` assertions to the shared web UI primitives (`Card`, `Button`, `Input`, `Label`, `Dialog`). |
| A11Y-006 | P2 | M | Mobile: snapshot test per top-level screen asserting every `Pressable` has `accessibilityLabel` + `accessibilityRole`. |
| A11Y-007 | P2 | M | Lighthouse a11y audit on each Vercel preview via `chrome-devtools-mcp`; post results on the PR. |
| A11Y-008 | P2 | S | Extend `mobile-ui` skill with VoiceOver/TalkBack enable/disable commands (`xcrun simctl spawn booted ...` / `adb shell settings put secure enabled_accessibility_services`) and a "narrate current screen" workflow. |
| A11Y-009 | P3 | S | Honor `prefers-reduced-motion` on web; honor `AccessibilityInfo.isReduceMotionEnabled()` on mobile. |
| A11Y-010 | P3 | XS | Add a colorblindness simulator walkthrough as part of the UI review checklist in `.claude/rules/ui-standards.md`. |

---

## Quick wins — do this week

1. **A11Y-001** + **A11Y-002**: the whole web app gets automated a11y coverage for the cost of two package installs and a small helper. No new tests needed — existing 40+ specs inherit the check.
2. **A11Y-003**: mobile lint parity, ~5 minutes of setup.
3. **A11Y-004**: protects the design token system from future contrast regressions.

After these four, a11y regressions that today slip through to manual review will start failing CI. Everything else is gravy.
