#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
version="$(node -p 'require("./extension/manifest.json").version')"
archive="dist/calendar-hours-${version}.zip"
rm -f "$archive"
(cd extension && zip -q -r "../$archive" . -x '*.DS_Store')
unzip -t "$archive" >/dev/null
echo "$archive"
