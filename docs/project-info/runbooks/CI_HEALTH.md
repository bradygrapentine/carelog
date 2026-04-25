# Carelog — CI Health Runbook

GitHub Actions health: billing, secrets, repo settings, and branch protection.
All items here require a human with repo-admin access to fix. Claude cannot touch GitHub settings.

For the third-party service setup (Supabase, Vercel, Stripe, etc.) see `THIRD_PARTY_SETUP.md`.

---

## Table of Contents

- [§1 GitHub Actions billing](#1-github-actions-billing) — the silent killer
- [§2 Allow auto-merge](#2-allow-auto-merge) — unattended agent prerequisite
- [§3 Branch protection on main](#3-branch-protection-on-main) — current state + recommendations
- [§4 Symptoms → fixes quick-ref](#4-symptoms--fixes-quick-reference)

---

## 1. GitHub Actions billing

**What:** GitHub bills for Actions compute minutes on private repos. A failed payment or spending limit block hard-stops every CI job instantly — no build artifacts, no test results, no error log beyond a single message.

**Why this matters:** We hit a 6-day CI outage because the symptom looks identical to "CI is broken" — every job shows red, every dev suspects code, and the real cause is in the billing dashboard, not the repo.

### Symptom (exact text you'll see in GitHub Actions)

```
This job was not started because recent account payments have failed
or your spending limit needs to be increased.
```

You'll see this on the job summary page. The individual step logs will be empty.

### Where to check

| Issue | URL |
|---|---|
| Payment method | https://github.com/settings/billing/payment_information |
| Spending limit | https://github.com/settings/billing/spending_limit |
| Usage breakdown | https://github.com/settings/billing/usage |

### How to fix

1. If payment failed: update the card at https://github.com/settings/billing/payment_information
2. If spending limit hit: increase it at https://github.com/settings/billing/spending_limit → Actions → set a higher monthly cap or "Unlimited" for a private repo you control
3. No job re-triggering needed — queued jobs resume automatically once billing is healthy

### How to verify

Push a trivial whitespace commit or re-run any failed job. All CI jobs should start within 30 seconds (you'll see the spinning yellow dot, then green/red, not the billing error).

### How to prevent

- Set a spending limit with a comfortable buffer (e.g. $20/mo) and an email alert at 80% of limit
- GitHub → Settings → Billing → Notifications → enable spending alerts

---

## 2. Allow auto-merge

**What:** Repository setting that enables `gh pr merge --auto --squash <number>`. When enabled, a PR queues to merge automatically the moment all required status checks pass and any required reviews are approved.

**Why critical:** Unattended agents (`/backlog-dispatch`) open PRs and queue auto-merge. When this setting is off, every PR requires a manual human merge — defeating the purpose of unattended runs.

**Current state (as of 2026-04-23):** OFF. The agent workaround is to merge manually or use `gh pr merge --admin`.

### Error you'll see when it's off

```
GraphQL: Auto merge is not allowed for this repository (enablePullRequestAutoMerge)
```

This appears when running `gh pr merge --auto --squash <number>`.

### Where to enable

GitHub → repository → Settings → General → scroll to "Pull Requests" section → check **"Allow auto-merge"**

### How to verify

```bash
gh pr merge --auto --squash <any-open-PR-number>
```

Should respond with something like:
```
✓ Pull request #NNN will be automatically merged via squash when all requirements are met.
```

Not an error.

---

## 2b. PHI review gate (`needs-phi-review` label + `phi-review` status check)

**What:** A GitHub Actions workflow (`.github/workflows/phi-review-gate.yml`, TD-31) that auto-applies the `needs-phi-review` label to any PR whose diff touches PHI-sensitive paths, and emits a commit status named `phi-review` that goes **pending** while the label is present and **success** once a human removes it.

**Why critical:** The `/review` adversarial security skill exists for PHI/RLS/auth changes, but agents can forget to run it. This gate makes the "did anyone review this for PHI leaks?" question impossible to skip — the PR cannot merge while `needs-phi-review` is on it (assuming `phi-review` is wired into branch protection — see post-merge step below).

### Path globs that trigger the label

Configured in `.github/labeler.yml`:
- `**/posthog*`
- `**/analytics*`
- `**/*[Rr]epository.ts`
- `**/auth/**`
- `apps/web/lib/supabase*`
- `supabase/migrations/**`
- `supabase/policies/**`

### How a developer / agent clears the label

1. Run the `/review` skill against the PR (adversarial scan for PHI leaks, RLS holes, auth bugs).
2. Post a brief comment on the PR with the findings — or "no findings" if clean.
3. Remove the label:
   ```bash
   gh pr edit <num> --remove-label needs-phi-review
   ```
4. The workflow re-fires on `unlabeled` and flips `phi-review` to `success` within ~10s.

### Required-check wiring (post-merge — manual)

The workflow ships first; branch protection update is a separate human step. After TD-31's PR merges, add `phi-review` to the required checks list:

GitHub → Settings → Branches → main → Required status checks → add `phi-review`.

Until that's done, the gate runs but doesn't block merge — it's advisory only.

### How to verify locally before pushing

```bash
# YAML parses?
npx --yes js-yaml .github/workflows/phi-review-gate.yml > /dev/null
npx --yes js-yaml .github/labeler.yml > /dev/null
```

The gate is real-world-tested by the very PR that adds it: opening it should trigger the label (it touches `.github/workflows/`, which is NOT in the glob list, so actually the seed PR will go green — that's the no-PHI-paths-touched path).

---

## 3. Branch protection on `main`

**What:** Rules governing who can push to `main` and what checks must pass before a PR merges.

**Current state (as of 2026-04-25):**
- 12 required status checks: `Lint`, `Typecheck`, `Web — unit tests`, `Mobile — unit tests`, `Mobile — Android debug build`, `E2E (Playwright)`, `RLS pgTAP tests`, `Dependency audit`, `OSV Scanner`, `Secret scan (Gitleaks)`, `Vuln scan (Trivy)`, `audit`
- `enforce_admins: true` — admins **cannot** bypass with `--admin`
- `dismiss_stale_reviews: true`, `require_code_owner_reviews: true`, but `required_approving_review_count: 0` (solo-dev)
- Force-push to `main` is blocked
- Stale review-required state means: every push invalidates prior approvals (defense against amend-then-merge)

The four security checks are emitted by `.github/workflows/security.yml` (PR #143). OSV / Trivy / pnpm-audit currently run **warn-only** (`continue-on-error: true`) so the gate registers but real findings don't block — see TD-21 in the backlog for triage.

**E2E runtime cost (TD-32):** The `E2E (Playwright)` job boots local Supabase + builds + serves the web app + runs Playwright. Historical job duration is ~10–15 minutes (longer runs got cancelled by concurrency, capping observed data). As of TD-32 it runs on every PR push and on push-to-main. Per-PR GH Actions cost: ~15 minutes of `ubuntu-latest` runtime. If this becomes a billing concern, follow-up options: path-filter to skip on docs-only PRs (see TD-30 pattern), or skip on draft PRs via `if: github.event.pull_request.draft == false`.

`gh pr merge --auto --squash` is the canonical path. Auto-merge IS disabled at the repo level (`enablePullRequestAutoMerge: false`); manual merge after CI passes is required.

### Where to configure

GitHub → repository → Settings → Branches → Branch protection rules → Edit rule for `main`

### Recommended phases

**Phase: pre-launch (current — 2026-04-25)**
Branch protection is hardened: 12 required checks (incl. 4 security scanners) + `enforce_admins: true`. Solo-dev keeps 0 required reviews so PRs don't stall.

**Phase: post-launch (first paying users)**
Add `required_approving_review_count: 1` for external contributors. Brady's own PRs can still merge with 0 reviews via CODEOWNERS solo-author exception (configure when needed).

**Phase: scanner-blocking (post-TD-21 triage)**
Once outstanding scanner findings (Next.js `<16.2.3` DoS, protobufjs `<7.5.5` RCE, xmldom CVEs) are resolved, flip `continue-on-error: false` on OSV / Trivy / pnpm-audit jobs in `security.yml` so they actually block.

### Emergency override (bypass protection)

```bash
gh pr merge --admin <PR-number>
```

This requires repo admin access. Use sparingly — bypassed PRs skip the protection rules entirely.

---

## 4. Symptoms → fixes quick reference

| Symptom | Likely cause | Fix |
|---|---|---|
| Every CI job shows "not started" with billing error | GitHub Actions billing failed or spending limit hit | §1 — update payment / increase spending limit |
| `gh pr merge --auto` returns `enablePullRequestAutoMerge` error | Auto-merge is disabled | §2 — enable in repo Settings → General |
| All CI jobs red, nothing changed in code | Could be billing (§1) or lock-file drift | Check billing first; if fine, look at the actual job logs for `pnpm install --frozen-lockfile` failures |
| `rls-tests` job fails locally but not in CI | Local Supabase version mismatch | `supabase update` locally; match the version in `supabase/setup-cli@v1` |
| Pre-commit hook fails with "Executable doesn't exist" | Playwright Chromium not installed locally | `cd apps/web && npx playwright install chromium` (see `THIRD_PARTY_SETUP.md` §14) |
| CI green but Sentry stack traces are minified | `SENTRY_AUTH_TOKEN` not set in Vercel | `THIRD_PARTY_SETUP.md` §2 + §7 |

---

*Last updated: 2026-04-23. Run `/backlog-sync` after any CI infrastructure changes to keep BACKLOG.md §0 accurate.*
