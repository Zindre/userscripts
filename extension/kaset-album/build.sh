#!/bin/sh
# Builds "Kaset Album.app" into ~/Applications and registers its kasetalbum:// links (see KasetAlbum.applescript).
# Kaset must be installed first: the script is compiled against its AppleScript dictionary.
set -e
cd "$(dirname "$0")"
APP="$HOME/Applications/Kaset Album.app"
rm -rf "$APP"
osacompile -o "$APP" KasetAlbum.applescript
P="$APP/Contents/Info.plist"
set_key() { /usr/libexec/PlistBuddy -c "Set :$1 $3" "$P" 2>/dev/null || /usr/libexec/PlistBuddy -c "Add :$1 $2 $3" "$P"; }
set_key CFBundleIdentifier string no.sedb.kasetalbum
set_key LSUIElement bool true
set_key NSAppleEventsUsageDescription string "'Kaset Album asks Kaset to play the album you chose.'"
/usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes array" -c "Add :CFBundleURLTypes:0 dict" -c "Add :CFBundleURLTypes:0:CFBundleURLName string 'Kaset Album'" \
  -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string kasetalbum" "$P"
codesign --force --deep --sign - "$APP"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP"
echo "Built $APP"
