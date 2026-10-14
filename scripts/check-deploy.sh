#!/usr/bin/env bash
# Usage: scripts/check-deploy.sh [url]   (default: https://shapekeeper.vercel.app)
set -euo pipefail
url="${1:-https://shapekeeper.vercel.app}"
body="$(curl -fsSL --max-time 20 "$url/")"
grep -q "ShapeKeeper" <<<"$body" || { echo "FAIL: $url did not serve ShapeKeeper"; exit 1; }
echo "OK: $url serves ShapeKeeper"
