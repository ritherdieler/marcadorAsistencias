#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CRITICAL_FILES=(
  "node_modules/vite/bin/vite.js"
  "node_modules/sucrase/dist/index.js"
  "node_modules/tailwindcss/package.json"
  "node_modules/postcss/package.json"
  "node_modules/autoprefixer/package.json"
  "node_modules/react/package.json"
  "node_modules/react-dom/package.json"
  "node_modules/@vitejs/plugin-react/package.json"
  "node_modules/@tanstack/react-query/package.json"
  "node_modules/axios/package.json"
  "node_modules/onnxruntime-web/package.json"
  "node_modules/@mediapipe/tasks-vision/package.json"
)

is_deps_valid() {
  if [ ! -d node_modules ]; then
    return 1
  fi

  for file in "${CRITICAL_FILES[@]}"; do
    if [ ! -f "$file" ]; then
      echo "Dependencia incompleta: $file"
      return 1
    fi
  done

  return 0
}

repair_deps() {
  echo "Reparando dependencias..."
  rm -rf node_modules/.vite dist node_modules
  npm install
}

ensure_vite_cache() {
  if [ ! -d node_modules/.vite/deps ] || [ -z "$(ls -A node_modules/.vite/deps 2>/dev/null)" ]; then
    echo "Pre-optimizando dependencias de Vite..."
    node node_modules/vite/bin/vite.js optimize --force
  fi
}

free_dev_port() {
  lsof -tiTCP:5173 2>/dev/null | xargs kill -9 2>/dev/null || true
  pkill -9 -f "$ROOT/node_modules/.bin/vite" 2>/dev/null || true
}

if ! is_deps_valid; then
  repair_deps
fi

if ! is_deps_valid; then
  echo "No se pudieron reparar las dependencias."
  exit 1
fi

free_dev_port

if [ "${ENSURE_VITE_CACHE:-1}" = "1" ]; then
  ensure_vite_cache
fi
