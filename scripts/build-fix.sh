#!/bin/bash
# Self-correcting build loop using Claude Code
# Runs build, captures errors, fixes them, retries (up to 5 attempts)
# Usage: ./scripts/build-fix.sh

set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Running self-correcting build loop..."

claude -p "Act as a deployment engineer. Run 'cd apps/web && npx next build' and capture the full output. If there are errors: 1) Read the relevant source files, 2) Fix the root cause (type errors, missing imports, etc.), 3) Re-run the build. Repeat until the build succeeds or you've attempted 5 fix cycles. Then run 'pnpm test' to verify no regressions. For each fix, log what broke and why. If the build succeeds after fixes, commit with message 'fix(build): [description]'. If it fails after 5 attempts, report what's blocking." \
  --allowedTools "Read,Glob,Grep,Edit,Write,Bash,Agent" \
  --output-format text

echo "Build loop complete."
