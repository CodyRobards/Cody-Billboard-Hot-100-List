#!/usr/bin/env bash
set -euo pipefail

# Always work from repo root
cd "$(dirname "$0")/.."

# Dedicated temp directory inside project
TMPDIR="$(pwd)/.lhci-tmp"
mkdir -p "$TMPDIR"

# Force all Node, LHCI, and Chrome temp dirs to stay here
export TMPDIR
export TEMP="$TMPDIR"
export TMP="$TMPDIR"

# Explicit Chrome profile dir
export CHROME_PATH="/usr/bin/google-chrome"
export LHCI_CHROME_FLAGS="--user-data-dir=$TMPDIR/chrome-profile --no-sandbox"

# Cleanup on exit or interruption
cleanup() {
  rm -rf "$TMPDIR"/lighthouse.* "$TMPDIR"/chrome-profile "$TMPDIR"/node-compile-cache* || true
}
trap cleanup EXIT INT TERM

# Run LHCI
npx lhci autorun --config=./lighthouserc.json
