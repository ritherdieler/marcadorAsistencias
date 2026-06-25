# Registro facial — UX y arquitectura

Flujo de registro facial del back office de asistencia ([`AdminRegistration`](../src/features/personnel/components/AdminRegistration.tsx)). Aplica a ambos modos: usuario **Existente** y usuario **Nuevo**. Ambos capturan 3 ángulos guiados (frontal, izquierda, derecha).

## Flujo por pasos

```
Tabs (Existente / Nuevo)
  -> data    : credenciales (Existente) o formulario (Nuevo) + tips
  -> guide   : preview en vivo de la cámara + resumen de los 3 ángulos
  -> capture : auto-captura por ángulo (countdown) o "Capturar ahora"
  -> review  : miniaturas + recaptura individual -> Registrar
  -> success : resumen + "Registrar otro"
```

- La cámara solo se enciende en `guide` y `capture` (`active` del hook). En `review` y `success` se apaga.
- Al completar los 3 ángulos en `capture`, se pasa automáticamente a `review`.

## Arquitectura

| Pieza | Responsabilidad |
|-------|-----------------|
| [`hooks/useFaceEnrollment.ts`](../src/features/personnel/hooks/useFaceEnrollment.ts) | Lógica: cámara, loop de detección, estimación de pose, gating de calidad, countdown, captura/recaptura por ángulo, mensajes. Expone estado + handlers (sin JSX). |
| [`registration/CameraStage.tsx`](../src/features/personnel/components/registration/CameraStage.tsx) | Video 16:9 espejado (selfie) + guía de posición + overlay + región de estado `aria-live` + selector de cámara. |
| [`recognition/components/FacePositionGuide.tsx`](../src/features/recognition/components/FacePositionGuide.tsx) | Orquesta óvalo objetivo, flechas animadas y barra de zonas (configurable en admin). |
| [`recognition/components/FaceBoxOverlay.tsx`](../src/features/recognition/components/FaceBoxOverlay.tsx) | Caja rectangular opcional sobre el rostro detectado; color por estado. |
| [`registration/CaptureCountdown.tsx`](../src/features/personnel/components/registration/CaptureCountdown.tsx) | Cuenta 3‑2‑1 al mantener la pose alineada. |
| [`registration/CaptureProgressRing.tsx`](../src/features/personnel/components/registration/CaptureProgressRing.tsx) | Anillo de progreso con `role="progressbar"`. |
| [`registration/CapturedThumbnails.tsx`](../src/features/personnel/components/registration/CapturedThumbnails.tsx) | Miniaturas por ángulo con recaptura individual. |
| [`registration/ModeTabs.tsx`](../src/features/personnel/components/registration/ModeTabs.tsx) | Tabs accesibles (`role="tablist"`, flechas teclado). |
| [`registration/EnrollmentSteps.tsx`](../src/features/personnel/components/registration/EnrollmentSteps.tsx) | Stepper con `aria-current="step"`. |
| [`registration/EnrollmentTips.tsx`](../src/features/personnel/components/registration/EnrollmentTips.tsx) | Consejos de captura (luz, sin lentes/gorra, expresión neutra). |
| [`registration/PasswordField.tsx`](../src/features/personnel/components/registration/PasswordField.tsx) | Input de contraseña con toggle mostrar/ocultar (`aria-pressed`). |

## Gating de calidad y auto-captura

En `useFaceEnrollment`, por cada frame (cada `280 ms`):

1. `detectVisibleFacePose(video)` → `{ visible, pose, box }`.
2. Sin `box` real ⇒ estado `searching` (no captura).
3. Con `box`: `resolveFacePose(...)` + `evaluateEnrollmentAlignment(box, pose, angle, config, mirrorSelfiePerspective)`:
   - `too_far` / `too_close` por **ancho del rostro** (`minFaceWidth` = objetivo; `maxFaceWidth` = `min(objetivo × upperWidthRatio, 75%)`).
   - `off_center` solo en ángulo **frontal** (tolerancia `0.10`); en perfiles izquierda/derecha no se exige centrado.
   - `wrong_pose` si la pose resuelta no coincide con `expectedEnrollmentPose(angle, mirrorSelfiePerspective)`.
   - `aligned` en caso correcto.
4. Si `aligned` y `autoCapture`: se exige mantener la posición `1500 ms` (countdown 3‑2‑1) antes de capturar.
5. Botón **Capturar ahora** fuerza la captura del ángulo actual (respaldo manual).

La identidad final siempre la valida el backend DJL; este gating es solo guía de UX. Perfil de captura: `enrollment` (ver [`face-recognition-config.md`](./face-recognition-config.md)).

## Espejo (selfie)

El `<video>` se muestra con `-scale-x-100`. El overlay invierte la coordenada X (`1 - centerX`) para alinear el recuadro con la imagen espejada.

El registro usa el mismo toggle **`mirrorSelfiePerspective`** del config de reto activo (`giga-face-challenge-config`):

| `mirrorSelfiePerspective` | Instrucción "gira a tu izquierda" | Pose detectada esperada |
|---------------------------|-----------------------------------|-------------------------|
| `true` (recomendado con video espejado) | Giro hacia la izquierda en pantalla | `right` (frame crudo) |
| `false` | Giro físico/cámara a la izquierda | `left` |

Archivos: [`facePoseResolver.ts`](../src/features/recognition/services/facePoseResolver.ts), [`faceAlignment.ts`](../src/features/recognition/services/faceAlignment.ts) (`evaluateEnrollmentAlignment`), [`useFaceEnrollment.ts`](../src/features/personnel/hooks/useFaceEnrollment.ts).

La pose se resuelve con `resolveFacePose` (landmarks 2D o yaw 3D según `usePose3d` y umbrales del reto).

## Registro (sin cambios de backend)

- Existente: `registerMultiAngleFaceForExistingUser(username, password, {front,left,right})`.
- Nuevo: `createUserAndRegisterMultiAngleFace(...)` en [`registrationService.ts`](../src/features/personnel/services/registrationService.ts) → `createUser` y luego el mismo endpoint multiángulo con `username` + `password` en texto plano (el backend aplica el hash al comparar, igual que el flujo Existente).
- Endpoint: `POST /api/face-data/photo/enroll/multi-angle`.

## Accesibilidad

- `aria-live="polite"` en el estado de la cámara.
- `role="tablist"` + `aria-selected` + navegación con flechas en los modos.
- `aria-current="step"` en el stepper.
- `role="progressbar"` con `aria-valuenow/min/max` en el anillo.
- `aria-label` en el `<video>`; overlays decorativos con `aria-hidden`.
- Toggle de contraseña con `aria-pressed` y `aria-label`.

## Resiliencia de cámara

- Permiso denegado (`NotAllowedError`/`SecurityError`) ⇒ pantalla con botón **Reintentar** (`retryCamera`).
- Selector de cámara con `enumerateDevices` cuando hay más de un `videoinput` (`selectDevice`).

## Configuracion admin interactiva

Ruta: `/admin/configuracion-facial` ([`AdminFaceCoveragePage`](../src/features/settings/pages/AdminFaceCoveragePage.tsx))

Permite ajustar la cobertura minima del rostro (ancho %) por flujo con preview en vivo, slider 15–45%, presets y guardado en **localStorage**.

| Clave | Valor |
|-------|-------|
| `localStorage` | `giga-face-coverage-config` |
| Evento sync | `giga-face-coverage-config-changed` |

### Defaults por flujo

| Flujo | `targetWidthPercent` | `upperWidthRatio` |
|-------|---------------------|-------------------|
| Marcacion (`attendance`) | 20% | 1.35 (default) |
| Registro (`registration`) | 25% | 1.35 (default) |

Presets: Lejano 20%, Estandar 25%, Estricto 35%.

Servicio: [`faceAlignmentConfig.ts`](../src/features/recognition/services/faceAlignmentConfig.ts)  
Hook reactivo: [`useFaceCoverageConfig.ts`](../src/features/recognition/hooks/useFaceCoverageConfig.ts)

## Guia en vivo compartida (registro + marcacion)

La logica de alineacion del rostro vive en [`recognition/services/faceAlignment.ts`](../src/features/recognition/services/faceAlignment.ts) y se reutiliza en registro y marcacion:

| Constante | Valor | Efecto |
|-----------|-------|--------|
| `minFaceWidth` | configurable (default 20% marcacion / 25% registro) | Rostro demasiado lejos → `too_far` |
| `maxFaceWidth` | `min(objetivo × upperWidthRatio, 75%)` | Rostro demasiado cerca → `too_close` |
| `upperWidthRatio` | configurable 1.1–1.6 (default 1.35) | Tolerancia hacia camara en panel admin |
| `targetWidthPercent` | igual a `minFaceWidth × 100` | Objetivo visible en UI y mensajes |

- `getFaceWidthPercent(box)` → porcentaje entero (solo diagnóstico admin).
- `evaluateFaceAlignment(box, pose, expectedPose)` → estados de alineacion. Pasar `expectedPose = null` omite el chequeo de pose (marcacion).
- `faceAlignmentMessage(alignment)` → mensajes cortos sin porcentajes (*"Acercate un poco"*, *"Perfecto, manten la posicion"*).
- `faceAlignmentDiagnosticMessage(...)` → incluye %; solo en preview admin.
- [`FacePositionGuide`](../src/features/recognition/components/FacePositionGuide.tsx): óvalo + flechas + barra de zonas según `faceGuide` en config.

### Marcacion de asistencia

En [`AttendanceMarker`](../src/features/attendance/components/AttendanceMarker.tsx):

- `FacePositionGuide` + `FaceBoxOverlay` (opcional) sobre el video.
- Mensajes sin porcentaje en la region `aria-live="polite"`.
- La identificacion solo dispara cuando `alignment === 'aligned'` (ancho >= 25%, centrado). El video no se espeja (kiosko).
- Overlay [`ProcessingOverlay`](../src/components/ui/ProcessingOverlay.tsx) durante captura/procesamiento con fases `capturing` → `identifying` → `confirming` y progreso estimado 0–100%.

#### Camara tras identificacion (terminal `/terminal`)

| Evento | Camara | UX |
|--------|--------|-----|
| Identificacion exitosa (online u offline) | Se apaga el stream de inmediato | Preview estatico de la foto capturada en el contenedor de video + miniatura circular en el modal de confirmacion |
| Cancelar en modal identificado | Se re-enciende automaticamente | Retoma deteccion sin pasos extra |
| Confirmar → resultado → Entendido | Permanece apagada | La siguiente persona pulsa Encender camara |
| Rostro no reconocido / revalidacion | Sin cambio | La camara sigue activa para reintentar |

- Tras un match, `setIdentifiedWithPreview` guarda el `Blob` capturado, crea una URL de preview y llama a `stopCameraStream` (libera tracks sin limpiar la identidad).
- Se elimino el watcher post-identificacion (`IDENTIFICATION_STALE_MS`); la confirmacion usa la foto ya capturada, no el video en vivo.
- El boton Encender/Apagar camara se oculta mientras el modal de identificacion esta abierto.
- Mensaje de estado durante confirmacion: *"Rostro identificado. Confirma tu marcacion en el dialogo."*

## Loader de captura (alta resolucion)

Evita la sensacion de pagina congelada al procesar fotos en canvas.

| Pieza | Rol |
|-------|-----|
| [`ProcessingOverlay.tsx`](../src/components/ui/ProcessingOverlay.tsx) | Overlay fullscreen o sobre el video: spinner, mensaje, barra y % |
| [`yieldToUi.ts`](../src/utils/yieldToUi.ts) | Doble `requestAnimationFrame` antes del trabajo pesado para que React pinte el loader |
| [`monotonicProgress.ts`](../src/utils/monotonicProgress.ts) | Progreso que nunca retrocede |
| [`cameraEvidence.ts`](../src/features/recognition/services/cameraEvidence.ts) | `captureFacePhoto(..., onProgress?)` reporta % por etapa |

### Progreso estimado por etapa

| Etapa | % |
|-------|---|
| Inicio / yield UI | 5 |
| Frame en canvas | 35 |
| Mejora de luz | 55 |
| Compresion JPEG (1–4 iteraciones) | 60–85 |
| Blob listo | 90 |
| API (identificar / confirmar) | 95–100 |

### Integracion

- **Marcacion:** overlay viewport; modales de confirmacion en `z-[80]`, overlay en `z-[70]`.
- **Registro (captura):** overlay `scope="container"` sobre el video en `CameraStage`.
- **Registro (submit):** overlay viewport en `AdminRegistration` mientras `busy`.

### Camara

En [`faceCaptureConfig.ts`](../src/config/faceCaptureConfig.ts): `max 1280×720` en `FACE_CAMERA_CONSTRAINTS` para evitar streams 4K innecesarios.

## Build verification (2026-06-24)

- `npm run build` (tsc + vite) — OK
- Cambio: camara se apaga tras identificacion facial en terminal; preview estatico + re-encendido automatico al cancelar confirmacion.

## Build verification (2026-06-25)

- `npm run build` — OK
- Banda too_close: `maxFaceWidth = min(objetivo x upperWidthRatio, 75%)`; alineacion previa al reto documentada en `face-recognition-active-challenge.md`.
- Ratio superior configurable por flujo (`upperWidthRatio`) en Configuracion facial.
- Centrado frontal: tolerancia fija `centerToleranceFront = 0.10` (±10% del frame). Reemplaza tanto el 16% previo (demasiado permisivo) como el ajuste a silueta (demasiado estricto, ~1.5% de margen).
- Giros laterales en registro: `evaluateEnrollmentAlignment` + `resolveFacePose` + `mirrorSelfiePerspective` del config de reto activo.

## Build verification (2026-06-25, giros registro)

- `npm run build` — OK

## Build verification (2026-06-23)

- `npx tsc --noEmit` — OK
- `npx vite build` — OK (warning preexistente por el wasm de onnxruntime)
