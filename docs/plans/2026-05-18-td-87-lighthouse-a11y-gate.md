# TD-87 — Lighthouse a11y CI gate (path b: Playwright-served local build)

**Date:** 2026-05-18
**Source backlog:** TD-87 (🟡 Spike → 🟢 Ready post-decision)
**Sprint slug:** td-87-lighthouse-a11y-gate
**Base SHA:** HEAD of main post #601
**Execution mode:** direct (single track)
**Spike decision recorded in:** new ADR-0005 (+ `docs/adr/README.md` index update — 4th file)
**Required-check policy:** this workflow is NOT a required check for branch protection in v1. We re-evaluate after one week of green runs; promoting to required requires `merge_group` trigger to be wired first.

## Why this matters

Current `lighthouse-a11y.yml` workflow fires on Vercel `deployment_status:success`. Vercel previews are password-protected → `scripts/lighthouse-a11y.mjs` probes the URL, gets 401/403, exits 0. The gate has been functionally disabled for every PR for an unknown stretch (months). Quoting TD-87: *"the 401/403 skip path handles Vercel preview auth but leaves no working enforcement path."* A regression that drops marketing-page a11y below the 90 threshold ships silently. This work re-arms the gate so it actually fires.

## Decision: path (b) — Playwright-served local build

Selected 2026-05-18 over path (a) (Vercel preview password-off — operationally fragile, exposes pre-merge builds publicly) and path (c) (post-deploy production audit — post-hoc, doesn't prevent regressions). Rationale captured in ADR-0005 (new this PR).

## Scope contract

```
FILES ALLOWED:
  - .github/workflows/lighthouse-a11y.yml         (rewrite trigger + steps)
  - scripts/lighthouse-a11y.mjs                   (multi-URL support; remove silent-skip)
  - docs/adr/0005-lighthouse-a11y-gate-path.md    (new — decision record)
  - docs/adr/README.md                            (append index entry for 0005)
BRANCH: chore/td-87-lighthouse-a11y-gate
DO NOT:
  - touch BACKLOG.md (BACKLOG-as-SoT)
  - touch any apps/web/** source code
  - alter the 90-score threshold (separate decision)
  - run Lighthouse against production from this workflow (path c was deliberately rejected)
PHI RULE: n/a — no analytics surface touched
VERIFY: see Acceptance below
```

## Track 1 (only) — Re-arm Lighthouse a11y gate

### Change 1 — `.github/workflows/lighthouse-a11y.yml`

Rewrite. Mirror `ci.yml`'s proven start-then-audit block (lines 298–311) rather than hand-rolling.

- **Trigger:** `pull_request` only for v1. **Do NOT add `merge_group`** until/unless this becomes a required check (otherwise we burn CI minutes on every queue run for a non-gating audit). Document the policy in the ADR.
- **`paths:` filter** (broad enough to fire on anything that can move marketing-page a11y score; mirrors the surface enumeration in §Decision):
  - `apps/web/app/(marketing)/**`
  - `apps/web/app/layout.tsx`
  - `apps/web/app/globals.css`
  - `apps/web/components/marketing/**`
  - `apps/web/components/ui/**`              (shadcn primitives reused on marketing)
  - `apps/web/package.json`
  - `pnpm-lock.yaml`
  - `scripts/lighthouse-a11y.mjs`
  - `.github/workflows/lighthouse-a11y.yml`
  - (No tailwind/postcss configs — Tailwind v4 via `@theme inline` in `globals.css`, already covered.)
- **Concurrency:** `group: lighthouse-a11y-${{ github.ref }}`, `cancel-in-progress: true` (safe — not a required check).
- **Action pins:** copy from `ci.yml`. Specifically `actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0`, `pnpm/action-setup@v3.0.0` (TD-23 pins), `actions/checkout@v4.2.2`.
- **Node version: 22** (matches `ci.yml` lines 85/100/123 — NOT 20).
- **Build + start:** use `pnpm --filter web build` and `pnpm --filter web start &`. Env-var prep: marketing pages don't query Supabase but the build needs the vars resolvable. **Copy the JWT-sign step from `ci.yml:283–296` verbatim** (signs an HS256 token in-step and exports `$ANON_KEY` / `$SERVICE_ROLE_KEY` to `$GITHUB_ENV`); then prefix build + start with the same `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY"` envs that `ci.yml:299–305` uses. Do NOT hard-code a literal JWT — copy the proven pattern.
- **Start command (exact):** `pnpm --filter web start > /tmp/start.log 2>&1 &` (redirect both streams so the on-failure `cat /tmp/start.log` step has output).
- **Wait-for-ready:** `npx wait-on http://localhost:3000 --timeout 60000` — identical to `ci.yml:311`. **Do NOT hand-roll a 15s poll.**
- **Audit command:** `node scripts/lighthouse-a11y.mjs http://localhost:3000 http://localhost:3000/pricing http://localhost:3000/about` (verbatim — script accepts N URL args after Change 2).
- **On failure step:** pipe `pnpm --filter web start` background logs to `/tmp/start.log` and `cat` it on job failure (per /opus-on-opus nit).

### Change 2 — `scripts/lighthouse-a11y.mjs`

- Accept N URL args via `process.argv.slice(2)`. **If args.length === 0, default to `["http://localhost:3000"]`** — preserves the current `pnpm lighthouse:a11y` script behavior for local dev.
- Audit each URL in sequence; aggregate failures.
- **Remove the 401/403 silent-skip entirely.** It existed only for the broken Vercel preview path; the new workflow targets localhost which is always reachable. The unreachable-URL branch becomes a single explicit check: `if (process.env.CI === "true") process.exit(1); else process.exit(0);` — one place, one condition, no overlap (per /opus-on-opus nit).
- **Pin `@lhci/cli`** — change `npx --yes @lhci/cli@latest` to `npx --yes @lhci/cli@0.15.0` (or pin to whatever `latest` resolves to today; capture the SHA-free version string in the ADR's Consequences section). `@latest` undermines `--frozen-lockfile` integrity per /opus-on-opus SF3.
- Aggregate exit: nonzero if **any** audited route has score < 90. Print per-route table at end with audit-id breakdown for failures (current top-5-failing logic stays, but emitted per URL).

### Change 3 — `docs/adr/0005-lighthouse-a11y-gate-path.md` (new)

- Standard ADR template: Context (TD-87 background, three paths considered), Decision (path b chosen), Consequences (CI time +3–5 min on marketing-touching PRs, gate is now enforceable, no Vercel-config dependency, NOT a required check in v1, `@lhci/cli` pinned to a specific version).
- Cross-reference TD-87 backlog row.
- ≤80 lines.

### Change 4 — `docs/adr/README.md`

- Append one line to the Index: `- [0005 — Lighthouse a11y CI gate path](./0005-lighthouse-a11y-gate-path.md)`.
- One-line diff. Mechanical.

## Acceptance

1. PR diff touches exactly the **4** files in scope (workflow yml, script mjs, ADR md, ADR README index).
2. `gh pr checks` on this PR shows the new Lighthouse A11Y job running, completing in <8 min, **passing** (current marketing pages presumed ≥90 — verify by inspection of the first green run's per-route table).
3. **Regression-detection proof** — DEFAULT is the real-defect approach (exercises the multi-URL aggregation path introduced in Change 2; threshold check alone only tests the single-number compare):
   - **(3a, default — real-defect approach)** Add a concrete a11y defect to `apps/web/app/(marketing)/about/page.tsx` that Lighthouse audits: e.g. a `<button>` with empty inner text and no `aria-label` (fails `button-name`) OR an `<a>` with no discernible name. Push; confirm the job fails with the expected audit id in the log AND that the per-route table marks `/about` as failing while `/` and `/pricing` pass; revert before merging.
   - **(3b, fallback — threshold approach)** If a real-defect injection proves flaky in practice, fall back: temporarily set the threshold to `100`; confirm fail; revert. Documents in PR description if used.
4. ADR-0005 readable in ≤2 min; clearly states why (b) over (a) and (c); names the `@lhci/cli` pinned version; states v1 is non-required.
5. Workflow uses action pins matching the existing `ci.yml` convention: full SHAs where `ci.yml` uses them (`actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0`); tag pins where `ci.yml` uses them (`pnpm/action-setup@v3.0.0`, `actions/checkout@v4.2.2`). The TD-23 SHA-pin sweep elected to pin some by tag (with end-of-line version comment); match that convention exactly rather than re-deciding.
6. Workflow uses `npx wait-on http://localhost:3000 --timeout 60000` verbatim — no hand-rolled poll loop.
7. Local-dev invocation `pnpm lighthouse:a11y` (no args) still works after the script change (defaults to `["http://localhost:3000"]`).

## /oop dimensions to watch

- **Encapsulation:** the script's "skip" decision should be in one place, not scattered across two branches with overlapping conditions.
- **Acceptance honesty:** the regression-detection step (Acceptance #3) is non-negotiable — pre-existing CI passing without that check is exactly the failure mode TD-87 was filed against. Don't ship without exercising it once.
- **Cycle complexity:** the script grows from "one URL one audit" to "N URLs aggregated". Keep the per-URL audit function pure; aggregate at the top level.

## Out of scope (file-and-watch)

- **Score threshold tuning.** 90 stays. If post-merge audits surface false positives, file as a follow-up TD-* row.
- **Other a11y gates** (axe-core in vitest, Storybook a11y addon). Out of scope; not asked for.
- **Mobile a11y (RN)** — different toolchain entirely; separate row (A11Y-006).
- **Restoring E2E green on main.** Acknowledged blocker; out of scope here; new follow-up row recommended.
- **Touching the `scripts/lighthouse-a11y.mjs` 90-vs-95 threshold conversation** — out of scope per Acceptance #1.

## Risks accepted

- **CI minutes cost:** +3–5 min per marketing-touching PR. Broad path filter (including `components/ui/**` for shadcn primitives) means more PRs fire than the strict-marketing filter would catch. Acceptable cost for a real gate; revisit if average PR cycle time degrades >10%.
- **`pnpm --filter web start &` race risk:** mitigated by using the proven `npx wait-on` pattern from `ci.yml` rather than hand-rolling (per /opus-on-opus MF1). 60s timeout matches the E2E job's empirical comfort window.
- **First run will likely surface real a11y issues.** Plan assumes `/`, `/pricing`, `/about` are currently ≥90. If not, the PR surfaces real bugs to fix — that's the gate working, not a defect of this work. If first run is <90, capture the failing audit-id list as a follow-up TD-* row and either fix-in-this-PR (if small) or lower threshold to current-floor (with ADR note + follow-up to raise after fixes).
- **`@lhci/cli` version drift via `--yes`:** mitigated by pinning to an explicit version (per /opus-on-opus SF3). Re-pin on a quarterly cadence.

## Merge order

Single PR. No dependencies. Auto-merge armed at open per project policy.

## Post-merge

- /oop --from-sprint on the touched files (one workflow yml + one script + one ADR = small surface; may surface 0–2 should-fixes)
- /housekeeping-wave → /backlog-sync to flip TD-87 from 🟡 Spike to ✅ Shipped in §7
