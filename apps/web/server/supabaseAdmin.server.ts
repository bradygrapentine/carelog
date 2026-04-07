import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Runtime guard — catches accidental client-side import
if (typeof window !== "undefined") {
  throw new Error(
    "supabaseAdmin.server.ts imported on the client. " +
      "This exposes the service role key. " +
      "Only import from server/ or app/api/ directories.",
  );
}

let _client: SupabaseClient | undefined;

function getClient(): SupabaseClient {
  if (_client) return _client;
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
