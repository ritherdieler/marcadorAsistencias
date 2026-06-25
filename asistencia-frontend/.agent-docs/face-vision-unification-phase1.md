# Face Vision Unification — Fase 1

> Documento consolidado: [`face-vision-unified.md`](face-vision-unified.md)

## Objetivo

Centralizar la inferencia de MediaPipe Face Landmarker en un servicio unificado reutilizable por detección de presencia, alineación ArcFace, pose 3D y parpadeo.

## Configuración

`src/config/faceCaptureConfig.ts` expone `FACE_VISION_CONFIG`:

- `outputFaceBlendshapes: true`
- `outputFacialTransformationMatrixes: true`
- `numFaces: 1`
- `minFaceDetectionConfidence: 0.35`
- `minFacePresenceConfidence: 0.35`
- `minTrackingConfidence: 0.5`

## Servicios nuevos

| Archivo | Responsabilidad |
| --- | --- |
| `faceVisionService.ts` | Instancias lazy VIDEO/IMAGE, `detectFromVideo`, `detectFromImage`, tipo `FaceAnalysisResult` |
| `facePose3d.ts` | Euler yaw/pitch/roll desde matriz, `deriveFacePoseFromYaw`, fallback 2D `estimateFacePoseFromLandmarks` |
| `faceLandmarkMapping.ts` | `landmarksToArcFaceLandmarks` (índices 33, 263, 1, 61, 291) |
| `faceBlendshapeUtils.ts` | `readBlinkScores`, `detectBlinkCycle` |

## Facade existente

`facePresenceDetector.ts` delega en `faceVisionService.detectFromVideo` y conserva:

- `hasVisibleFace`
- `detectVisibleFacePose`
- Tipos `FaceBox`, `FaceLandmarkPoint`, `FacePose`, `FacePoseResult`
- Fallback `hasHumanLikeFrame` cuando MediaPipe no detecta rostro usable
- Pose 2D por landmarks en el facade para mantener el comportamiento previo de consumidores

## Sin cambios en Fase 1

- `FaceLandmarksOverlay.tsx`
- `AttendanceMarker.tsx`
- `localFaceDescriptor.ts`

## Build

```bash
npm run build
```

Resultado: **OK** (tsc + vite build).
