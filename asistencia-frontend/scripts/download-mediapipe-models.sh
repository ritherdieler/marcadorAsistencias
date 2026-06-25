#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODELS_DIR="$ROOT/public/mediapipe/models"

LANDMARKER_FILE="$MODELS_DIR/face_landmarker.task"
LANDMARKER_URL="https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"

mkdir -p "$MODELS_DIR"

download_model() {
  local file="$1"
  local url="$2"
  local name
  name="$(basename "$file")"

  if [ -f "$file" ]; then
    echo "Modelo ya presente: $name"
    return 0
  fi

  echo "Descargando $name..."
  curl -fSL "$url" -o "$file"
  echo "Modelo guardado en: $file"
}

download_model "$LANDMARKER_FILE" "$LANDMARKER_URL"
