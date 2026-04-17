#!/usr/bin/env bash
# android-visual-qa.sh — Screenshot every top-level Carelog screen on Android
# and produce an HTML side-by-side report for iOS/Android visual comparison.
#
# Prerequisites:
#   - Android emulator running OR: ./scripts/mobile-ui.sh -p android boot
#   - Expo dev server running   OR: ./scripts/mobile-ui.sh -p android start
#   - ANDROID_HOME set (default: ~/Library/Android/sdk)
#   - App launched on emulator (the script cannot launch Expo Go automatically
#     on first run — build via: cd apps/mobile && npx expo run:android)
#
# Usage:
#   ./scripts/android-visual-qa.sh [OPTIONS]
#
# Options:
#   --compare <ios-dir>    Compare against existing iOS PNGs in <dir>.
#                          iOS shots can be taken with:
#                            for screen in journal medications schedule settings; do
#                              ./scripts/mobile-ui.sh -p ios shot $screen
#                            done
#   --out <dir>            Output dir (default: /tmp/carelog-qa/android-visual-qa-<date>)
#   --skip-boot            Assume emulator already running (skip android boot check)
#   --no-report            Save PNGs only, skip HTML report generation
#   --help                 Show this message

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE_UI="$ROOT/scripts/mobile-ui.sh"
DATE=$(date +%Y-%m-%d)
OUT_DIR="/tmp/carelog-qa/android-visual-qa-$DATE"
IOS_DIR=""
SKIP_BOOT=false
NO_REPORT=false

# ──────────────────────────────────────────────────────────────── arg parse
while [[ $# -gt 0 ]]; do
  case "$1" in
    --compare) IOS_DIR="$2"; shift 2 ;;
    --out)     OUT_DIR="$2"; shift 2 ;;
    --skip-boot) SKIP_BOOT=true; shift ;;
    --no-report) NO_REPORT=true; shift ;;
    --help|-h) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "unknown flag: $1"; exit 1 ;;
  esac
done

mkdir -p "$OUT_DIR"
echo "android-visual-qa: output → $OUT_DIR"

# ──────────────────────────────────────────────────────────────── preflight
if [[ ! -x "$MOBILE_UI" ]]; then
  echo "ERROR: mobile-ui.sh not found at $MOBILE_UI"; exit 1
fi

if [[ "$SKIP_BOOT" == false ]]; then
  if ! bash "$MOBILE_UI" -p android doctor 2>&1 | grep -q "adb:"; then
    echo ""
    echo "Android SDK not found. Run doctor for details:"
    echo "  ./scripts/mobile-ui.sh -p android doctor"
    echo ""
    echo "To set up the Android emulator:"
    echo "  1. Install Android Studio"
    echo "  2. Create a Pixel 8 API 34 AVD"
    echo "  3. export ANDROID_HOME=~/Library/Android/sdk"
    echo "  4. ./scripts/mobile-ui.sh -p android boot"
    echo "  5. ./scripts/mobile-ui.sh -p android start"
    exit 1
  fi
fi

# ──────────────────────────────────────────────────────────────── screen list
# Format: "label:deep-link-path:settle-ms"
# settle-ms is how long to wait after navigation before screenshotting.
SCREENS=(
  "journal:journal:2000"
  "medications:medications:2000"
  "schedule:schedule:2000"
  "documents:documents:2000"
  "settings:settings:1500"
  "burnout:burnout:1500"
  "outer-circle:outer-circle:1500"
  "care-brief:care-brief:1500"
  "expenses:expenses:1500"
  "symptoms:symptoms:1500"
  "eol-planner:eol-planner:1500"
)

echo "Taking ${#SCREENS[@]} screenshots on Android..."
declare -a ANDROID_SHOTS=()

for entry in "${SCREENS[@]}"; do
  IFS=':' read -r label path settle <<< "$entry"
  echo "  → $label"
  bash "$MOBILE_UI" -p android route "$path" >/dev/null 2>&1 || true
  sleep "$(echo "scale=1; $settle / 1000" | bc)"
  shot_path=$(bash "$MOBILE_UI" -p android shot "$label" 2>/dev/null)
  cp "$shot_path" "$OUT_DIR/android-${label}.png"
  ANDROID_SHOTS+=("$label")
  echo "     saved: $OUT_DIR/android-${label}.png"
done

echo ""
echo "All ${#ANDROID_SHOTS[@]} Android screenshots saved to $OUT_DIR"

# ──────────────────────────────────────────────────────────────── HTML report
if [[ "$NO_REPORT" == true ]]; then
  echo "Skipping report (--no-report)."
  exit 0
fi

REPORT="$OUT_DIR/report.html"

{
cat << 'HTMLHEAD'
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Carelog — Android Visual QA</title>
<style>
  body { font-family: -apple-system, sans-serif; margin: 0; padding: 16px; background: #f8f9fa; }
  h1 { font-size: 20px; color: #1e0a3c; margin-bottom: 4px; }
  .meta { font-size: 12px; color: #6b7280; margin-bottom: 24px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 24px; }
  .card { background: #fff; border-radius: 12px; border: 1px solid #ede9fe; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .card-title { padding: 10px 14px; font-size: 13px; font-weight: 600; color: #7c3aed; background: #ede9fe; border-bottom: 1px solid #ede9fe; }
  .screens { display: flex; gap: 0; }
  .col { flex: 1; text-align: center; }
  .col-label { font-size: 11px; color: #6b7280; padding: 6px 0 4px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
  .col img { width: 100%; display: block; border-top: 1px solid #f3f4f6; }
  .missing { padding: 48px 16px; font-size: 12px; color: #9ca3af; background: #f9fafb; }
  .divider { width: 1px; background: #ede9fe; }
  .compare .col { width: 50%; }
  .android-only .col { width: 100%; }
  .status-ok   { color: #059669; }
  .status-miss { color: #d97706; }
  .summary { margin-bottom: 24px; padding: 12px 16px; background: #fff; border-radius: 8px; border: 1px solid #ede9fe; font-size: 13px; }
</style>
</head>
<body>
HTMLHEAD

echo "<h1>Carelog — Android Visual QA</h1>"
echo "<p class=\"meta\">Generated: $(date '+%Y-%m-%d %H:%M:%S') · Platform: Android (emulator)</p>"

# summary
echo "<div class=\"summary\">"
echo "<strong>${#ANDROID_SHOTS[@]} screens captured.</strong>"
if [[ -n "$IOS_DIR" ]]; then
  echo " Comparing against iOS screenshots in <code>$IOS_DIR</code>."
else
  echo " No iOS reference dir provided — Android-only view. Re-run with <code>--compare &lt;ios-dir&gt;</code> for side-by-side comparison."
fi
echo "</div>"

echo "<div class=\"grid\">"

for label in "${ANDROID_SHOTS[@]}"; do
  android_img="android-${label}.png"
  echo "<div class=\"card\">"
  echo "<div class=\"card-title\">$label</div>"

  if [[ -n "$IOS_DIR" ]]; then
    # look for ios shot with matching label
    ios_match=$(ls "$IOS_DIR"/ios-${label}-*.png 2>/dev/null | tail -1 || echo "")
    echo "<div class=\"screens compare\">"
    echo "  <div class=\"col\">"
    echo "    <div class=\"col-label\">iOS</div>"
    if [[ -f "$ios_match" ]]; then
      cp "$ios_match" "$OUT_DIR/ios-${label}.png"
      echo "    <img src=\"ios-${label}.png\" alt=\"iOS $label\">"
    else
      echo "    <div class=\"missing\">No iOS reference</div>"
    fi
    echo "  </div>"
    echo "  <div class=\"divider\"></div>"
    echo "  <div class=\"col\">"
    echo "    <div class=\"col-label\">Android</div>"
    echo "    <img src=\"$android_img\" alt=\"Android $label\">"
    echo "  </div>"
    echo "</div>"
  else
    echo "<div class=\"screens android-only\">"
    echo "  <div class=\"col\">"
    echo "    <div class=\"col-label\">Android</div>"
    echo "    <img src=\"$android_img\" alt=\"Android $label\">"
    echo "  </div>"
    echo "</div>"
  fi

  echo "</div>"
done

echo "</div>"
echo "</body></html>"
} > "$REPORT"

echo "HTML report: $REPORT"
echo ""
echo "Open in browser:"
echo "  open $REPORT"
