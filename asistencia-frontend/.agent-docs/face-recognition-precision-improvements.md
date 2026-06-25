# Face recognition precision improvements (C + A + E)

Date: 2026-06-24. Goal: reduce misidentifications and build the foundation for
data-driven (AI-assisted) precision tuning.

This work spans three repos:

- `ispadmin-backend` (core: matching, logging, tuning, swappable model)
- `asistencia-frontend` (offline web embedding model made swappable, in lockstep)
- `IpsAdmin` (Android: only sends photos — capture quality raised)

---

## Frontend — ArcFace offline sync (2026-06-24)

- `FACE_EMBEDDING_MODEL` apunta a `/models/face-feature/arcface_w600k_mbf.onnx` (112x112, mean/std 0.5).
- `arcFaceAlignment.ts`: alineacion 5 puntos Umeyama + L2 normalize post-inferencia.
- `localFaceDescriptor.ts`: usa keypoints MediaPipe + comisuras estimadas; pipeline simplificado.
- `FaceBoxOverlay`: ovalo guia persistente con color segun alineacion.
- Modelo ONNX copiado desde backend a `public/models/face-feature/`.

Tras desplegar: re-descargar dataset offline y re-enrolar usuarios si aun no usan ArcFace 512-D.

---

## C — Structured matching logging (for later AI analysis)

**Why:** every misidentification leaves a trace (scores of the top users, margin,
quality of the photo). Logging it in a machine-parseable form lets us (or an AI)
later recalibrate thresholds, detect confusable user pairs, and decide whether the
model swap is worth it.

### What was added (backend)

- `FaceRecognitionMetricsLogger` — emits one **JSON line per decision** under the
  SLF4J logger `FACE_RECOGNITION_METRICS`.
- `logback-spring.xml` — dedicated rolling file appender
  `${LOG_DIR}/${LOG_FILE}-face-metrics.log` (90 days history), isolated from app logs.
- `FacePhotoQualityService.evaluate()` — now returns the intermediate quality metrics
  (brightness / skin ratio / edge ratio / dimensions) instead of just a boolean.
- `FaceVerifyService.findBestMatch` — builds a ranked top-N of candidate users and logs it.
- Toggle: `face.recognition.metrics.enabled` (default `true`), `face.recognition.metrics.ranked-top-n` (default `5`).

### Record schemas

`event: "face_match"` (one per descriptor compared against the dataset):

```json
{
  "event": "face_match",
  "timestampMillis": 0,
  "source": "attendance-verify-photo-djl-primary",
  "metric": "COSINE_SIMILARITY",
  "threshold": 0.82,
  "minMargin": 0.06,
  "decision": "MATCHED | REJECTED",
  "reason": "OK | BELOW_THRESHOLD | LOW_MARGIN | NO_EMBEDDINGS | DIMENSION_MISMATCH | USER_NOT_FOUND",
  "descriptorSize": 512,
  "datasetUsers": 42,
  "datasetEmbeddings": 126,
  "best":   { "userId": 10, "score": 0.91, "angle": "FRONT", "faceDataId": 55 },
  "second": { "userId": 7,  "score": 0.86, "angle": "LEFT",  "faceDataId": 31 },
  "margin": 0.05,
  "ranked": [ { "userId": 10, "score": 0.91, "angle": "FRONT", "faceDataId": 55 }, ... ],
  "elapsedMs": 12
}
```

`event: "face_photo_outcome"` (one per identify/verify-by-photo request, includes image quality):

```json
{
  "event": "face_photo_outcome",
  "flow": "attendance-identify-photo-djl",
  "matched": true,
  "reason": "OK | NO_CLEAR_FACE | NO_DESCRIPTOR | NOT_RECOGNIZED | EXPIRED",
  "userId": 10,
  "score": 0.91,
  "metric": "COSINE_SIMILARITY",
  "threshold": 0.82,
  "descriptorSize": 512,
  "usedFallback": false,
  "photoBytes": 184320,
  "quality": { "valid": true, "width": 720, "height": 720, "brightness": 121.4, "skinRatio": 0.21, "edgeRatio": 0.04 },
  "elapsedMs": 38
}
```

### How an AI/analyst uses it

- **Threshold/margin calibration:** histogram of `best.score` for MATCHED vs the
  `second.score` gap; find the operating point that separates true vs false matches.
- **Confusable pairs:** group records where `margin` is small → recurring `(best.userId, second.userId)`
  pairs are candidates for extra enrollment angles or manual review.
- **Quality correlation:** join `face_photo_outcome.quality` with wrong matches to set
  better quality gates / capture guidance.
- **Fallback usage:** high `usedFallback` rate signals detector/alignment issues.

---

## A — Threshold & margin tuning

`application-dev.properties` / `application-prod.properties`:

| Property | Before | After |
|----------|--------|-------|
| `matching.photo-similarity-threshold` | 0.78 | **0.82** |
| `matching.photo-min-margin` | 0.03 | **0.06** |
| `matching.offline-threshold` | 0.82 | **0.84** |
| `matching.offline-min-margin` | 0.04 | **0.06** |
| `detector.min-face-width-ratio` | 0.15 | **0.20** |

Rationale: the inter-user margin was the weakest guard (0.03). Doubling it makes the
system **abstain** when two users are nearly tied, which is the safe behavior for
attendance. Tune further with the C metrics once real data accumulates.

---

## E — Swappable embedding model (ArcFace/InsightFace ready)

The actual model swap is **destructive** (new vector space ⇒ all stored embeddings
become unusable ⇒ everyone must re-enroll) and its accuracy can only be validated with
real captures. Therefore it is implemented as a **config-gated, ready-to-flip capability**,
defaulting to the current PyTorch model so nothing changes until deliberately enabled.

### What was added (backend)

- `FaceEmbeddingProperties` (`face.embedding.*`): engine, model path/name, input size,
  alignment, normalization, metric, L2.
- `FacePhotoDescriptorService.loadModel()` branches PyTorch (current) vs `OnnxRuntime` (ArcFace).
- `ArcFaceFeatureTranslator` — ONNX preprocessing (resize → CHW → `(x/255-mean)/std` → optional L2).
- `ArcFaceLandmarkAligner` — correct ArcFace 5-point alignment via a closed-form 2D
  similarity transform (least squares) onto the canonical 112×112 template.
- `FacePhotoPreprocessorService` chooses the aligner from `face.embedding.alignment`.
- `pom.xml`: added `ai.djl.onnxruntime:onnxruntime-engine`.
- Model downloaded: `src/main/resources/models/arcface_w600k_mbf.onnx`
  (InsightFace buffalo_s recognition, MobileFaceNet, 112×112 input, 512-d output, ~13.6 MB).

### What was added (web — lockstep)

- `FACE_EMBEDDING_MODEL` in `faceCaptureConfig.ts` (modelUrl / inputSize / normalize),
  default identical to the current 224×224 model.
- `localFaceDescriptor.ts` reads those params (no behavior change at default).

### How to flip to ArcFace (deliberate migration)

1. **Backend** — set in both properties files:
   ```
   face.embedding.engine=OnnxRuntime
   face.embedding.model-path=classpath:models/arcface_w600k_mbf.onnx
   face.embedding.model-name=arcface_w600k_mbf
   face.embedding.input-size=112
   face.embedding.alignment=ARCFACE
   face.embedding.normalize=0.5,0.5,0.5,0.5,0.5,0.5
   face.embedding.l2-normalize=true
   ```
2. **Validate accuracy** with a labeled sample set BEFORE production (the metrics file
   tells you the true/false score separation). Re-tune `photo-similarity-threshold` /
   `photo-min-margin` for the new cosine distribution.
3. **Invalidate old embeddings:** `POST /api/face-data/admin/reset-embeddings?confirm=DELETE_ALL_FACE_DATA`.
4. **Re-enroll everyone** (multi-angle endpoint `/api/face-data/photo/enroll/multi-angle`).
5. **Web offline (only if used offline):** the probe embedding is computed in the browser,
   so it MUST match the backend. Export/serve the same ArcFace model at
   `/models/face-feature/arcface_w600k_mbf.onnx`, set `FACE_EMBEDDING_MODEL` to
   `inputSize: 112, normalizeMean: 0.5, normalizeStd: 0.5`, and replicate the backend
   5-point alignment. ⚠️ BlazeFace gives only ~6 keypoints (no two mouth corners), so
   exact parity with the backend's ultranet 5-point alignment needs care — validate before enabling offline.
6. **Android:** no change required (it only sends photos). Capture quality was already
   raised to 720px / 88% to feed the model better detail.

### Why not flip now

- No labeled test set in-repo to verify the swap improves (a wrong alignment/normalization
  would degrade accuracy silently).
- Locks out all users until re-enrollment.
- Offline web parity needs validation.

The C metrics are exactly what makes a safe, data-backed flip possible later.

---

## Build verification (2026-06-24)

- Backend: `sh mvnw -q -DskipTests compile` — OK
- Web: `npx tsc --noEmit` — OK
- Android: `./gradlew :presentation:compileDevDebugSources` — FAILED on pre-existing,
  unrelated errors in the subscription-register feature; the face capture constant change
  is valid and unaffected.

## Dev deploy + ArcFace verification (2026-06-24)

Local deploy with ArcFace enabled in `application-dev.properties`:

```bash
cd IdeaProjects/ispadmin-backend
bash run-dev.sh
```

Startup: `Cargando modelo facial ONNX (ArcFace) desde classpath:models/arcface_w600k_mbf.onnx` → `Motor facial DJL listo para generar descriptores.` (CUDA warning on Mac is normal; CPU inference works.)

Functional test:

```bash
curl -s -X POST "http://localhost:8080/ispadmin/api/face-data/photo/check" \
  -F "photo=@face.jpg"
# {"valid":true,"descriptorSize":512,"message":"Rostro detectado."}
```

`run-dev.sh` fixed to use `sh mvnw` (execute permission on `./mvnw` was missing).

## Production deploy (2026-06-24)

Deployed to `212.85.13.47:8080/ispadmin` with ArcFace active (`application-prod.properties`).

```bash
cd IdeaProjects/ispadmin-backend
bash scripts/deploy.sh --deploy   # build + WAR
# ONNX/PyTorch JARs must live in CATALINA_HOME/lib (not inside the WAR)
bash scripts/deploy.sh --full     # upload tomcat-lib + rebuild container (first time / lib changes)
```

Production verification:

```bash
curl -s http://212.85.13.47:8080/ispadmin/api/face-data/admin/embedding-inventory
curl -s -X POST http://212.85.13.47:8080/ispadmin/api/face-data/photo/check -F "photo=@face.jpg"
# {"valid":true,"descriptorSize":512,"message":"Rostro detectado."}
```

Logs: `Cargando modelo facial ONNX (ArcFace)...` + `Motor facial DJL listo`.

Fixes applied for Tomcat: `onnxruntime-engine` + `onnxruntime` copied to `target/tomcat-lib`; `PytorchNativeHelper` restored as **Java** (Kotlin stdlib is not on the Tomcat shared classloader). Quote special characters in `scripts/deploy.config.local` (`DEPLOY_SSH_PASSWORD='...'`).
