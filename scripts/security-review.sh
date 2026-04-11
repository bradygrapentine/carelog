#!/bin/bash
# Headless adversarial security review using Claude Code
# Usage: ./scripts/security-review.sh
# Output: reviews/YYYY-MM-DD-security-review.md

set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUTDIR="$DIR/reviews"
DATE=$(date +%Y-%m-%d)
OUTFILE="$OUTDIR/$DATE-security-review.md"

mkdir -p "$OUTDIR"

echo "Running adversarial security review..."

claude -p "Run /review on this codebase. Dispatch 3 parallel subagents (auth+RLS, input validation+API routes, PHI+data leakage). Output a single consolidated markdown findings report with severity levels. Do NOT make any code changes." \
  --allowedTools "Read,Glob,Grep,Agent" \
  --output-format text > "$OUTFILE"

echo "Review saved to $OUTFILE"
