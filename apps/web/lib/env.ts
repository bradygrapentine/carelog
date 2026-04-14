// Startup environment variable validation.
// Imported once in instrumentation.ts — logs warnings for missing required vars.
// Does NOT throw — the app still boots, but operators see what's misconfigured.

import { logger } from "@/lib/logger";

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const OPTIONAL_WITH_FALLBACK = [
  // These no-op gracefully when absent (local dev)
  "RESEND_API_KEY",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "NEXT_PUBLIC_POSTHOG_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_MONTHLY",
  "STRIPE_PRICE_ANNUAL",
  "OCR_API_KEY",
  "SENTRY_AUTH_TOKEN",
] as const;

export function validateEnv() {
  const missing: string[] = [];

  for (const key of REQUIRED) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    logger.error(
      "[env] CRITICAL: Missing required environment variables:",
      missing.join(", "),
    );
  }

  if (process.env.NODE_ENV === "production") {
    const missingOptional: string[] = [];
    for (const key of OPTIONAL_WITH_FALLBACK) {
      if (!process.env[key]) {
        missingOptional.push(key);
      }
    }
    if (missingOptional.length > 0) {
      logger.warn(
        "[env] Warning: Optional environment variables not set (some features disabled):",
        missingOptional.join(", "),
      );
    }
  }
}
