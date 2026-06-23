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
| [`registration/CameraStage.tsx`](../src/features/personnel/components/registration/CameraStage.tsx) | Video 16:9 espejado (selfie) + overlay + indicador de cobertura + región de estado `aria-live` + selector de cámara + estado de permiso denegado. |
| [`recognition/components/FaceBoxOverlay.tsx`](../src/features/recognition/components/FaceBoxOverlay.tsx) | Dibuja el `box` real del rostro (MediaPipe) en vivo; color por estado (buscando/alineado/aviso). |
| [`recognition/components/FaceCoverageIndicator.tsx`](../src/features/recognition/components/FaceCoverageIndicator.tsx) | Badge en vivo con % de ancho del rostro, barra hacia objetivo 25% y colores por estado. |
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
3. Con `box`: `evaluateFaceAlignment(box, pose, angle)`:
   - `too_far` / `too_close` por **ancho del rostro** (`minFaceWidth: 0.25` = 25%, `maxFaceWidth: 0.75` = 75%).
   - `off_center` por centrado (tolerancia `0.16` frontal, `0.30` en giros).
   - `wrong_pose` si la pose no coincide con el ángulo objetivo.
   - `aligned` en caso correcto.
4. Si `aligned` y `autoCapture`: se exige mantener la posición `1500 ms` (countdown 3‑2‑1) antes de capturar.
5. Botón **Capturar ahora** fuerza la captura del ángulo actual (respaldo manual).

La identidad final siempre la valida el backend DJL; este gating es solo guía de UX. Perfil de captura: `enrollment` (ver [`face-recognition-config.md`](./face-recognition-config.md)).

## Espejo (selfie)

El `<video>` se muestra con `-scale-x-100`. El overlay invierte la coordenada X (`1 - centerX`) para alinear el recuadro con la imagen espejada. La detección de pose usa el frame crudo (sin espejo), por lo que las instrucciones izquierda/derecha mantienen el mismo comportamiento físico que ya validaba el backend.

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

| Flujo | `targetWidthPercent` |
|-------|---------------------|
| Marcacion (`attendance`) | 20% |
| Registro (`registration`) | 25% |

Presets: Lejano 20%, Estandar 25%, Estricto 35%.

Servicio: [`faceAlignmentConfig.ts`](../src/features/recognition/services/faceAlignmentConfig.ts)  
Hook reactivo: [`useFaceCoverageConfig.ts`](../src/features/recognition/hooks/useFaceCoverageConfig.ts)

## Guia en vivo compartida (registro + marcacion)

La logica de alineacion del rostro vive en [`recognition/services/faceAlignment.ts`](../src/features/recognition/services/faceAlignment.ts) y se reutiliza en registro y marcacion:

| Constante | Valor | Efecto |
|-----------|-------|--------|
| `minFaceWidth` | configurable (default 20% marcacion / 25% registro) | Rostro demasiado lejos → `too_far` |
| `maxFaceWidth` | **0.75** (75%) | Rostro demasiado cerca → `too_close` |
| `targetWidthPercent` | igual a `minFaceWidth × 100` | Objetivo visible en UI y mensajes |

- `getFaceWidthPercent(box)` → porcentaje entero del ancho del rostro sobre el frame.
- `evaluateFaceAlignment(box, pose, expectedPose)` → estados de alineacion. Pasar `expectedPose = null` omite el chequeo de pose (marcacion).
- `faceAlignmentMessage(alignment, { widthPercent })` → mensaje con dato en vivo, ej. *"Rostro al 18% de ancho. Objetivo: 25%. Acercate."*
- [`FaceBoxOverlay`](../src/features/recognition/components/FaceBoxOverlay.tsx): box real del rostro con color por estado.
- [`FaceCoverageIndicator`](../src/features/recognition/components/FaceCoverageIndicator.tsx): badge superpuesto con % en vivo y barra con marca en 25%.

### Marcacion de asistencia

En [`AttendanceMarker`](../src/features/attendance/components/AttendanceMarker.tsx):

- `FaceBoxOverlay` + `FaceCoverageIndicator` en vivo sobre el video.
- Mensajes con porcentaje en la region `aria-live="polite"`.
- La identificacion solo dispara cuando `alignment === 'aligned'` (ancho >= 25%, centrado). El video no se espeja (kiosko).

## Build verification (2026-06-23)

- `npx tsc --noEmit` — OK
- `npx vite build` — OK (warning preexistente por el wasm de onnxruntime)
