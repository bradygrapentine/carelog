import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { validateServiceRoleKeyOrThrow } from "./validateServiceRoleKey";

// Runtime guard — catches accidental client-side import
if (typeof window !== "undefined") {
  throw new Error(
    "supabaseAdmin.server.ts imported on the client. " +
      "This exposes the service role key. " +
      "Only import from server/ or app/api/ directories.",
  );
}

let _client: SupabaseClient | undefined;
let _validated = false;

function getClient(): SupabaseClient {
  if (_client) return _client;
  // TD-118: sanity-check the key shape before constructing the client. In
  // dev this throws on misconfiguration; in preview/production it logs
  // CRITICAL only and lets wrapAdminError below surface a clear hint.
  if (!_validated) {
    validateServiceRoleKeyOrThrow();
    _validated = true;
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  _client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  return _client;
}

// Lazy proxy — initializes on first use, not at import time.
// This prevents build-time failures when env vars are absent during static analysis.
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop: string | symbol) {
    return (getClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

/**
 * TD-118: wrap PostgrestError-shaped errors thrown from supabaseAdmin writes
 * with a clearer hint when the underlying cause is likely a misconfigured
 * service-role key (anon-fallback → every write fails RLS as code 42501).
 *
 * Use at admin-write call sites:
 *   const { error } = await supabaseAdmin.from('x').insert(...)
 *   if (error) throw wrapAdminError(error)
 */
export function wrapAdminError(error: {
  code?: string;
  message?: string;
}): Error {
  const isRlsClass =
    error.code === "42501" ||
    (typeof error.message === "string" &&
      /row-level security/i.test(error.message));
  if (isRlsClass) {
    return new Error(
      `Supabase admin client may not be authenticated as service_role — check SUPABASE_SERVICE_ROLE_KEY env (must be a JWT with role=service_role, not sb_secret_*). Underlying error: ${error.message ?? "(no message)"}`,
    );
  }
  return new Error(error.message ?? "Unknown supabaseAdmin error");
}
