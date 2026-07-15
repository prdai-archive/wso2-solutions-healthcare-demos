#!/usr/bin/env bash
# Render the submission HTML documents to A4 PDFs via headless Chrome.
# Chrome honours the CSS @page size and margin boxes, so page geometry,
# page numbers, and backgrounds come entirely from careloop.css.
set -euo pipefail

cd "$(dirname "$0")"

CHROME="${CHROME:-google-chrome}"
OUT="out"
mkdir -p "$OUT"

render() {
  local src="$1" pdf="$2"
  echo "rendering $src -> $OUT/$pdf"
  "$CHROME" --headless=new --no-sandbox --disable-gpu \
    --no-pdf-header-footer \
    --print-to-pdf="$OUT/$pdf" \
    --virtual-time-budget=10000 \
    "file://$(pwd)/$src" 2>/dev/null
}

render solution.html care-loop-solution.pdf
render evidence.html care-loop-evidence.pdf

echo "done:"
ls -la "$OUT"
