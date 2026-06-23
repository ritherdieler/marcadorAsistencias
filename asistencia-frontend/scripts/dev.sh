#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

bash "$ROOT/scripts/ensure-deps.sh"

exec node node_modules/vite/bin/vite.js --host 127.0.0.1
