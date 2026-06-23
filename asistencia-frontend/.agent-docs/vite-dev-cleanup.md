# Limpieza y arranque de Vite

## Problema
Vite 8 mostraba `ready` al instante, pero la primera petición HTTP quedaba bloqueada ~40 s mientras escaneaba dependencias (`onnxruntime-web`, `@mediapipe/tasks-vision`).

## Solución
- `scripts/ensure-deps.sh` valida dependencias críticas (incluye `tailwindcss/lib/index.js`), reinstala si están corruptas y libera el puerto 5173.
- Se ejecuta automáticamente con `prebuild` y `prepreview`. Para desarrollo, ejecuta manualmente `npm run ensure-deps` si hay problemas con dependencias.
- `optimizeDeps.exclude` mantiene fuera ONNX y MediaPipe del pre-bundling.

## Error PostCSS / tailwindcss
Si aparece `Cannot find module .../tailwindcss/lib/index.js`, `node_modules` quedó corrupto (p. ej. por reinicios de Vite mientras se reinstalaban dependencias). El script `ensure-deps` lo detecta y reinstala automáticamente. También puedes forzar:
```bash
npm run clean:all
npm run dev
```

## Error PostCSS / sucrase
Si aparece `Cannot find module .../sucrase/dist/index.js`, aplica el mismo flujo anterior.
