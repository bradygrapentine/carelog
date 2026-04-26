# Upstream issue draft — supabase/cli asymmetric JWT rotation breaks `supabase status -o env`-derived keys against local PostgREST

**File at:** https://github.com/supabase/cli/issues/new
**Severity:** breaks local CI/dev integration tests for any project that uses the env-emitted ANON/SERVICE_ROLE keys against the local PostgREST.
**First broken release:** v2.71.1 (PR #4688, "fix: use asymmetric signing key by default", 2026-01-07)
**Confirmed broken on:** v2.71.0 (config.toml schema rejection — separate issue), v2.84.10 (despite #4721 "hybrid jwt verification")
**Workaround in our repo:** generate HS256 JWTs in CI ourselves and override via `$GITHUB_ENV`. See PR #187, the `Override Supabase keys with deterministic HS256 JWTs` step.

---

## Title

`supabase status -o env` ANON/SERVICE_ROLE keys fail PostgREST verification on local stack since v2.71.1

## Body

### Reproduction

```bash
# Any project with a default supabase config
supabase start
supabase status -o env > /tmp/keys.env
. /tmp/keys.env

# Try to use SERVICE_ROLE_KEY against local PostgREST
curl -sf "http://127.0.0.1:54321/rest/v1/<any-table>" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY"
```

Returns:
```json
{"message":"JWT cryptographic operation failed","code":"PGRST301"}
```

### What's happening

PR #4688 made the local CLI sign legacy ANON/SERVICE_ROLE JWTs with a rotated asymmetric signing key, but the local PostgREST container is still configured with the static `JWT_SECRET` (`super-secret-jwt-token-with-at-least-32-characters-long`). The signatures don't validate.

PR #4721's "hybrid jwt verification" was supposed to restore legacy-key acceptance — empirically it does not on `supabase status -o env`-derived keys against PostgREST in v2.84.x.

The new opaque `sb_publishable_*` / `sb_secret_*` keys aren't a drop-in either: PostgREST treats them as JWTs, fails to parse 3 dot-separated parts (the opaque keys have no dots), and returns:
```json
{"message":"Expected 3 parts in JWT; got 1","code":"PGRST301"}
```

### Impact

Any project that:
- Runs `supabase start` + `supabase status -o env` in CI
- Uses `SERVICE_ROLE_KEY` (or `ANON_KEY`) against the local PostgREST
- Has integration / e2e tests that depend on the result

…gets silent 401/400 failures on every authed call. In our case (Carelog), this manifested as onboarding form submissions returning `Org creation failed: JWT cryptographic operation failed` to users in the UI, with the form sitting hung until a 30s `waitForURL` timeout fired downstream — a cascade that took ~12 CI iterations to root-cause because the visible symptom was always "timeout".

### Workaround

Generate the legacy JWTs ourselves and inject them after `supabase status`. Reproducible, decoupled from CLI version forever:

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
    " >> \$GITHUB_ENV
```

### Suggested upstream fix

Either:
- (a) Make `supabase status -o env` emit JWTs that the same CLI's PostgREST can verify (i.e. share the signing key end-to-end), OR
- (b) Configure the local PostgREST to accept the new opaque `sb_publishable_*` / `sb_secret_*` keys directly (bypass JWT parse), OR
- (c) Document the breaking change clearly and provide a one-liner workaround in the CLI release notes.

### Carelog references

- Workaround commit: see `.github/workflows/ci.yml`, the "Override Supabase keys with deterministic HS256 JWTs" step in the `e2e` job.
- Investigation runbook: `docs/project-info/runbooks/E2E_FAILURE_DIAGNOSIS.md`
- PR: bradygrapentine/Carelog#187
