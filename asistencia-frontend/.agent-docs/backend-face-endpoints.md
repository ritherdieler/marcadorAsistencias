# Backend for face endpoints

## Issue

`POST /ispadmin/api/face-data/photo/check` returned 404 when running `wispadministrator`.

## Cause

Face recognition APIs live in `IdeaProjects/ispadmin-backend`, not in `wispadministrator`.

## Fix

1. Stop backend on port 8080 if it is `wispadministrator`.
2. Start `ispadmin-backend` with dev profile:

```bash
cd /Users/sergiocarrillo/IdeaProjects/ispadmin-backend
bash mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

3. Model paths in `application-dev.properties` point to:

- `src/main/kotlin/com/dscorp/wispadmin/wispadmin/util/models/face_feature.zip`
- `src/main/kotlin/com/dscorp/wispadmin/wispadmin/util/models/ultranet.zip`

## Verified

`POST /ispadmin/api/face-data/photo/check` returns HTTP 200 (not 404).

## Admin / migration endpoints (added 2026-06-24)

Controller: `FaceDataController` (`/api/face-data`).

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/face-data/admin/embedding-inventory` | Counts embeddings/users grouped by descriptor size. Used during a model migration to see how many users are still on the old vector space. |
| `POST` | `/api/face-data/admin/reset-embeddings?confirm=DELETE_ALL_FACE_DATA` | Deletes ALL `face_data` rows and clears the match cache. Forces every user to re-enroll. Required when swapping the embedding model (`face.embedding.*`). Guarded by the exact `confirm` token. |

Example:

```bash
# Inventory before/after a migration
curl http://localhost:8080/ispadmin/api/face-data/admin/embedding-inventory

# Invalidate all faces (irreversible) right after flipping to ArcFace
curl -X POST "http://localhost:8080/ispadmin/api/face-data/admin/reset-embeddings?confirm=DELETE_ALL_FACE_DATA"
```

## Active challenge endpoint (Nivel B anti-spoofing, added 2026-06-24)

Controller: `FaceVerifyController` (`/api/face`).

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/face/challenge/start` | Issues a single-use `challengeId` (token) with short TTL. The web kiosk reads `enabled` on camera start and requests a fresh token after liveness passes. |

`/api/face/identify/photo` and `/api/face/verify/photo` now accept an optional `challengeToken` form field:

- `verify/photo` consumes the token (single-use) and rejects the marking with `challengeRequired=true` when it is missing/expired/invalid (only when `face.challenge.require-for-verify=true`).
- `identify/photo` is non-destructive: it only validates the token when `face.challenge.require-for-identify=true` (default `false`), so the live identification loop is not blocked.

See `face-recognition-active-challenge.md` for the full design.
