/**
 * TD-118 — defense-in-depth validation of SUPABASE_SERVICE_ROLE_KEY shape.
 *
 * Background: dropping a production-style `sb_secret_*` key into a local dev
 * env causes `supabaseAdmin` to silently fall back to anon. The first server
 * write then 500s with a row-level-security error that points at RLS instead
 * of the actual cause (env config). This validator parses the JWT payload
 * and asserts the role claim is `service_role` — no signature check, just a
 * structural sanity check.
 */

type DecodedJwt = { role?: unknown };

function decodeJwtPayload(token: string): DecodedJwt {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("not a JWT (expected 3 dot-separated segments)");
  }
  const json = Buffer.from(parts[1], "base64url").toString("utf8");
  return JSON.parse(json) as DecodedJwt;
}

export type ValidationOutcome = { ok: true } | { ok: false; reason: string };

export function checkServiceRoleKey(
  rawKey: string | undefined,
): ValidationOutcome {
  if (!rawKey) {
    return { ok: false, reason: "SUPABASE_SERVICE_ROLE_KEY env var is unset" };
  }
  let decoded: DecodedJwt;
  try {
    decoded = decodeJwtPayload(rawKey);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      reason: `SUPABASE_SERVICE_ROLE_KEY is not a JWT (${detail}). Expected a Supabase JWT with role=service_role; do NOT use sb_secret_* production-style keys here.`,
    };
  }
  if (decoded.role !== "service_role") {
    return {
      ok: false,
      reason: `SUPABASE_SERVICE_ROLE_KEY decodes successfully but role claim is "${String(decoded.role)}", not "service_role". This key will silently fall back to anon and every admin write will fail RLS.`,
    };
  }
  return { ok: true };
}

/**
 * Side-effecting wrapper for use in server boot / first-use paths.
 *
 * - test env → noop (don't break vitest).
 * - dev env → log CRITICAL and throw (fail loudly during local dev).
 * - Vercel preview → log CRITICAL only (don't 500 the build on env typos).
 * - production → log CRITICAL only (let wrapped RLS error surface to users).
 */
export function validateServiceRoleKeyOrThrow(): void {
  if (process.env.NODE_ENV === "test") return;

  const outcome = checkServiceRoleKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (outcome.ok) return;

  const msg = `[TD-118] ${outcome.reason}`;
  console.error(msg);

  // Throw only in local dev. Vercel preview/production keep NODE_ENV =
  // "production", so they fall through to log-only and rely on
  // wrapAdminError() to surface a clearer message at the failing call site.
  if (process.env.NODE_ENV === "development") {
    throw new Error(msg);
  }
}
