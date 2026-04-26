# E2E Failure Diagnosis — layered failures runbook

**Written 2026-04-26** after a multi-hour debug session that surfaced 6+ distinct issues, all hidden behind a single root cause for months. If E2E has been red for a long time and you're tempted to chase the visible symptom (a timeout, a missing element), STOP and read this first.

## The pattern

E2E failures often stack: layer N hides layer N+1. Until you remove layer N, you'll never see N+1, and you can spend weeks "fixing" symptoms of N+1 that never manifest while N is in the way.

The 2026-04-26 session is the canonical example. Six distinct issues, only one visible at a time:

| # | Layer | Class | Symptom | Root cause |
|---|---|---|---|---|
| 1 | CI infra | Path filter | E2E silently SKIPPED on every PR | `contains(toJSON(github.event.pull_request.changed_files), 'apps/web')` — `changed_files` is an integer, never matches |
| 2 | CI infra | Trace artifact | Cancelled runs lost traces; couldn't diagnose | `if: failure()` only — should also be `cancelled()` |
| 3 | Backend / infra | JWT verification | "JWT cryptographic operation failed" on every authed call; everything downstream timed out | Supabase CLI ≥ v2.71.1 signs legacy ANON/SERVICE_ROLE JWTs with a rotated asymmetric key the local PostgREST's static `JWT_SECRET` can't verify |
| 4 | UI / CSS | FAB collision | `.click()` on AIFab times out; `.toBeVisible()` passes | `AIFab` (`bottom-4 right-4 z-50`) sits inside `QuickLogFab`'s bounding box (`bottom-6 right-6 z-50`); same z-50, later DOM order wins → click lands on QuickLogFab |
| 5 | UI structural | Selector vs element | `button:has-text("View care journal")` matches nothing | Dashboard team card was refactored from `<button>` to clickable `<Card>`; 5 test files still query as button |
| 6 | Test brittleness | Class-substring selector | `[class*="mood"]` matches nothing | `MOOD_BADGE` map's actual classes are `bg-green-50 text-green-700 ...` (no "mood" substring) |

Layers 4, 5, 6 had existed for *months* but were invisible because layer 3 stopped onboarding from completing — tests never reached the assertion step.

## Diagnosis methodology (apply in this order)

### 1. Read the page snapshot, not the test code

Playwright writes `error-context.md` next to each failure in `test-results/`. It contains a YAML page snapshot at the moment of failure. **The actual error is almost always rendered in the DOM as a paragraph or status message.** TD-48 chased "timeout" for three iterations (TD-44/45/46) until the snapshot was finally read and showed `"Org creation failed: JWT cryptographic operation failed"` literally on the page.

```bash
mkdir -p /tmp/trace && gh run download <run-id> -n playwright-test-results -D /tmp/trace
cat /tmp/trace/*-retry1/error-context.md | head -50
```

### 2. Check artifact upload conditions FIRST

If you can't get the trace, you can't diagnose. The `if: failure()` clause skips upload on `cancelled()` runs — but cancelling a stuck E2E to save CI minutes is exactly when you most need the trace. Always upload on both:

```yaml
- uses: actions/upload-artifact@v4
  if: failure() || cancelled()
```

### 3. When peeling layers, expect MORE layers

If you've fixed one bug and the next CI run reveals a different test failing in a different file — that's not a regression, that's the next layer. Track them. The 2026-04-26 trajectory was 5 → 7 → ? tests passing across iterations.

### 4. Bump `maxFailures` to see all layers in one run

When iterating gets expensive, temporarily set `maxFailures: 999` (or remove it) in `playwright.config.ts` on the diagnostic PR. One CI run gives you the full failure list instead of N runs giving you N answers. Revert before merge.

### 5. Page snapshot beats speculation

Don't dispatch swarms of agents to guess at causes for failures whose causes are already in the snapshot. The serial loop (read snapshot → fix → push → wait 5 min) is faster than parallel speculation when you have ground truth.

Swarm-of-hypotheses is right for **non-deterministic** failures (timing flakes, hydration races) where ground truth is fuzzy.

## Hard-won fixes from the 2026-04-26 session

### TD-48: deterministic JWTs to bypass Supabase CLI key rotation

The CLI's `supabase status -o env` output emits four key fields: legacy `ANON_KEY`/`SERVICE_ROLE_KEY` (JWTs) and new opaque `PUBLISHABLE_KEY`/`SECRET_KEY`. **Neither works with PostgREST in CLI ≥ v2.71.1**: legacy keys are signed by a rotated asymmetric key the static JWT_SECRET can't verify; opaque keys aren't JWTs and PostgREST chokes parsing them ("Expected 3 parts in JWT; got 1"). PR #4721's "hybrid jwt verification" (in v2.84.x) does NOT fix it for the PostgREST verification path.

**Solution:** generate ANON and SERVICE_ROLE JWTs in CI ourselves with HS256 signed by the standard `JWT_SECRET`, and inject them via `$GITHUB_ENV` AFTER `supabase status -o env`. Later writes win. CLI version is no longer load-bearing.

```yaml
- name: Override Supabase keys with deterministic HS256 JWTs
  run: |
    node -e "
    const c = require('crypto');
    const s = 'super-secret-jwt-token-with-at-least-32-characters-long';
    const b = x => Buffer.from(x).toString('base64url');
    const sign = p => {
      const h = b(JSON.stringify({alg:'HS256',typ:'JWT'}));
      const y = b(JSON.stringify(p));
      const g = c.createHmac('sha256', s).update(h+'.'+y).digest('base64url');
      return h+'.'+y+'.'+g;
    };
    const iat = Math.floor(Date.now()/1000);
    const exp = iat + 60*60*24*365*5;
    console.log('ANON_KEY=' + sign({role:'anon', iss:'supabase-demo', iat, exp}));
    console.log('SERVICE_ROLE_KEY=' + sign({role:'service_role', iss:'supabase-demo', iat, exp}));
    " >> $GITHUB_ENV
```

### TD-50: FAB layering policy

Two `position: fixed` elements in the same corner with the same z-index → the later-rendered DOM element paints on top, AND wins click hit-testing. Playwright's `.toBeVisible()` doesn't hit-test, so visibility passes even when the element is fully obscured for clicks.

**Rule:** any new fixed-position interactive element must (a) not overlap other fixed elements' bounding boxes, OR (b) use a higher explicit z-index. Document the z-index ladder somewhere central.

### TD-51, TD-52: selector strategy

E2E selectors that depend on DOM shape (`button:has-text(...)`) or class substrings (`[class*="mood"]`) silently break when the implementation changes. **Use `data-testid` for every interactive E2E target.** Add a lint rule to prevent class-substring selectors in `e2e/`.

## Prevention checklist

After this session, the following changes would prevent the next 2026-04-26:

- [ ] **Mandate `data-testid` for every E2E interaction** — add `eslint-plugin-playwright` rules `no-element-handle` / `prefer-locator` and a custom `no-class-substring-selector` rule.
- [ ] **Document the z-index ladder** — central constants file (`apps/web/lib/zIndex.ts`) so FAB/modal/toaster layering is explicit.
- [ ] **Run E2E nightly against `main`** as an independent signal — drift detection that doesn't depend on PR cadence.
- [ ] **File upstream supabase/cli issue** — the asymmetric-key default broke `supabase status -o env`-derived keys, and #4721 doesn't actually fix it.
- [ ] **Path filter must use `dorny/paths-filter@v3`** — the inline `contains(toJSON(...))` form is broken (TD-30 wrote it; TD-35 fixed it).
- [ ] **Artifact upload always uses `failure() || cancelled()`** — never bare `failure()`.

## When to escalate vs iterate

Iterate locally when:
- Page snapshot makes the cause obvious (`element X not found`, `error message in DOM`)
- The next failure is the same family as the last one (selector drift, timing bump)
- You can fix it in <20 lines of diff

Escalate / pause and re-plan when:
- Failure is non-deterministic (passes locally, fails in CI half the time)
- The error is a generic "timeout" with no clue in the snapshot
- You've fixed 3+ layers in one PR and the diff is getting hard to review
- You don't understand WHY the fix should work

## See also

- `e2e/CLAUDE.md` — running E2E locally
- `.github/workflows/ci.yml` — CI configuration (look for the JWT-override step + path filter)
- `playwright.config.ts` — `maxFailures` knob lives here
- Supabase CLI PR #4688 (2026-01-07) — the asymmetric-signing default that broke us
- Supabase CLI PR #4721 (~2026-03-10) — the "hybrid verification" fix that didn't actually fix it
