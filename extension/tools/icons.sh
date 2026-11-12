#!/usr/bin/env bash
# Draws the Web Detox icon (a soft sun resting on calm lines, on warm paper) in every size the
# extension and the Safari apps use, from the drawings below. Needs rsvg-convert and ImageMagick
# (brew install librsvg imagemagick).
#
#   extension/tools/icons.sh
set -euo pipefail
EXT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ICONS="$EXT/src/icons"
APP="$EXT/safari/NoThis/Shared (App)"
SET="$APP/Assets.xcassets/AppIcon.appiconset"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

PAPER='#f5eee2' SUN='#ec9450' INK='#2c3b57'

# Both drawings are on a 128 grid. $1: the background shape.
# big: 48 px and up, three lines.
big() {
  cat <<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  $1
  <path d="M40 58a24 24 0 0 1 48 0z" fill="$SUN"/>
  <g stroke="$INK" stroke-linecap="round" stroke-width="9">
    <path d="M24 66H104"/>
    <path d="M36 82H92"/>
    <path d="M50 96H78"/>
  </g>
</svg>
SVG
}
# small: 16–38 px. Bigger sun, two thicker lines, edges on the 16 px grid (multiples of 8) so they stay sharp.
small() {
  cat <<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  $1
  <path d="M32 64a32 32 0 0 1 64 0z" fill="$SUN"/>
  <g stroke="$INK" stroke-linecap="round" stroke-width="16">
    <path d="M24 72H104"/>
    <path d="M48 96H80"/>
  </g>
</svg>
SVG
}
ROUND="<rect width=\"128\" height=\"128\" rx=\"28\" fill=\"$PAPER\"/>"
SQUARE="<rect width=\"128\" height=\"128\" fill=\"$PAPER\"/>"
# macOS: Apple's grid, the shape at 824 of 1024 (128 of 159) with a soft shadow below it.
MAC="<defs><filter id=\"s\" x=\"-20%\" y=\"-20%\" width=\"140%\" height=\"140%\"><feGaussianBlur in=\"SourceAlpha\" stdDeviation=\"2.5\"/><feOffset dy=\"2\" result=\"b\"/><feComponentTransfer><feFuncA type=\"linear\" slope=\"0.35\"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in=\"SourceGraphic\"/></feMerge></filter></defs><rect width=\"128\" height=\"128\" rx=\"29\" fill=\"$PAPER\" filter=\"url(#s)\"/>"
macgrid() { sed 's#viewBox="0 0 128 128"#viewBox="-15.5 -14.5 159 159"#'; }

big "$ROUND" > "$ICONS/icon.svg"
small "$ROUND" > "$ICONS/icon-small.svg"
big "$SQUARE" > "$TMP/square.svg"
big "$MAC" | macgrid > "$TMP/mac.svg"
small "$MAC" | macgrid > "$TMP/mac-small.svg"

png() { rsvg-convert -w "$2" -h "$2" "$1" -o "$3"; }
for s in 16 19 32 38 48 64 96 128 256 512 1024; do
  png "$ICONS/$( ((s <= 38)) && echo icon-small.svg || echo icon.svg)" "$s" "$ICONS/icon-$s.png"
done
# iOS masks the corners itself and wants no transparency.
png "$TMP/square.svg" 1024 "$TMP/ios.png"; magick "$TMP/ios.png" -alpha off "$SET/universal-icon-1024@1x.png"
for s in 16 32 128 256 512; do
  for k in 1 2; do
    px=$((s * k))
    png "$TMP/$( ((px <= 32)) && echo mac-small.svg || echo mac.svg)" "$px" "$SET/mac-icon-$s@${k}x.png"
  done
done
png "$ICONS/icon.svg" 512 "$APP/Resources/Icon.png"
png "$ICONS/icon.svg" 256 "$APP/Assets.xcassets/LargeIcon.imageset/icon-256.png"
echo "Icons written to src/icons/ and the Safari app."
