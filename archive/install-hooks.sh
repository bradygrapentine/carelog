#!/usr/bin/env bash
# scripts/install-hooks.sh — install git hooks for this repo
# Run once after cloning: ./scripts/install-hooks.sh

set -euo pipefail

HOOKS_DIR="$(git rev-parse --git-dir)/hooks"

install_hook() {
  local name="$1"
  local dest="$HOOKS_DIR/$name"

  if [[ -f "$dest" && ! -L "$dest" ]]; then
    echo "  ⚠ $name already exists and is not a symlink — skipping (manual merge required)"
    return
  fi

  cat > "$dest" << 'EOF'
#!/usr/bin/env bash
# pre-commit: run Vitest before every commit
set -euo pipefail

echo "Running tests..."
cd apps/web && npx vitest run --reporter=verbose 2>&1
EOF

  chmod +x "$dest"
  echo "  ✓ $name installed"
}

echo "Installing git hooks..."
install_hook "pre-commit"
echo ""
echo "Done. Tests will now run automatically on every git commit."
echo "To skip in an emergency: git commit --no-verify"
