#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
version="$(node -p '(m => m.version_name || m.version)(require("./extension/manifest.json"))')"
archive="dist/calendar-hours-${version}.zip"
archive_path="$PWD/$archive"
staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT
cp -R extension/. "$staging/"
node scripts/package-manifest.js "$staging/manifest.json"
rm -f "$archive"
(cd "$staging" && zip -q -r "$archive_path" . -x '*.DS_Store')
unzip -t "$archive" >/dev/null
echo "$archive"
