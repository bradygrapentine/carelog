import { createClient } from "@supabase/supabase-js";

// Runtime guard — catches accidental client-side import
if (typeof window !== "undefined") {
  throw new Error(
    "supabaseAdmin.server.ts imported on the client. " +
      "This exposes the service role key. " +
      "Only import from server/ or app/api/ directories.",
  );
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
}

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
