#!/usr/bin/env bash
# TD-134: pre-migration drift check. Run before opening any PR that
# adds files under supabase/migrations/. Requires the project to be
# linked to a Supabase project (`supabase link`).
set -euo pipefail
if ! command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI not installed — see https://supabase.com/docs/guides/cli" >&2
  exit 2
fi
echo "==> supabase db diff --linked --schema public"
supabase db diff --linked --schema public
