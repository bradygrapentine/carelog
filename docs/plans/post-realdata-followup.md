# Post real-data follow-up — Wave C + Wave D

Two parallelizable waves chosen from `BACKLOG.md` §1 Ready rows + the 2026-04-27
landing-page launch feedback. Zero file overlap between waves; both can run in
independent sessions.

Base SHA at planning time: `bf308112` (post-#246 dashboard real-data round).

In-flight PRs that gate **nothing in this plan** — Wave A (#251) is independent;
Wave B PRs (#248/249/250 covering TD-78/79/80) live in adjacent test paths and
do not touch any file either wave below modifies. Both Wave C and Wave D may
launch immediately.

---

## Wave C — Tier 2 server test coverage + UX-035 gate

**Goal:** Close the Tier 2 / RLS test gaps (TD-81, TD-82) that the Wave B Tier 1
batch left behind, gate the BriefHero hardcoded mock content (UX-035) so prod
never ships fake "Eleanor" copy, and re-run the Codex adversarial audit
(TD-84) that Wave 5 dropped silently.

### Pre-flight (run in session before any code)

1. `git fetch origin && git log origin/main --oneline -10` — confirm latest main.
2. Verify Wave B PRs **#248 (TD-78), #249 (TD-79), #250 (TD-80)** have either
   merged or are still in queue. None of them touch the files Wave C owns —
   safe to launch regardless.
3. Confirm Wave A PR **#251** state. Independent, no rebase needed.
4. Print the base SHA each subagent will branch from. All four subagents share
   `origin/main`.
5. Worktree layout (under `.worktrees/`, never sibling), one per task:
   - `.worktrees/td-81-orgs-repo-tests` → branch `feat/td-81-orgs-repo-tests`
   - `.worktrees/td-82-care-events-client-id-rls` → branch `feat/td-82-care-events-client-id-rls`
   - `.worktrees/ux-035-briefhero-gate` → branch `feat/ux-035-briefhero-gate`
   - `.worktrees/td-84-codex-rerun` → branch `chore/td-84-codex-rerun`
6. Symlink `node_modules` per CLAUDE.md (root + apps/web) into each worktree.

### C1 — TD-81 · `organizationsRepository.test.ts`

**Backlog row:** "Tier 2 — team isolation. Cross-org query (`org_id` unfiltered)
could be silent in CI if test fixtures don't span orgs."

- **New file (only):** `apps/web/server/repositories/__tests__/organizationsRepository.test.ts`
- Tests: (a) cross-org fixtures — listing orgs for user A returns A's orgs only,
  not B's; (b) `org_id` UUID assignment on create; (c) any unfiltered SELECT
  surface returns scoped data.
- **Owner:** Sonnet via Task tool (judgment-heavy — cross-org boundary).
- **Estimate:** ~1.5 hr.

### C2 — TD-82 · `care_events_client_id` RLS test

**Backlog row:** "Migration `20260416000001_care_events_client_id.sql` has no
dedicated test. Either add a minimal `supabase/tests/care_events_client_id.test.sql`
or document why it's covered by the existing `care_events_rls.test.sql`."

- **New file (only):** `supabase/tests/care_events_client_id.test.sql`
- Tests: (a) `client_id` NOT NULL constraint enforced; (b) per-client RLS
  isolation if the migration introduces one; (c) backfill default sane.
- Use `/schema-dump` first to confirm the actual column shape before writing
  SQL — do NOT invent columns.
- **Owner:** Sonnet via Task tool (pgTAP — schema-aware).
- **Estimate:** ~0.5 hr.

### C3 — UX-035 · Gate `BriefHero` mock content

**Backlog row:** "`BriefHero.tsx:1-4` still has hardcoded mock data + `TODO(UX-24+)`
comment. Gate behind feature flag or skeleton until UX-24 real aggregation ships."

- **Note:** post-#244 BriefHero is **already** wired to the real
  `briefs.latestForRecipient` query — the "mock" content is now only the
  `BriefHeroEmpty` and `BriefHeroSkeleton` fallbacks. Re-read the file before
  editing; the actual UX-035 work may now reduce to:
  1. Verify `BriefHeroEmpty` renders neutral placeholder copy (not "Eleanor").
  2. Remove the stale `TODO(UX-24+)` comment if the wiring is complete.
  3. If any "Eleanor"/mock string remains in the data path (post-empty-state),
     replace with neutral skeleton or feature-flag behind
     `process.env.NEXT_PUBLIC_BRIEFHERO_MOCK === "true"`.
- **Files allowed:** `apps/web/components/dashboard/BriefHero.tsx` and
  `apps/web/components/dashboard/__tests__/BriefHero.test.tsx` only.
- **Owner:** Haiku via Task tool (small, single-component).
- **Estimate:** ~0.5 hr.

### C4 — TD-84 · Re-run Codex adversarial audit

**Backlog row:** "Wave 5 dispatch produced no output file (sandbox couldn't
write `/tmp/wave5-codex-audit.md`). Re-dispatch via `/codex:rescue` with same
prompt before LAUNCH-001 fires; route output to `.codex-runs/`. Synthesize new
TD-* batch from results."

- **Files allowed:** `.codex-runs/td-84-rerun-summary.json` (new), and a
  follow-up `chore(backlog)` PR scaffold (do NOT bundle the new TD rows into
  this PR — open a separate BACKLOG-only PR per CLAUDE.md).
- Scope: `apps/web/server`, `supabase/migrations`, `apps/web/inngest`.
- **Owner:** orchestration-only — invoke `/codex:rescue` and capture output.
- **Estimate:** ~0.5 hr (orchestration; new TD rows become a follow-up PR).

### Wave C — Subagent scope contract template

```
FILES ALLOWED: <single file from C1/C2/C3 OR .codex-runs/ output for C4>
BRANCH: <feat/td-81-... | feat/td-82-... | feat/ux-035-... | chore/td-84-...>
DO NOT: edit production code outside the listed file (UX-035 may touch
        BriefHero.tsx + its test; everything else is test-only or doc-only),
        modify BACKLOG.md, touch any sibling subagent's file
PHI RULE: posthog.identify() / posthog.capture() must use UUID only
VERIFY:
  - C1/UX-035: cd apps/web && npx vitest run <file> --reporter=dot
  - C2: supabase test db (pgTAP)
  - C3 (UX-035): also cd apps/web && npx tsc --noEmit
  - C4: confirm .codex-runs/td-84-rerun-*.json non-empty
HEARTBEAT: append timestamp every ~5min to .claude/agent-status/<id>.log
```

### Wave C — execution mode

- **`/dispatch`** in ad-hoc mode (4 explicit tasks, not `--from-backlog`).
- C1, C2, C3 use `/tdd-ship` discipline — failing tests first, then minimal
  passing impl. If a test surfaces a real bug, STOP and escalate; do not
  bundle the prod fix into a test PR.
- C4 is orchestration only; no `/tdd-ship`.
- Per PR: local green → `gh pr create` → `gh pr edit <num> --add-label queue` →
  15-min wakeup.

### Wave C — risks

- **TD-81 may reveal a real cross-org leak** in `organizationsRepository`. If
  the failing test reveals a production bug, STOP; open a separate fix PR.
- **C3 wording drift.** Re-read `BriefHero.tsx` first; the row description may
  be stale post-#244. The right move is a small clean-up, not a full rewrite.
- **TD-84 sandbox flake.** If Codex still can't write to `.codex-runs/`,
  diagnose the sandbox path before retrying — Wave 5 lost an entire run to
  silently swallowed output.

---

## Wave D — Landing-page launch hardening + observability runbook

**Goal:** Triage the four still-actionable items from the 2026-04-27 landing-page
feedback (low-contrast text on Pricing, contact form input contrast, contact
form delivery missing, prod Supabase auth `NetworkError`) and ship the
LAUNCH-004 observability runbook so the launch isn't gated on undocumented
ops knowledge.

### Pre-flight (run in session before any code)

1. `git fetch origin && git log origin/main --oneline -10` — confirm main.
2. Confirm none of the post-#235 marketing PRs are still open and racing the
   files D1 will touch: `gh pr list --search "marketing OR pricing" --state open`.
3. Print base SHA. Branch from `origin/main`.
4. Worktree layout:
   - `.worktrees/launch-pricing-contrast` → `feat/launch-pricing-contrast`
   - `.worktrees/launch-contact-delivery` → `feat/launch-contact-delivery`
   - `.worktrees/launch-supabase-auth-debug` → `chore/launch-supabase-auth-debug`
   - `.worktrees/launch-004-runbook` → `docs/launch-004-runbook`
5. Symlink `node_modules`.

### D1 — Pricing page + contact-form contrast sweep

**Symptom (from feedback):** "Pricing page has light text on white" and "contact
form inputs have illegible text contrast."

- **Files allowed:**
  - `apps/web/app/(marketing)/pricing/page.tsx` (or whatever `/pricing` resolves
    to — check before touching)
  - The contact form page/component(s) (`/contact` route + form component)
  - `apps/web/app/globals.css` ONLY if a missing contrast token has to be added
    (token addition, not raw hex)
- Audit pattern: open each touched page, identify any text where
  `var(--color-muted)` or `var(--color-text-secondary)` lands on white/`bg-card`
  with contrast < 4.5:1. Replace with `var(--color-text-primary)` or a darker
  token. Same for input borders / placeholders that fall under 3:1.
- Visual evidence: capture before/after screenshots via `/live-test` or
  chrome-devtools-mcp; attach to PR description.
- **Owner:** Sonnet via Task tool — judgment on which token to swap to.
- **Estimate:** ~1 hr.

### D2 — Contact form delivery investigation

**Symptom (from feedback):** "Submitted contact form, no confirmation email
ever arrived."

- **Investigation, then fix:**
  1. Locate the form's POST target. `grep -rn "/api/contact\|contactForm" apps/web`.
  2. Check whether the route actually fires Resend (or whatever provider) and
     logs the send. If the route is `console.log("contact submitted")`-only,
     that's the bug.
  3. Add audit-log row + Sentry breadcrumb on the API route. Add a vitest unit
     test that the route returns 200 + calls the provider mock.
- **Files allowed:** the contact API route file (TBD — discover in step 1) and
  its `__tests__/`. Do NOT touch unrelated marketing pages.
- **PHI:** the contact form handles PII (name, email, message). Keep PostHog
  events UUID-only — never capture the message body or email.
- **Owner:** Sonnet via Task tool — investigation + fix.
- **Estimate:** ~2 hr.

### D3 — Production Supabase auth `NetworkError` debug runbook

**Symptom (from feedback):** prod sign-in fails with `NetworkError` against
`ngtkrguzpqkmnzrwjhyg.supabase.co`. Local works.

- **This is investigation + a runbook, not a code fix in this PR.** Code fix
  may need env var rotation in Vercel which is human-gated.
- **New file (only):** `docs/project-info/runbooks/SUPABASE_AUTH_NETWORKERROR.md`
- Document:
  1. How to verify `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     in Vercel match the active Supabase project.
  2. How to check Supabase project status / paused-due-to-inactivity.
  3. How to read the failing fetch in browser devtools (CORS vs DNS vs 401).
  4. The fix matrix: env-var-mismatch → rotate; project-paused → resume;
     CORS → add origin in Supabase dashboard.
- **Files allowed:** the new runbook only. No code.
- **Owner:** Opus (this session OR Haiku) — pure documentation.
- **Estimate:** ~0.5 hr.

### D4 — LAUNCH-004 observability runbook

**Backlog row:** "Wire Sentry source maps (depends on TD-03 env var), add prod
rate-limit dashboard (TD-73), add weekly digest monitoring (TD-74), add E2E
green-streak gate (TD-75). Observability checklist doc in
`docs/project-info/runbooks/`."

- TD-73/74/75 already shipped (per backlog); the doc is the missing piece.
- **New file (only):** `docs/project-info/runbooks/OBSERVABILITY.md`
- Sections: Sentry (source maps + alert routing), rate-limit dashboard
  (Vercel + Inngest), weekly digest delivery monitor, E2E green-streak gate,
  on-call rotation links, runbook for "what to do when an alert fires."
- Cross-link `SUPABASE_AUTH_NETWORKERROR.md` from D3 in the "auth issues"
  section.
- **Files allowed:** the new runbook + (optionally) a one-line `docs/README.md`
  index entry.
- **Owner:** Haiku via Task tool — doc-only.
- **Estimate:** ~1 hr.

### Wave D — Subagent scope contract template

```
FILES ALLOWED: <list from D1/D2/D3/D4 above>
BRANCH: <feat/launch-... | chore/launch-... | docs/launch-...>
DO NOT: edit unrelated marketing pages, modify BACKLOG.md, change globals.css
        beyond a token addition (D1), capture PII/email bodies in PostHog (D2),
        bundle code changes into D3/D4 (those are doc-only)
PHI RULE: posthog.identify() / posthog.capture() must use UUID only — never
          email, name, message body
VERIFY:
  - D1: cd apps/web && npx vitest run --reporter=dot &&
        cd apps/web && npx tsc --noEmit + screenshot evidence
  - D2: cd apps/web && npx vitest run apps/web/app/api/contact/__tests__/...
  - D3/D4: prose review only — render the markdown locally and confirm links
HEARTBEAT: append timestamp every ~5min to .claude/agent-status/<id>.log
```

### Wave D — execution mode

- **`/dispatch`** in ad-hoc mode (4 explicit tasks).
- D1 + D2 use `/tdd-ship` (real code change). D3 + D4 are docs — plain
  implementation, no TDD.
- Per PR: local green → `gh pr create` → `gh pr edit <num> --add-label queue` →
  15-min wakeup. Doc-only PRs still go through queue.

### Wave D — risks

- **D2 may surface a config bug requiring a Vercel env var.** If the contact
  route is wired but the provider key is missing in prod, the fix is human-gated;
  the PR captures the diagnostic + tests, and the env-var rotation goes into a
  `🧑 Needs human` row.
- **D3's runbook may turn into a code fix mid-investigation.** Resist scope
  creep — open a separate `fix/supabase-auth-prod` PR if a code change is
  warranted; this wave's PR stays doc-only.
- **D4 cross-link to D3.** D4 references a runbook file D3 creates. Merge D3
  before D4, or stage D4's link with a note that the file lands in the sibling
  PR.

---

## Cross-wave invariants

- **No `BACKLOG.md` edits in feature/doc PRs.** TD-81 / TD-82 / UX-035 / TD-84
  status flips happen via `/backlog-sync` or dedicated `chore(backlog)` PRs.
- **Independent base SHAs.** Both waves branch off current `origin/main`.
- **No file overlap.** Wave C touches `apps/web/server/` (tests),
  `supabase/tests/`, `apps/web/components/dashboard/BriefHero.tsx`, and
  `.codex-runs/`. Wave D touches `apps/web/app/(marketing)/`, the contact
  form's API route, and `docs/project-info/runbooks/`. Disjoint.
- **Mergify queue label by default** on every PR; 15-min wakeup per CLAUDE.md.
- **Local green gates `gh pr ready`** in both waves.

## Suggested running order

- **Wave C** can launch immediately. The four parts are file-disjoint and have
  no cross-dependency. Run them in parallel via `/dispatch`.
- **Wave D** can also launch immediately and runs disjoint from Wave C.
  Internal ordering preference: **D1 + D2 in parallel** (different surfaces);
  **D3 first, then D4** (D4 cross-links D3) — but if you don't mind a small
  forward-reference comment in D4, run all four in parallel.
