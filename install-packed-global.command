#!/bin/bash
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

echo "[omx] Packing current workspace and installing globally..."
npm run install:packed-global
status=$?

echo
if [ "$status" -ne 0 ]; then
  echo "[omx] FAILED with exit code $status."
else
  echo "[omx] Done."
fi
echo
read -r -p "Press Enter to close..."
exit "$status"
