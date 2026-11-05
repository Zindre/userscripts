#!/usr/bin/env bash
# Draws the Web Detox icon (a browser window with a leaf in it) in every size the extension and the
# Safari apps use, from the drawing below. Needs rsvg-convert and ImageMagick (brew install librsvg imagemagick).
#
#   extension/tools/icons.sh
set -euo pipefail
EXT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ICONS="$EXT/src/icons"
APP="$EXT/safari/NoThis/Shared (App)"
SET="$APP/Assets.xcassets/AppIcon.appiconset"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# The drawing on a 128 grid. $1: the background shape; $2: line width (thicker for the small sizes,
# which also leave out the leaf's vein).
art() {
  local bg="$1" w="${2:-7}" vein=1
  (( w > 7 )) && vein=0
  cat <<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2dd4bf"/><stop offset="1" stop-color="#0f766e"/></linearGradient></defs>
  $bg
  <rect x="22" y="28" width="84" height="72" rx="13" fill="none" stroke="#fff" stroke-width="$w"/>
  <path d="M22 46h84" stroke="#fff" stroke-width="$((w - 1))"/>
  <path d="M40 92c0-24 18-36 46-36 0 24-16 38-46 36z" fill="#fff"/>
  $( ((vein)) && echo '<path d="M46 87l26-20" stroke="#17a596" stroke-width="4" stroke-linecap="round"/>' )
</svg>
SVG
}
ROUND='<rect width="128" height="128" rx="28" fill="url(#g)"/>'
SQUARE='<rect width="128" height="128" fill="url(#g)"/>'
art "$ROUND" > "$ICONS/icon.svg"
art "$ROUND" 9 > "$TMP/small.svg"
art "$SQUARE" > "$TMP/square.svg"
# macOS: Apple's grid, the shape at 824 of 1024 (128 of 159) with a soft shadow below it.
sed -e 's#viewBox="0 0 128 128"#viewBox="-15.5 -14.5 159 159"#' \
    -e 's#<defs>#<defs><filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur in="SourceAlpha" stdDeviation="2.5"/><feOffset dy="2" result="b"/><feComponentTransfer><feFuncA type="linear" slope="0.35"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>#' \
    -e 's#<rect width="128" height="128" rx="28" fill="url(\#g)"/>#<rect width="128" height="128" rx="29" fill="url(\#g)" filter="url(\#s)"/>#' \
    "$ICONS/icon.svg" > "$TMP/mac.svg"

png() { rsvg-convert -w "$2" -h "$2" "$1" -o "$3"; }
for s in 16 19 32 38 48 64 96 128 256 512 1024; do
  png "$( ((s <= 38)) && echo "$TMP/small.svg" || echo "$ICONS/icon.svg")" "$s" "$ICONS/icon-$s.png"
done
# iOS masks the corners itself and wants no transparency.
png "$TMP/square.svg" 1024 "$TMP/ios.png"; magick "$TMP/ios.png" -alpha off "$SET/universal-icon-1024@1x.png"
for s in 16 32 128 256 512; do
  png "$TMP/mac.svg" "$s" "$SET/mac-icon-$s@1x.png"
  png "$TMP/mac.svg" "$((s * 2))" "$SET/mac-icon-$s@2x.png"
done
png "$ICONS/icon.svg" 512 "$APP/Resources/Icon.png"
png "$ICONS/icon.svg" 256 "$APP/Assets.xcassets/LargeIcon.imageset/icon-256.png"
echo "Icons written to src/icons/ and the Safari app."
