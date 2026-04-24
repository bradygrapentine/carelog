# Carelog — CI Health Runbook

GitHub Actions health: billing, secrets, repo settings, and branch protection.
All items here require a human with repo-admin access to fix. Claude cannot touch GitHub settings.

For the third-party service setup (Supabase, Vercel, Stripe, etc.) see `THIRD_PARTY_SETUP.md`.

---

## Table of Contents

- [§1 GitHub Actions billing](#1-github-actions-billing) — the silent killer
- [§2 ANTHROPIC_API_KEY secret](#2-anthropic_api_key-github-secret) — AI security review job
- [§3 Allow auto-merge](#3-allow-auto-merge) — overnight agent prerequisite
- [§4 Branch protection on main](#4-branch-protection-on-main) — current state + recommendations
- [§5 Symptoms → fixes quick-ref](#5-symptoms--fixes-quick-reference)

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

## 2. ANTHROPIC_API_KEY GitHub secret

**What:** Anthropic API key used by the `ai-review` CI job (`.github/workflows/ci.yml` lines 194–256). On every PR, the job diffs `*.ts`, `*.tsx`, and `*.sql` files and calls `scripts/ci-ai-review.mjs` to run a Claude security review, then posts the result as a PR comment.

**Why critical:** This is the primary automated PHI/RLS/auth review gate. If the secret is missing or the key is revoked, the job fails silently (the step is conditional on `steps.diff.outputs.lines != '0'`), and PRs merge without a security review.

### Where to set

GitHub → repository → Settings → Secrets and variables → Actions → Repository secrets → New repository secret

- **Name:** `ANTHROPIC_API_KEY`
- **Value:** starts with `sk-ant-api03-...` — get a fresh key from https://console.anthropic.com/settings/keys
- **Scope:** Repository secret (not environment secret) — the job runs on all PRs, not just specific environments

### How to verify

1. Open any PR (or create a test PR with a `.ts` change)
2. CI → `AI security review` job → should complete (not skip) and post a comment titled `## AI Security Review` on the PR

### Rate limits

If the key hits rate limits, the `node scripts/ci-ai-review.mjs` call will fail with a 429. The job will show as failed. Fix: use a key with a higher tier, or add retry logic to `scripts/ci-ai-review.mjs`.

---

## 3. Allow auto-merge

**What:** Repository setting that enables `gh pr merge --auto --squash <number>`. When enabled, a PR queues to merge automatically the moment all required status checks pass and any required reviews are approved.

**Why critical:** The overnight agent (`/overnight`, `/backlog-dispatch`) opens PRs and queues auto-merge. When this setting is off, every overnight PR requires a manual human merge in the morning — defeating the purpose of unattended overnight runs.

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

## 4. Branch protection on `main`

**What:** Rules governing who can push to `main` and what checks must pass before a PR merges.

**Current state (as of 2026-04-23):**
- No required status checks
- No required reviews
- `gh pr merge --admin` works without approvals
- Force-push to `main` is blocked (GitHub default)

This is intentionally permissive to support fast solo-dev iteration. It is NOT suitable for a team or post-launch production branch.

### Where to configure

GitHub → repository → Settings → Branches → Branch protection rules → Edit rule for `main`

### Recommended phases

**Phase: pre-launch (current)**
Keep as-is. Speed matters. CI is still unreliable (TD-14 lint errors).

**Phase: post-TD-14 (once CI is green)**
Add required status checks:
- `Typecheck`
- `Web — unit tests`
- `RLS pgTAP tests`

Leave reviews optional. Admin override remains available.

**Phase: post-launch (first paying users)**
Add required status checks (all 5 non-E2E jobs) + 1 required review for external contributors. Brady's own PRs can still self-approve if needed.

### Emergency override (bypass protection)

```bash
gh pr merge --admin <PR-number>
```

This requires repo admin access. Use sparingly — bypassed PRs skip the protection rules entirely.

---

## 5. Symptoms → fixes quick reference

| Symptom | Likely cause | Fix |
|---|---|---|
| Every CI job shows "not started" with billing error | GitHub Actions billing failed or spending limit hit | §1 — update payment / increase spending limit |
| `ai-review` job fails or is always skipped | `ANTHROPIC_API_KEY` secret missing or revoked | §2 — set/rotate the secret |
| `gh pr merge --auto` returns `enablePullRequestAutoMerge` error | Auto-merge is disabled | §3 — enable in repo Settings → General |
| All CI jobs red, nothing changed in code | Could be billing (§1) or lock-file drift | Check billing first; if fine, look at the actual job logs for `pnpm install --frozen-lockfile` failures |
| `rls-tests` job fails locally but not in CI | Local Supabase version mismatch | `supabase update` locally; match the version in `supabase/setup-cli@v1` |
| Pre-commit hook fails with "Executable doesn't exist" | Playwright Chromium not installed locally | `cd apps/web && npx playwright install chromium` (see `THIRD_PARTY_SETUP.md` §14) |
| CI green but Sentry stack traces are minified | `SENTRY_AUTH_TOKEN` not set in Vercel | `THIRD_PARTY_SETUP.md` §2 + §7 |

---

*Last updated: 2026-04-23. Run `/backlog-sync` after any CI infrastructure changes to keep BACKLOG.md §0 accurate.*
