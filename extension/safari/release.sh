#!/usr/bin/env bash
# Archives the NoThis Safari apps (iOS and macOS) and uploads them to App Store Connect,
# where they show up in TestFlight after processing.
#
#   ./release.sh            build, archive and upload both platforms
#   ./release.sh --export   archive and export into safari/build/ only, no upload
#
# Needs: DEVELOPMENT_TEAM set in the project, an app record for no.sedb.NoThis in App Store Connect,
# and either Xcode signed in to the Apple Developer account (Xcode → Settings → Accounts) or, as in
# GitHub Actions, an App Store Connect API key: ASC_KEY_PATH (the .p8 file), ASC_KEY_ID, ASC_ISSUER_ID,
# set in the environment or in safari/.asc.env.
set -euo pipefail

# Xcode packages the app with rsync and breaks on Homebrew's rsync 3.x: use the system tools first.
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Locally the API key settings can live in safari/.asc.env (git-ignored); GitHub Actions sets them as env.
[[ -f "$HERE/.asc.env" ]] && source "$HERE/.asc.env"
PROJECT="$HERE/NoThis/NoThis.xcodeproj"
OUT="$HERE/build"
BUILD_NUMBER="$(date -u +%y%m%d%H%M)" # App Store Connect needs a higher build number for every upload
DESTINATION=upload
[[ "${1:-}" == "--export" ]] && DESTINATION=export
AUTH=()
if [[ -n "${ASC_KEY_PATH:-}" ]]; then
  AUTH=(-authenticationKeyPath "$ASC_KEY_PATH" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")
fi

node "$HERE/../build.mjs" safari
rm -rf "$OUT"
mkdir -p "$OUT"
cat > "$OUT/ExportOptions.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>$DESTINATION</string>
  <key>signingStyle</key><string>automatic</string>
</dict>
</plist>
EOF

for platform in iOS macOS; do
  echo "== $platform: archive (build $BUILD_NUMBER)"
  xcodebuild archive -quiet \
    -project "$PROJECT" -scheme "NoThis ($platform)" -configuration Release \
    -destination "generic/platform=$platform" \
    -archivePath "$OUT/NoThis-$platform.xcarchive" \
    CURRENT_PROJECT_VERSION="$BUILD_NUMBER" -allowProvisioningUpdates ${AUTH[@]+"${AUTH[@]}"}
  echo "== $platform: $DESTINATION"
  xcodebuild -exportArchive -quiet \
    -archivePath "$OUT/NoThis-$platform.xcarchive" \
    -exportOptionsPlist "$OUT/ExportOptions.plist" \
    -exportPath "$OUT/$platform" -allowProvisioningUpdates ${AUTH[@]+"${AUTH[@]}"}
done
echo "Done. Build $BUILD_NUMBER: $([[ $DESTINATION == upload ]] && echo 'uploaded; it appears in TestFlight once App Store Connect has processed it' || echo "exported to $OUT")."
