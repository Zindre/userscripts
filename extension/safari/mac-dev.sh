#!/usr/bin/env bash
# The Mac app built on this machine, to try a change in Safari without TestFlight: half a minute, no
# upload and nothing sent to Apple's review. It has the same bundle ID as the TestFlight app, so Safari
# keeps its settings, and a build number from the clock, so macOS prefers it to the installed one.
#
#   ./mac-dev.sh        build, and make it the copy Safari uses
#   ./mac-dev.sh --off  remove it, back to the app in /Applications
#
# Safari reads an extension when it starts: quit and reopen Safari if a change doesn't show.
set -euo pipefail

# Xcode packages the app with rsync and breaks on Homebrew's rsync 3.x: use the system tools first.
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DERIVED="$HERE/build/dev"
APP="$DERIVED/Build/Products/Debug/NoThis.app"
APPEX="$APP/Contents/PlugIns/NoThis Extension.appex"
INSTALLED="/Applications/NoThis.app"
LSREGISTER=/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister
ID=no.sedb.NoThis.Extension
using() { pluginkit -mAvvv -i "$ID" 2>/dev/null | sed -n 's/^[[:space:]]*Path = //p'; }

if [[ "${1:-}" == "--off" ]]; then
  if [[ -d "$APP" ]]; then
    pluginkit -r "$APPEX" || true
    "$LSREGISTER" -u "$APP" || true
    rm -rf "$DERIVED"
  fi
  if [[ -d "$INSTALLED" ]]; then
    "$LSREGISTER" -f "$INSTALLED"
    pluginkit -a "$INSTALLED/Contents/PlugIns/NoThis Extension.appex"
  fi
  echo "Safari now uses: $(using)"
  exit 0
fi

node "$HERE/../build.mjs" safari
xcodebuild build -quiet \
  -project "$HERE/NoThis/NoThis.xcodeproj" -scheme "NoThis (macOS)" -configuration Debug \
  -destination "platform=macOS,arch=$(uname -m)" -derivedDataPath "$DERIVED" \
  CURRENT_PROJECT_VERSION="$(date -u +%y%m%d%H%M)" -allowProvisioningUpdates
pluginkit -a "$APPEX"
echo "Safari now uses: $(using)"
