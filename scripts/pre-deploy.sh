#!/usr/bin/env bash
# Pre-deploy verification script for Carelog
# Usage: bash scripts/pre-deploy.sh
# Runs all checks required before deploying to production

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

ERRORS=()
WARNINGS=()

echo "=== Carelog Pre-Deploy Verification ==="
echo ""

# 1. TypeScript check
echo "→ TypeScript..."
if cd apps/web && npx tsc --noEmit 2>&1; then
  echo "  ✓ TypeScript clean"
else
  ERRORS+=("TypeScript errors found")
fi
cd "$PROJECT_ROOT"

# 2. Lint
echo "→ ESLint..."
if cd apps/web && npx eslint --quiet . 2>&1 | tail -5; then
  echo "  ✓ ESLint clean"
else
  ERRORS+=("ESLint errors found")
fi
cd "$PROJECT_ROOT"

# 3. Unit tests
echo "→ Unit tests..."
if pnpm test --run 2>&1 | tail -10; then
  echo "  ✓ Unit tests passing"
else
  ERRORS+=("Unit tests failing")
fi

# 4. Check required env vars
echo "→ Environment variables..."
REQUIRED_VARS=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
  "UPSTASH_REDIS_REST_URL"
  "UPSTASH_REDIS_REST_TOKEN"
  "INNGEST_EVENT_KEY"
  "INNGEST_SIGNING_KEY"
)
ENV_FILE="apps/web/.env.production.local"
if [ -f "$ENV_FILE" ]; then
  for var in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^${var}=" "$ENV_FILE" 2>/dev/null; then
      WARNINGS+=("Missing env var in .env.production.local: $var")
    fi
  done
  echo "  ✓ Env var check done"
else
  WARNINGS+=(".env.production.local not found — cannot verify env vars")
fi

# 5. Check for hardcoded secrets or localhost URLs in source
echo "→ Secret scan..."
if grep -rn "localhost:54321\|127\.0\.0\.1:54321" apps/web/app apps/web/lib apps/web/server 2>/dev/null | grep -v "\.test\." | grep -v "__tests__"; then
  ERRORS+=("Hardcoded local Supabase URL found in source")
else
  echo "  ✓ No hardcoded local URLs"
fi

# 6. supabaseAdmin boundary check
echo "→ supabaseAdmin boundary..."
ADMIN_VIOLATIONS=$(grep -rn "supabaseAdmin" apps/web/app apps/web/lib apps/web/components 2>/dev/null | grep -v "app/api/" | grep -v "\.test\." || true)
if [ -n "$ADMIN_VIOLATIONS" ]; then
  echo "$ADMIN_VIOLATIONS"
  ERRORS+=("supabaseAdmin used outside allowed directories")
else
  echo "  ✓ supabaseAdmin boundary clean"
fi

echo ""
echo "=== Results ==="

if [ ${#WARNINGS[@]} -gt 0 ]; then
  echo "WARNINGS:"
  for w in "${WARNINGS[@]}"; do echo "  ⚠ $w"; done
fi

if [ ${#ERRORS[@]} -gt 0 ]; then
  echo "ERRORS (deploy blocked):"
  for e in "${ERRORS[@]}"; do echo "  ✗ $e"; done
  echo ""
  echo "Fix errors before deploying."
  exit 1
else
  echo "✓ All checks passed — ready to deploy."
fi
