#!/usr/bin/env bash
# Regenerate assets/og.png (link-preview card) and assets/apple-touch-icon.png
# from their HTML/SVG sources, using headless Chrome.
#
#   ./tools/make-og.sh
#
# Requires the dev server on :4173 so the sources load their webfonts over
# http rather than file://. Start it first with: python3 serve.py
set -euo pipefail

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-4173}"
BASE="http://localhost:${PORT}"

[ -x "$CHROME" ] || { echo "Chrome not found at $CHROME" >&2; exit 1; }
curl -sf -o /dev/null "$BASE/" || { echo "No dev server on $BASE — run: python3 serve.py" >&2; exit 1; }

shot() { # url  width  height  outfile
  "$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
    --window-size="$2,$3" --default-background-color=00000000 \
    --virtual-time-budget=8000 --screenshot="$4" "$1" 2>/dev/null
}

shot "$BASE/assets/og-source.html"  1200 630 "$ROOT/assets/og.png"
shot "$BASE/assets/favicon.svg"      180 180 "$ROOT/assets/apple-touch-icon.png"

echo "wrote assets/og.png ($(du -h "$ROOT/assets/og.png" | cut -f1))"
echo "wrote assets/apple-touch-icon.png ($(du -h "$ROOT/assets/apple-touch-icon.png" | cut -f1))"
