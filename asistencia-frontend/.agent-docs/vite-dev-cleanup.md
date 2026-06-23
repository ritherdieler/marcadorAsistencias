# Limpieza y arranque de Vite

## Problema
Vite 8 mostraba `ready` al instante, pero la primera petición HTTP quedaba bloqueada ~40 s mientras escaneaba dependencias (`onnxruntime-web`, `@mediapipe/tasks-vision`).

## Solución
- `scripts/ensure-deps.sh` valida dependencias críticas, reinstala si están corruptas, libera el puerto 5173 y precalienta la caché de Vite.
- Se ejecuta automáticamente con `predev`, `prebuild`, `prepreview` y al usar `npm run dev`.
- `optimizeDeps.exclude` mantiene fuera ONNX y MediaPipe del pre-bundling.

## Comandos
```bash
npm run dev
npm run dev:fresh
npm run ensure-deps
npm run clean
npm run clean:all
```

## Validación
Tras `dev:fresh`, el servidor responde HTTP 200 en ~1 s. Sin caché, la optimización inicial tarda ~20 s y luego responde de inmediato.

## Error PostCSS / sucrase
Si aparece `Cannot find module .../sucrase/dist/index.js`, `node_modules` está corrupto. El script `ensure-deps` lo detecta y reinstala automáticamente. También puedes forzar:
```bash
npm run clean:all
npm run dev
```
