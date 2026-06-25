# Face recognition configuration

Unified capture and matching parameters across web (`asistencia-frontend`), Android (`IpsAdmin`), and backend (`ispadmin-backend`).

## Client capture profiles

| Profile | Use case | Max resolution | JPEG quality | Target file size |
|---------|----------|----------------|--------------|------------------|
| `enrollment` | Face registration / multi-angle | 1280×720 | 0.90 / 90% | 500 KB |
| `verification` | Attendance / identification / login | 960×720 | 0.85 / 85% | 350 KB |
| `evidence` | Audit photos after check-in/out | 640×480 | 0.80 / 80% | 200 KB |

### Web

- Config: [`src/config/faceCaptureConfig.ts`](../src/config/faceCaptureConfig.ts)
- Capture: [`src/features/recognition/services/cameraEvidence.ts`](../src/features/recognition/services/cameraEvidence.ts) → `captureFacePhoto(video, profile, onProgress?)`
- Camera constraints: `ideal/max 1280×720`, `min 640×480` via [`src/hooks/useCamera.ts`](../src/hooks/useCamera.ts)
- Capture progress: optional `onProgress(percent)` callback; monotonic 5→90 during canvas work, 95–100 during API phases in UI
- Adaptive compression: lowers JPEG quality in steps of 0.05 (min 0.70), then reduces resolution by 10% (max 3 iterations)

### Android

- Config: `presentation/.../data/media/FaceCaptureConfig.kt`
- Compressor: `presentation/.../data/media/FacePhotoCompressor.kt`
- Login screen uses `VERIFICATION` profile and camera target `1280×720`

## Backend DJL engine

Properties prefix: `face.recognition.*` in `application-dev.properties` / `application-prod.properties`.

Kotlin binding: `FaceRecognitionProperties` + `FaceRecognitionConfiguration`.

### Detector (ultranet)

| Property | Value |
|----------|-------|
| `detector.confidence-threshold` | 0.70 |
| `detector.nms-threshold` | 0.45 |
| `detector.face-margin-ratio` | 0.20 |
| `detector.min-face-width-ratio` | 0.20 (was 0.15 — stricter to reject distant/small faces) |

### Pre-upload quality gate

| Property | Value |
|----------|-------|
| `quality.min-image-size` | 160 |
| `quality.min-brightness` | 20 |
| `quality.max-brightness` | 230 |
| `quality.min-skin-ratio` | 0.008 |
| `quality.min-edge-ratio` | 0.005 |

### Matching (cosine similarity normalized to [0,1])

| Property | Value | Usage |
|----------|-------|-------|
| `matching.photo-similarity-threshold` | 0.82 (was 0.78) | Online photo identify/verify |
| `matching.photo-min-margin` | 0.06 (was 0.03) | Margin vs 2nd best **user** (not global embedding) |
| `matching.offline-threshold` | 0.84 (was 0.82) | Offline dataset endpoint |
| `matching.offline-min-margin` | 0.06 (was 0.04) | Offline margin vs 2nd best user |
| `matching.euclidean-threshold` | 0.48 | Legacy JSON descriptor endpoints |
| `matching.cache-ttl-ms` | 60000 | Embedding cache TTL |

> **Camino A (tuning 2026-06-24):** raised the similarity threshold and (especially) the
> inter-user margin to reduce misidentifications between similar faces. Higher margin means the
> system abstains (returns "no reconocido") when the top two users are too close, instead of
> guessing. Re-calibrate using the structured metrics file (see precision doc).

### Embedding model (swappable) — `face.embedding.*`

Kotlin binding: `FaceEmbeddingProperties`. Default reproduces the current PyTorch model exactly.

| Property | Default | Notes |
|----------|---------|-------|
| `engine` | `PyTorch` | `PyTorch` (current) or `OnnxRuntime` (ArcFace) |
| `model-path` | `classpath:models/face_feature.zip` | ArcFace: `classpath:models/arcface_w600k_mbf.onnx` |
| `model-name` | `face_feature` | |
| `input-size` | `224` | ArcFace: `112` |
| `alignment` | `LEGACY` | `LEGACY` (eye-distance) or `ARCFACE` (5-point Umeyama) |
| `normalize` | `0.498,...,0.502,...` | ArcFace: `0.5,0.5,0.5,0.5,0.5,0.5` |
| `metric` | `COSINE_SIMILARITY` | |
| `l2-normalize` | `false` | ArcFace: `true` recommended |

Switching to ArcFace is **destructive** (invalidates all stored embeddings → everyone re-enrolls).
See `face-recognition-precision-improvements.md`.

Matching groups embeddings by `userId` and keeps the best score per user (max across FRONT/LEFT/RIGHT templates). The safety margin compares the top user against the second-best **user**, avoiding false rejections when another angle of the same person ranks second.

Backend: `FaceVerifyService.findBestMatch`  
Offline web: `findBestOfflineFaceMatch` in [`src/services/offlineFaceDataset.ts`](../src/services/offlineFaceDataset.ts)

Offline dataset (`GET /api/face-data/offline-dataset`) exposes `threshold` and `minMargin` from these properties.

## Preprocessing pipeline (face-api.js approach)

Shared goal: detect → align → embed → compare per user.

### Backend landmark alignment

- Service: `FaceLandmarkAligner.kt`
- Triggered from `FacePhotoPreprocessorService.extractSingleFace` when ultranet returns a `Landmark` bbox (5 points: eyes + nose)
- Rotates/scales the face to a canonical 224×224 pose before JPEG encoding
- Fallback: bbox crop with `detector.face-margin-ratio` (0.20) when alignment fails

### Unified constants

| Constant | Backend | Web offline |
|----------|---------|-------------|
| Embedding input size | `FacePreprocessConstants.EMBEDDING_INPUT_SIZE = 224` | `FACE_PREPROCESS_INPUT_SIZE = 224` |
| Face margin ratio | `detector.face-margin-ratio = 0.20` | `FACE_PREPROCESS_MARGIN_RATIO = 0.20` |
| Center crop fallback specs | `FacePreprocessConstants.CENTER_CROP_SPECS` | `FACE_OFFLINE_CENTER_CROP_SPECS` |

Web offline descriptor generation: [`src/services/localFaceDescriptor.ts`](../src/services/localFaceDescriptor.ts)

- MediaPipe Face Landmarker (`detectFromImage`) + 5-point ArcFace alignment via [`faceLandmarkMapping.ts`](../src/features/recognition/services/faceLandmarkMapping.ts)
- Center-crop fallbacks when no face is detected
- Lighting variants for low-light robustness

See also: [`face-vision-unified.md`](face-vision-unified.md)

## Build verification (2026-06-23)

- Backend: `bash mvnw compile -DskipTests` — OK (landmark alignment + user-level matching)
- Web: `npm run build` — OK (unified offline preprocess + user-level offline match)
- Android: `./gradlew :presentation:compileDevDebugSources` — OK (prior session)

## Build verification (2026-06-24 — precision C/A/E)

- Backend: `sh mvnw -q -DskipTests compile` — OK (structured metrics logging + tuning + swappable ArcFace/ONNX engine + admin reset/inventory)
- Web: `npx tsc --noEmit` — OK (configurable embedding model params; default behavior unchanged)
- Android: `./gradlew :presentation:compileDevDebugSources` — **FAILED on pre-existing, unrelated errors** in `RegisterSubscriptionComposeViewModel.kt` / `RegisterSubscriptionScreen.kt` (subscription feature mid-refactor). The only face change (photo capture raised to 720px / 88% in `FaceLoginScreen.kt`) is unaffected and not part of the errors.

## Local data reset

Utility: [`src/services/localAppData.ts`](../src/services/localAppData.ts)

`clearAllLocalAppData()` removes:

- `localStorage`: `auth_user`, `auth_token`, `giga-attendance-checked-in-users`, `giga-face-offline-secret`
- IndexedDB: `giga-face-offline`, `giga-attendance-offline`

Triggered on:

- First app load after deploy (`ensureLocalDataReset` in `main.tsx`, version `face-recognition-config-v1`)
- Logout (`AdminLayout`)
