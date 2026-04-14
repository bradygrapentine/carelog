#!/usr/bin/env bash
# mobile-ui.sh — drive an iOS Simulator OR Android emulator headlessly
# for mobile UI investigation. Screenshots land in /tmp/carelog-ui/.
#
# Usage:
#   ./scripts/mobile-ui.sh [-p ios|android] <subcommand> [args]
#   -p defaults to ios. Env override: PLATFORM=android ./scripts/mobile-ui.sh ...
#
# Subcommands (both platforms unless noted):
#   boot [device]           iOS: boot sim (default iPhone 16 Pro).
#                           Android: start emulator (default: first AVD).
#   start                   Launch Expo dev server + install+open app on device.
#   shot [label]            Screenshot → /tmp/carelog-ui/<platform>-<label>-<ts>.png
#   route <path>            Deep link via scheme yourcarelog:// (from app.json).
#   appearance light|dark   Toggle light/dark.
#   logs [n]                Tail last n lines of Expo dev server log.
#   status                  Print device + expo pid + last shot.
#   stop                    Stop Expo dev server (does not kill sim/emulator).
#   doctor                  Check local tooling for selected platform.
#
# Exit non-zero on failure so Claude can react.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="/tmp/carelog-ui"
mkdir -p "$OUT_DIR"

PLATFORM="${PLATFORM:-ios}"
# parse -p flag
if [[ "${1:-}" == "-p" || "${1:-}" == "--platform" ]]; then
  PLATFORM="${2:-ios}"; shift 2
fi
[[ "$PLATFORM" == "ios" || "$PLATFORM" == "android" ]] || {
  echo "mobile-ui: invalid platform '$PLATFORM' (use ios|android)"; exit 1
}

LOG_FILE="$OUT_DIR/expo-$PLATFORM.log"
PID_FILE="$OUT_DIR/expo-$PLATFORM.pid"
SCHEME="yourcarelog"   # from apps/mobile/app.json (see PP-021)

# ────────────────────────────────────────────────────────────────── iOS helpers
require_mac() {
  [[ "$(uname)" == "Darwin" ]] || { echo "ios path requires macOS"; exit 1; }
}

ios_booted_udid() {
  xcrun simctl list devices booted -j 2>/dev/null | /usr/bin/python3 -c '
import json, sys
try: data = json.load(sys.stdin)
except Exception: sys.exit(0)
for _, devs in data.get("devices", {}).items():
    for d in devs:
        if d.get("state") == "Booted":
            print(d["udid"]); sys.exit(0)
' 2>/dev/null || true
}

ios_boot() {
  require_mac
  local device="${1:-iPhone 16 Pro}"
  if [[ -n "$(ios_booted_udid)" ]]; then
    echo "already booted: $(ios_booted_udid)"; open -a Simulator || true; return 0
  fi
  local udid
  udid=$(xcrun simctl list devices available -j | /usr/bin/python3 -c "
import json, sys
name = '$device'
data = json.load(sys.stdin)
for _, devs in data.get('devices', {}).items():
    for d in devs:
        if d.get('name') == name and d.get('isAvailable'):
            print(d['udid']); sys.exit(0)
")
  [[ -n "$udid" ]] || { echo "no available ios device named '$device'"; exit 1; }
  xcrun simctl boot "$udid"
  open -a Simulator
  for _ in $(seq 1 30); do
    [[ "$(xcrun simctl list devices "$udid" | grep -c Booted)" -gt 0 ]] && break
    sleep 1
  done
  echo "booted: $udid"
}

ios_start() {
  [[ -n "$(ios_booted_udid)" ]] || ios_boot
  if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "expo already running (pid $(cat "$PID_FILE"))"; return 0
  fi
  cd "$ROOT/apps/mobile"
  nohup pnpm start --ios > "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  echo "expo started (pid $(cat "$PID_FILE")), log: $LOG_FILE"
}

ios_shot() {
  [[ -n "$(ios_booted_udid)" ]] || { echo "no booted simulator — run: boot"; exit 1; }
  local label="${1:-shot}"; local ts; ts=$(date +%Y%m%d-%H%M%S)
  local path="$OUT_DIR/ios-${label}-${ts}.png"
  xcrun simctl io booted screenshot "$path"
  echo "$path"
}

ios_route() {
  local path="${1:-/}"
  [[ -n "$(ios_booted_udid)" ]] || { echo "no booted simulator"; exit 1; }
  local url="${SCHEME}://${path#/}"
  xcrun simctl openurl booted "$url"
  echo "opened: $url"
}

ios_appearance() {
  xcrun simctl ui booted appearance "${1:-light}"
  echo "appearance: ${1:-light}"
}

ios_status() {
  echo "platform: ios"
  echo "booted:   $(ios_booted_udid || echo none)"
}

# ────────────────────────────────────────────────────────────── Android helpers
ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
ADB="$ANDROID_HOME/platform-tools/adb"
EMULATOR="$ANDROID_HOME/emulator/emulator"

require_android_sdk() {
  [[ -x "$ADB" ]] || { echo "adb not found at $ADB — install Android Studio or set ANDROID_HOME"; exit 1; }
  [[ -x "$EMULATOR" ]] || { echo "emulator not found at $EMULATOR"; exit 1; }
}

android_device_online() {
  "$ADB" get-state 2>/dev/null | grep -q device && return 0 || return 1
}

android_boot() {
  require_android_sdk
  if android_device_online; then echo "device already online: $("$ADB" get-serialno)"; return 0; fi
  local avd="${1:-}"
  if [[ -z "$avd" ]]; then
    avd=$("$EMULATOR" -list-avds | head -1 || true)
    [[ -n "$avd" ]] || { echo "no AVDs — create one in Android Studio (e.g., Pixel 8 API 34)"; exit 1; }
  fi
  nohup "$EMULATOR" -avd "$avd" -no-snapshot-load -no-boot-anim > "$OUT_DIR/emulator.log" 2>&1 &
  echo "starting avd: $avd"
  "$ADB" wait-for-device
  # wait until boot completes
  for _ in $(seq 1 60); do
    [[ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]] && break
    sleep 1
  done
  echo "booted: $("$ADB" get-serialno)"
}

android_start() {
  require_android_sdk
  android_device_online || android_boot
  if [[ ! -d "$ROOT/apps/mobile/android" ]]; then
    echo "ERROR: apps/mobile/android/ does not exist."
    echo "Run: (cd apps/mobile && npx expo prebuild -p android --clean)"
    echo "See story PP-014 in docs/project-info/product/PLATFORM_PARITY.md"
    exit 1
  fi
  if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "expo already running (pid $(cat "$PID_FILE"))"; return 0
  fi
  cd "$ROOT/apps/mobile"
  nohup pnpm start --android > "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  echo "expo started (pid $(cat "$PID_FILE")), log: $LOG_FILE"
}

android_shot() {
  require_android_sdk
  android_device_online || { echo "no online android device — run: boot"; exit 1; }
  local label="${1:-shot}"; local ts; ts=$(date +%Y%m%d-%H%M%S)
  local path="$OUT_DIR/android-${label}-${ts}.png"
  "$ADB" exec-out screencap -p > "$path"
  echo "$path"
}

android_route() {
  require_android_sdk
  android_device_online || { echo "no online android device"; exit 1; }
  local path="${1:-/}"
  local url="${SCHEME}://${path#/}"
  "$ADB" shell am start -a android.intent.action.VIEW -d "$url" >/dev/null
  echo "opened: $url"
}

android_appearance() {
  require_android_sdk
  local mode="${1:-light}"
  case "$mode" in
    dark) "$ADB" shell "cmd uimode night yes" >/dev/null ;;
    light) "$ADB" shell "cmd uimode night no" >/dev/null ;;
    *) echo "use light|dark"; exit 1 ;;
  esac
  echo "appearance: $mode"
}

android_status() {
  echo "platform: android"
  if [[ -x "$ADB" ]] && android_device_online; then
    echo "device:   $("$ADB" get-serialno)"
  else
    echo "device:   none"
  fi
}

# ────────────────────────────────────────────────────────────────── shared logs
cmd_logs() {
  local n="${1:-80}"
  [[ -f "$LOG_FILE" ]] || { echo "no log yet ($LOG_FILE)"; exit 0; }
  tail -n "$n" "$LOG_FILE"
}

cmd_status() {
  if [[ "$PLATFORM" == "ios" ]]; then ios_status; else android_status; fi
  if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "expo:     running (pid $(cat "$PID_FILE"))"
  else
    echo "expo:     not running"
  fi
  local last; last=$(ls -1t "$OUT_DIR/${PLATFORM}-"*.png 2>/dev/null | head -1 || true)
  [[ -n "$last" ]] && echo "last shot: $last" || echo "last shot: none"
}

cmd_stop() {
  if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    kill "$(cat "$PID_FILE")" && echo "stopped expo ($PLATFORM)"
    rm -f "$PID_FILE"
  else
    echo "expo not running ($PLATFORM)"
  fi
}

cmd_doctor() {
  echo "platform: $PLATFORM"
  if [[ "$PLATFORM" == "ios" ]]; then
    if [[ "$(uname)" != "Darwin" ]]; then echo "  FAIL: not macOS"; exit 1; fi
    command -v xcrun >/dev/null && echo "  xcrun: ok" || echo "  FAIL: xcrun missing"
    xcrun simctl list devices available -j >/dev/null 2>&1 && echo "  simctl: ok" || echo "  FAIL: simctl"
  else
    [[ -x "$ADB" ]] && echo "  adb:      $ADB" || echo "  FAIL: adb ($ADB)"
    [[ -x "$EMULATOR" ]] && echo "  emulator: $EMULATOR" || echo "  FAIL: emulator"
    [[ -d "$ROOT/apps/mobile/android" ]] && echo "  android/: prebuilt" || echo "  WARN: apps/mobile/android/ missing — run expo prebuild (PP-014)"
    if [[ -x "$EMULATOR" ]]; then
      local avds; avds=$("$EMULATOR" -list-avds | wc -l | tr -d ' ')
      echo "  AVDs:     $avds"
    fi
  fi
}

# ──────────────────────────────────────────────────────────────── dispatcher
sub="${1:-status}"; shift || true
case "$PLATFORM:$sub" in
  ios:boot)          ios_boot "$@" ;;
  ios:start)         ios_start "$@" ;;
  ios:shot)          ios_shot "$@" ;;
  ios:route)         ios_route "$@" ;;
  ios:appearance)    ios_appearance "$@" ;;
  android:boot)      android_boot "$@" ;;
  android:start)     android_start "$@" ;;
  android:shot)      android_shot "$@" ;;
  android:route)     android_route "$@" ;;
  android:appearance) android_appearance "$@" ;;
  *:logs)            cmd_logs "$@" ;;
  *:status)          cmd_status ;;
  *:stop)            cmd_stop ;;
  *:doctor)          cmd_doctor ;;
  *) echo "unknown: platform=$PLATFORM sub=$sub"; exit 1 ;;
esac
