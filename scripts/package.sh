#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
version="$(node -p '(m => m.version_name || m.version)(require("./extension/manifest.json"))')"
archive="dist/calendar-hours-${version}.zip"
rm -f "$archive"
(cd extension && zip -q -r "../$archive" . -x '*.DS_Store')
unzip -t "$archive" >/dev/null
echo "$archive"
