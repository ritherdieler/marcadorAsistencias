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
