# ADR-0005 — Lighthouse a11y CI gate: build locally and audit in CI (path b)

**Status:** Accepted · 2026-05-18
**Supersedes:** —
**Superseded by:** —
**Related:** TD-87 (`BACKLOG.md`), TD-23 (action SHA pinning), SEO-005 (Core Web Vitals baseline doc), `.claude/rules/ui-standards.md` (a11y rules enforced at code-review time)

## Context

The `.github/workflows/lighthouse-a11y.yml` workflow was filed against TD-15-era CI rebuild. It fired on Vercel `deployment_status:success` events and ran `scripts/lighthouse-a11y.mjs` against the preview URL.

Every Vercel preview deployment for this project is password-protected. The audit script probed the URL, received `401` or `403`, and called `process.exit(0)` with a "skipping — run on a public URL to enforce" log line. The result: **the gate has been functionally disabled on every PR for months**. A regression that drops marketing-page a11y below the 90 threshold ships without warning.

TD-87 was filed as a spike to pick one of three paths:

- **(a)** Disable Vercel preview password on marketing routes only. Simplest. Exposes pre-merge marketing builds to anyone with the URL. Depends on a Vercel-dashboard config knob that can be silently changed.
- **(b)** Build `apps/web` in CI, serve via `pnpm start`, audit `localhost`. Adds 3–5 min to marketing-touching PRs. Self-contained — no Vercel-config dependency. Deterministic.
- **(c)** Audit production after merge. True production assertion but post-hoc — regressions ship before catching them. Useful as a monitor, not as a gate.

## Decision

**Path (b).** Build the app in CI, serve via `pnpm start`, audit a fixed list of marketing URLs.

Initial routes: `/`, `/pricing`, `/about`. Matches the SEO-005 CWV baseline doc.

The workflow mirrors `ci.yml`'s proven E2E build-and-start block (`ci.yml:283–311`) — same JWT-sign step, same `NEXT_PUBLIC_SUPABASE_*` envs, same `npx wait-on http://localhost:3000 --timeout 60000`. No hand-rolled poll loops.

The audit script aggregates per-URL results: if any audited URL scores below 90, the job fails.

`@lhci/cli` is pinned to a specific version (currently `0.15.1`) rather than `@latest` — `--frozen-lockfile` integrity demands a frozen audit tool too. Re-pin on a quarterly cadence.

**v1 is NOT a required check** for branch protection. The workflow fires on `pull_request` only — no `merge_group` trigger. Re-evaluate promoting to required after one week of green runs; promotion requires wiring `merge_group` first (the GitHub-merge-queue pattern that `ci.yml:11` uses).

## Consequences

**Positive**
- The gate now actually fires. A real a11y regression on a marketing page fails the PR check.
- No Vercel-dashboard dependency. The gate's behavior lives entirely in this repo.
- The audit script remains usable for local dev — `pnpm lighthouse:a11y` (no args) defaults to `http://localhost:3000` and behaves identically to before.

**Negative**
- CI minutes: +3–5 min on PRs that touch marketing-page surface area or shared shadcn primitives (intentionally broad path filter — see workflow). Revisit if average PR cycle time degrades >10%.
- First green run may surface real a11y issues on `/`, `/pricing`, `/about`. If so: those are real bugs caught by the gate working as intended, not a defect of this ADR's decision. Follow-up TD-* row captures the audit-id list to fix.
- `@lhci/cli` pin requires periodic refresh. Quarterly cadence; capture refresh in a `chore(deps):` PR with one-line diff.

**Rejected: path (a) — Vercel preview password-off.** Operationally fragile (UI-config knob), security-suspect (exposes pre-merge builds), and out of scope for code-only fixes.

**Rejected: path (c) — production post-deploy.** Post-hoc gating defeats the purpose of an a11y gate: catch regressions before merge, not after.

## Verification

The TD-87 implementation PR exercises a regression-detection proof:

1. Add a known a11y defect to `apps/web/app/(marketing)/about/page.tsx` (e.g. a `<button>` with no inner text and no `aria-label`).
2. Push; confirm the Lighthouse A11Y job fails with the expected audit id (`button-name`).
3. Confirm the per-URL results table marks `/about` as failed while `/` and `/pricing` remain passing.
4. Revert before merging.

If the real-defect injection proves flaky in practice, fall back to a threshold-bump scratch commit (temporarily set `SCORE_THRESHOLD` to 100, observe fail, revert) and document in the PR description.
