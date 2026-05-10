# Post-Wave-9 execution plan

> **⚠ Deprecated merge-policy mention:** This document was written when the repo used Mergify and a `queue` label. As of 2026-05-10, Mergify is no longer in use; the canonical merge flow is `gh pr merge --auto --squash` via GitHub native auto-merge. References to Mergify / `--add-label queue` below are kept as historical record. See `.claude/CLAUDE.md` §Merge Policy.


Session date: 2026-05-09 PM. Covers the 10 still-open rows added in PR #381 (TD-107 already ✅ shipped). Three sequenced waves; each can ship independently.

## Backlog inventory

| Row | Surface | Schema? | Est | Owner |
|---|---|---|---|---|
| TD-108 | Auth — `(app)/layout.tsx` | no | 1.5 hr | Opus |
| TD-109 | Auth — `/signin` | no | 0.5 hr | direct |
| TD-110 | Brief — `PatternsStrip` | no | 3 hr | Opus |
| UX-107 | Auth — sign-in/onboarding brand voice | no | 3 hr | Opus + design |
| UX-108 | Auth — nav-back-to-landing | no | 1 hr | direct |
| SEO-001 | Marketing — title/desc rewrite | no | 3 hr | direct |
| SEO-002 | Marketing — FAQPage JSON-LD | no | 3 hr | direct |
| SEO-003 | Marketing — HowTo JSON-LD | no | 2 hr | direct |
| SEO-004 | Marketing — h1 + internal linking | no | 2 hr | direct |
| SEO-005 | Marketing — CWV tightening | no | 3 hr | Opus |
| SEO-006 | Marketing — MDX cornerstone content | no | 8 hr | Opus + content |
| SEO-007 | Marketing — Search Console verify | no | 0.5 hr | 🧑 human |

Total active: ~30 hr. Across 3 waves.

## Pre-flight (run before each wave)

```sh
git fetch origin main && git log --oneline origin/main..HEAD   # expect empty
gh pr list --state open --limit 10
git worktree list                                              # expect just main
```

If chore(backlog) sync PR #380 still hasn't merged, manual-merge it first or rebase against its diff. Each wave starts off `main`.

---

## Wave 10 — Auth flow hardening (sign-in surface)

Four rows, all on the auth surface. Two quick-fix PRs + one design-aware PR. Total ~6 hr; single session feasible.

### Step 1 — TD-109: `/signin` redirect when authed (~30 min, direct)

PR title: `feat(td-109): /signin redirects authenticated users to /dashboard`.

Single-file PR touching `apps/web/app/signin/page.tsx`. Server-side `getUser()` → `if (user) redirect("/dashboard")` before returning JSX.

Test: extend `app/signin/__tests__/SignInForm.flow.test.tsx` (or add `SignInPage.flow.test.tsx`) — assert that a `redirect()` is called when a session-cookie-bearing request hits the page. Use the same supabase-cookie mock pattern as `lib/__tests__/proxy.test.ts`.

Verify: `npx vitest run app/signin && npx tsc --noEmit && npx eslint --quiet 'app/signin/page.tsx'`.

### Step 2 — TD-108: multi-org `.single()` fix (~1.5 hr, Opus direct)

PR title: `feat(td-108): app shell picks primary org for multi-org caregivers`.

**Decision needed first** — how to pick the "primary" org for a caregiver in 2+ orgs:

| Option | Pros | Cons |
|---|---|---|
| Earliest `accepted_at` | Stable per-user | Stale once they shift focus |
| Most recently active (last `care_event` actor / last login) | Reflects current focus | Adds query cost; needs a tiebreaker |
| User-controlled "default org" pref column | Honest | New schema row + UI to set it |

**Recommendation**: ship "earliest `accepted_at`" first (no schema, no UI), then layer user-controlled override (UX-***) if anyone complains. Pick during Step 0.

Implementation:
```ts
// app/(app)/layout.tsx
const { data: memberships } = await supabase
  .from("memberships")
  .select("org_id")
  .eq("user_id", user.id)
  .not("accepted_at", "is", null)
  .order("accepted_at", { ascending: true })
  .limit(1);
const orgId = memberships?.[0]?.org_id ?? null;
```

Test: extend `(app)/__tests__/layout.test.tsx` (create if missing) with a 2-membership fixture and assert `orgId` resolves to the older row.

Then write the regression test FIRST (red), then the fix (green).

### Step 3 — UX-107 + UX-108: brand-voice convergence + nav-back (~3 hr, Opus + design)

PR title: `feat(ux-107-108): converge sign-in + onboarding chrome with marketing brand`.

Bundle UX-107 and UX-108 because they both touch `/signin` chrome — two PRs would conflict on rebase.

Steps:
1. **Audit current state**: screenshot `/`, `/signin`, `/onboarding` side-by-side. Identify mismatches: logo (placeholder square vs marketing CareSync mark), h1 typography (`text-xl font-bold` vs `headline-display`), surface color, footer presence.
2. **Pull a `MarketingNavSlim` variant** from `MarketingNav.tsx`: brand-mark only (no nav links, no sign-in CTA), left-aligned. Mount on `/signin/page.tsx` and `/onboarding/page.tsx`.
3. **Migrate page h1 to `headline-display`**: "Sign in to <em>CareSync</em>" with the Fraunces-italic-em pattern. Preserves form focus while connecting to the editorial voice.
4. **Drop the placeholder colored square logo** (`signin/page.tsx:17-20`) — `MarketingNavSlim` ships the proper mark.
5. **Trust tagline** stays — already on-voice ("Private, secure, and ad-free…").
6. Snapshot + screenshot tests via `live-test` skill — visual diff before/after.

Out of scope: full marketing-aesthetic match (gradient backgrounds, Fraunces body etc.) — just the brand-mark + h1 alignment.

### Step 4 — Wave 10 close-out (~10 min)

`/backlog-sync` → flip TD-108/109 + UX-107/108 to ✅. Update §0 Ready count.

---

## Wave 11 — Brief surface depth (TD-110)

One row, schema-free. ~3 hr.

### Step 1 — TD-110: `PatternsStrip` real aggregation (~3 hr, Opus direct)

PR title: `feat(td-110): wire PatternsStrip to real care_events via detectPattern aggregation`.

Touches:
- `apps/web/lib/detectPattern.ts` — extend to return `Pattern[]` (currently returns first match only). Sort by severity / recency.
- `apps/web/server/routers/briefs.ts` — new `briefs.patterns({ recipientId, limit? })` procedure (or extend `dashboardSummary` if cache-friendly).
- `apps/web/components/journal/PatternsStrip.tsx` — drop the 3 hardcoded mock patterns; subscribe to the new query; render only when `data.length > 0`.
- Unit tests: extend `lib/__tests__/detectPattern.test.ts` with multi-pattern fixtures asserting ordering. tRPC test for the new procedure.

PHI: pattern detail strings ("3 missed Aricept this week", "sleep dipped 2h Tue–Wed") are caregiver-facing summaries derived from PHI but not direct PHI quotes — still no posthog.capture of the strings.

### Step 2 — Wave 11 close-out

`/backlog-sync`. Single-PR wave; nothing else.

---

## Wave 12 — SEO push (SEO-001 through SEO-007)

Six Ready rows + one human-gated. Most are independent and parallelizable. Total ~22 hr active work. Recommend splitting across two sessions:

### Session A — schema markup + meta + h1 (SEO-001..004) (~10 hr)

These four are `apps/web/app/(marketing)/*` only — no shared state with the rest of the app. **Dispatch as 4 parallel Sonnet `/tdd-ship` subagents off main**:

| Subagent | Files |
|---|---|
| SEO-001 (per-page meta) | every `(marketing)/<route>/page.tsx`'s `metadata` export |
| SEO-002 (FAQPage JSON-LD) | `(marketing)/page.tsx`, `(marketing)/pricing/page.tsx`, `(marketing)/about/page.tsx` |
| SEO-003 (HowTo JSON-LD) | `(marketing)/about/page.tsx` only (the standalone `/carezone-alternative` page no longer exists — consolidated into `/about` via PRs #316/#317; HowTo deferred until `/about` has explicit step-by-step content) |
| SEO-004 (h1 + internal links) | every `(marketing)` page + `MarketingNav.tsx`, `MarketingFooter.tsx` |

**File-overlap warning**: SEO-001 and SEO-002/003 both touch `page.tsx` files. Merge order: 001 first (touches `metadata` exports), then 002/003 in parallel (touch `<script type="application/ld+json">` blocks alongside, no conflict), then 004 last (rebases on top, may need light h1 alignment).

Hard pre-flight: confirm Search Console / OG previews aren't broken by re-rendering. Run `lighthouse-a11y` against the preview deploys before merge.

### Session B — performance + content (SEO-005, SEO-006) (~12 hr)

#### SEO-005 — CWV tightening (~3 hr, Opus direct)

PR title: `perf(seo-005): tighten Core Web Vitals on /, /pricing, /about`.

1. Run Chrome DevTools perf trace + Lighthouse on each page; capture LCP / CLS / INP baseline.
2. Defer below-fold images via `next/image` `loading="lazy"`.
3. Inline above-fold critical CSS only if the audit shows render-blocking sheets.
4. Audit `next/font` config — ensure `display: "swap"` and pre-loaded subset.
5. Capture post-fix metrics; compare against baseline; document in `docs/project-info/runbooks/PERF.md` (create if missing).

Verify against the `perf-regression-gate` skill before merge.

#### SEO-006 — MDX cornerstone content engine (~8 hr, Opus direct, two PRs)

PR title for infra half: `feat(seo-006a): MDX content engine at /learn/*`.
PR title for content half: `content(seo-006b): three cornerstone caregiver articles at /learn/*`.

**Infra (PR-A, ~2 hr)**:
- `apps/web/app/(marketing)/learn/[slug]/page.tsx` — server component, MDX from `apps/web/content/learn/<slug>.mdx`.
- `apps/web/app/(marketing)/learn/page.tsx` — index page listing articles.
- Add MDX bundling per Next.js 16 docs (`@next/mdx` or `next-mdx-remote`).
- Per-article frontmatter: `title`, `description`, `published_at`, `topic`. Auto-generates `metadata` export, `Article` JSON-LD, sitemap entry.
- Link from `MarketingNav` (new "Learn" nav item).

**Content (PR-B, ~6 hr)**:
- `apps/web/content/learn/managing-medications-care-team.mdx`
- `apps/web/content/learn/shift-handoff-notes.mdx`
- `apps/web/content/learn/parents-care-grows-beyond-one-person.mdx`

Each article: 800–1500 words, internally linked, on-brand voice, ends with a CTA back to `/pricing` or `/signup`. Copy-pass before merge — no dispatch (single creative voice matters here).

### Session C — Search Console verify (~30 min, 🧑 human)

SEO-007. User puts the meta verification tag in `(marketing)/layout.tsx` (or proxy DNS TXT), then submits the sitemap. Track index coverage weekly for 4 weeks.

---

## Dependencies + parallelism summary

```
Wave 10 (auth)  ──┬── Step 1: TD-109 (30 min)
                  ├── Step 2: TD-108 (1.5 hr) — parallel with 1
                  └── Step 3: UX-107 + UX-108 (3 hr) — serial after 1+2

Wave 11 (brief) ──── Step 1: TD-110 (3 hr) — independent of 10

Wave 12 (SEO):
  Session A ────┬── SEO-001 ──┐
                ├── SEO-002 ──┼── parallel via /dispatch
                ├── SEO-003 ──┤
                └── SEO-004 ──┘  (merge order: 001 → 002/003 → 004)

  Session B ──┬── SEO-005 (perf) — independent
              └── SEO-006 (content) — A then B, sequential
```

Wave 10, 11, 12 are independent of each other. Recommended execution order: **Wave 10 first** (auth flow user-visible bug fixes), **Wave 11 next** (closes a stale Wave-8 placeholder), **Wave 12 last** (post-launch growth, can defer until LAUNCH-005 closes).

## Hard constraints

- **No new schema** in any of these rows. If a fix tempts a migration (e.g., adding `users.default_org_id`), pause and file a separate row.
- **No PHI in analytics**: TD-110 (PatternsStrip detail strings) and SEO content (cornerstone articles must not embed user data) — same rule as everywhere else.
- **Branch protection's required-checks list**: Lint / Typecheck / Web tests / Dependency audit / OSV / Trivy / Gitleaks / Mobile / RLS pgTAP. None of these waves change the schema, so RLS pgTAP stays "skipping" by path filter — the gate is the unit + integration tests.
- **Pre-queue green-check protocol** before every `--add-label queue`: `gh pr view <num> --json mergeable,mergeStateStatus` + `gh pr checks <num> | grep fail`.

## Out of scope

- **Wave 10 (UX-103/104/105 — Profile data)** from the original plan. Kept on deck but not tackled here; restart that wave after this session if the user re-prioritizes.
- **TD-78..82, TD-87** server-test sweep. Still Ready, still relevant, still its own `/dispatch --from-backlog` once we accept a stable surface.
- **UX-077, UX-106** (route-default and shell-default decisions). Both human-gated.
- **A wider sign-in styling pass** beyond UX-107/108 (gradient backgrounds, full marketing aesthetic). Open as UX-109 if the design pass during Wave 10 Step 3 surfaces more.

## Risk + mitigation

| Risk | Mitigation |
|---|---|
| TD-108 "earliest accepted_at" picks the wrong primary org for users who joined a second family later but use it more | Ship the simple version, watch for support tickets, layer user-pref column if 2+ complaints |
| UX-107/108 design pass requires a screenshot review the user hasn't approved yet | Insert an `AskUserQuestion` confirm step before Wave 10 Step 3 dispatch — show before/after wireframe |
| SEO-006 content writing absorbs a session if dispatched | Keep it Opus-direct; do not delegate creative voice |
| Lighthouse regression after Wave 12 changes | Use `perf-regression-gate` skill on the PR before merge |
| Mergify queue stalls (seen with #380) | If an auto-merge sits >15 min, manual `gh pr merge --squash` is fine for chore + doc PRs; for feature PRs investigate `.github/` config first |

## Estimated session cadence

- **Session 1** (this list): Wave 10 fully — TD-109 + TD-108 + UX-107/108. ~5 hr.
- **Session 2**: Wave 11 (TD-110). ~3 hr.
- **Session 3**: Wave 12 Session A — SEO meta/JSON-LD/h1 dispatch. ~2 hr orchestrator + 4× parallel subagent.
- **Session 4**: Wave 12 Session B — SEO-005 + SEO-006a + SEO-006b. ~6 hr.
- **Human task**: SEO-007 — owner runs at any point after Session 3 lands.
