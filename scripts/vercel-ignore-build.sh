#!/bin/bash
# TD-123: skip Vercel preview deploys when no UI-relevant paths changed.
#
# Vercel `ignoreCommand` contract:
#   exit 0 → proceed with build
#   exit 1 → skip build (preview check still passes; no deploy charge)
#
# Run from anywhere; resolves paths relative to the repo root.
# Vercel sets the working directory to the project root (apps/web), so the
# "../.." pattern in vercel.json's ignoreCommand brings us here.

set -e

# Paths whose changes warrant a fresh preview. Anything outside this list
# (server-only TS, tests, supabase migrations, docs, mobile, scripts, etc.)
# does NOT need a Vercel deploy — backend tests + tsc + the GitHub CI suite
# already cover correctness.
WATCH_PATHS=(
  "apps/web/app"
  "apps/web/components"
  "apps/web/public"
  "apps/web/styles"
  "apps/web/lib"
  "apps/web/middleware.ts"
  "apps/web/proxy.ts"
  "apps/web/next.config.ts"
  "apps/web/package.json"
  "apps/web/pnpm-lock.yaml"
  "apps/web/vercel.json"
  "apps/web/tailwind.config.ts"
  "apps/web/postcss.config.mjs"
  "pnpm-lock.yaml"
  "package.json"
)

# Vercel provides VERCEL_GIT_PREVIOUS_SHA in preview builds. Fall back to HEAD^
# when running locally.
PREV="${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}"

# `git diff --quiet` returns 0 when no changes, 1 when changes detected.
# We want to BUILD when the diff DOES contain WATCH_PATHS, SKIP when it doesn't.
if git diff --quiet "$PREV" HEAD -- "${WATCH_PATHS[@]}"; then
  echo "TD-123: no UI-relevant paths changed since $PREV. Skipping Vercel build."
  exit 1
fi

echo "TD-123: UI-relevant paths changed since $PREV. Proceeding with Vercel build."
exit 0
