# Face Vision Unification — Fase 2

> Documento consolidado: [`face-vision-unified.md`](face-vision-unified.md)

## Objetivo

Mover la inferencia de MediaPipe Face Landmarker a un Web Worker para no bloquear el hilo principal durante detección en video e imagen.

## Archivos nuevos

| Archivo | Responsabilidad |
| --- | --- |
| `workers/faceVision.worker.ts` | Carga WASM + `face_landmarker.task`, maneja `init`, `detectVideo`, `detectImage`, devuelve `SerializedFaceAnalysisResult` |
| `services/faceVisionWorkerClient.ts` | API Promise sobre el worker; fallback automático si falla la inicialización |

## Cambios

| Archivo | Cambio |
| --- | --- |
| `faceVisionService.ts` | Tipos serializados; `detectFromVideo` / `detectFromImage` enrutan al worker vía `createImageBitmap` + cliente worker; fallback a detección síncrona en main thread |
| `vite.config.ts` | `worker.format: 'es'`, `assetsInclude` para `.wasm` y `.task` |

## Protocolo worker

Mensajes entrantes:

- `init` — inicializa landmarkers VIDEO e IMAGE
- `detectVideo` — `ImageBitmap` + `timestampMs` (OffscreenCanvas + `detectForVideo`)
- `detectImage` — `ImageBitmap` (`detect`)

Respuestas: `init` (ok/error), `detectVideo` / `detectImage` con resultado serializado, o `error`.

## Sin cambios

- `facePresenceDetector.ts` (sigue usando `detectFromVideo` del servicio)
- `AttendanceMarker.tsx`
- `localFaceDescriptor.ts`

## Build

```bash
npm run build
```

Resultado: **OK** (tsc + vite build). Worker bundle: `dist/assets/faceVision.worker-*.js`.
