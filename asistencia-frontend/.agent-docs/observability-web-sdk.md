# SDK web de observabilidad (Fase 2 + Fase 3 web)

Integracion del hub de observabilidad in-house en `asistencia-frontend`. Captura errores JS, rechazos de promesas, errores HTTP de axios, breadcrumbs y Session Replay (rrweb), con envio por lotes al backend y degradacion silenciosa. **Bloquea por completo las vistas biometricas en el replay.**

## Ubicacion

- SDK autocontenido (mismo codigo en backoffice y asistencias): `src/lib/observability/`
- Bootstrap especifico del repo: `src/observability.ts` (importado al inicio de `src/main.tsx`)
- ErrorBoundary nuevo: `src/components/ui/ErrorBoundary.tsx` (envuelve la app en `main.tsx`)

## Modulos del SDK

| Archivo | Responsabilidad |
|---------|-----------------|
| `types.ts` | Tipos del contrato (`ObsEvent`, `ObsConfig`, severidades, plataformas) |
| `env.ts` | `readObsEnv(platform)` lee `import.meta.env` (`VITE_OBS_*`) |
| `ids.ts` | Correlation id por request y session id persistido en `sessionStorage` |
| `breadcrumbs.ts` | Buffer circular de breadcrumbs |
| `context.ts` | Contexto: device, userAgent, url, usuario normalizado (solo campos seguros) |
| `gzip.ts` | Compresion gzip via `CompressionStream` |
| `transport.ts` | `POST /observability/events` (fetch) y `POST /observability/replays` (multipart) |
| `queue.ts` | Cola + envio por lotes + flush con `fetch keepalive` / `sendBeacon` al cerrar |
| `replay.ts` | Grabacion rrweb con buffer circular (~90s, checkout), masking |
| `axiosIntegration.ts` | Interceptores axios: adjunta `X-Correlation-Id`, captura errores HTTP |
| `globalHandlers.ts` | `window.onerror`, `unhandledrejection`, breadcrumbs de clic/navegacion, flush al ocultar |
| `client.ts` | Orquesta captura, contexto, replay on-error y cola |
| `webVitals.ts` | Captura de Web Vitals (RUM, Fase 11): `initWebVitals` con `onLCP/onINP/onCLS/onFCP/onTTFB`, cola por `page` y flush por lotes a `POST /observability/rum` |
| `index.ts` | API publica: `initObservability`, `initWebVitals`, `captureException`, `captureMessage`, `addBreadcrumb`, `installAxiosObservability` |

## Contrato del backend (respetado al 100%)

- Base URL: `VITE_OBS_BASE_URL`, endpoints bajo `/observability`.
- Header obligatorio en todo `/observability/**`: `X-Obs-Api-Key`. Header opcional `X-Correlation-Id`.
- `POST /observability/events`: body `{ events: ObsEvent[] }`, respuesta 202.
- `POST /observability/replays`: multipart campo `file` (gzip) + query `sessionId, eventId, platform, durationMs`. Respuesta 201 `{ id }`. El `id` se reenvia como `replayId` en el evento. Limite 15 MB.
- `POST /observability/rum`: body `{ vitals: [{ metricName, value, rating, page, navigationType, timestamp }] }`, respuesta 202 `{ accepted, rejected }` (ver Web Vitals).

## Web Vitals (RUM, Fase 11)

- `webVitals.ts` usa la librería `web-vitals` (`onLCP/onINP/onCLS/onFCP/onTTFB`) para medir LCP, INP, CLS, FCP y TTFB.
- Cada medición se encola con `page = window.location.pathname`, el `rating` (good/needs-improvement/poor) y el `navigationType` que reporta `web-vitals`.
- El envío es por lotes al ocultar la pestaña (`visibilitychange` → `hidden`) y en `pagehide`, usando `fetch` con `keepalive` (o `navigator.sendBeacon` como fallback) contra `POST /observability/rum` con el header `X-Obs-Api-Key`.
- Degradacion silenciosa: si `enabled === false` o faltan `baseUrl`/`apiKey`, o si no hay `window`/`document`, `initWebVitals` no hace nada.
- Se inicializa desde `src/observability.ts` con `initWebVitals(env)` (misma config `ObsConfig` que `initObservability`).
- El backend agrega estas mediciones por bucket/pagina/metrica y las expone en `GET /observability/metrics/web-vitals` (ver `observability-fase11-rum.md` en el backend).

## Integracion en asistencias

- `src/observability.ts` inicializa el SDK con `platform: 'web-asistencias'`, usuario desde `getAuthUser()` (`localStorage['auth_user']`) y replay activo. Instala los interceptores en la instancia `http` de `src/services/httpClient.ts`.
- Se crea `ErrorBoundary` (no existia) y envuelve el arbol en `src/main.tsx`; reporta el crash con severidad `fatal`.

## Privacidad biometrica (obligatorio)

No se capturan payloads/imagenes/embeddings de los flujos biometricos. El Session Replay usa `blockClass: 'rr-block'`. Se agrego la clase `rr-block` al nodo raiz de:

- `features/attendance/components/AttendanceMarker.tsx`
- `features/personnel/components/registration/CameraStage.tsx`
- `features/settings/components/FaceCoveragePreview.tsx`
- `features/personnel/components/registration/CapturedThumbnails.tsx` (miniaturas de rostro)

Ademas, el interceptor axios solo registra metodo, ruta (sin query string), status y duracion; nunca cuerpos de request/response, por lo que no se filtran embeddings ni fotos enviadas a los endpoints faciales.

## Session Replay

- rrweb con buffer circular de dos segmentos (~90s), `checkoutEveryNms`, `maskAllInputs: true`, `blockClass: 'rr-block'`, `maskTextClass: 'rr-mask'`, `recordCanvas: false`, `inlineImages: false`.
- Al capturar un error/crash se comprime (gzip) el buffer y se sube a `/observability/replays`; el `id` devuelto viaja como `replayId`. Throttle: max 10 replays por sesion, minimo 5s entre subidas, limite 15 MB.

## Variables de entorno (`.env`, `.env.development`, `.env.production`)

| Variable | Descripcion | Dev | Prod |
|----------|-------------|-----|------|
| `VITE_OBS_BASE_URL` | URL base del hub (hoy = backend actual) | `http://localhost:8080/ispadmin` | `https://api.gigafiberperu.cloud/ispadmin` |
| `VITE_OBS_WS_URL` | WebSocket del hub (para el dashboard) | `http://localhost:8080/ispadmin/ws` | `https://api.gigafiberperu.cloud/ispadmin/ws` |
| `VITE_OBS_API_KEY` | API key por plataforma | `dev-obs-asistencias-key` | reemplazar en prod |
| `VITE_OBS_ENABLED` | (opcional) `false` desactiva el SDK | - | - |
| `VITE_OBS_ENVIRONMENT` | (opcional) fuerza `prod/dev/local` | - | - |
| `VITE_OBS_RELEASE` | (opcional) etiqueta de release | - | - |

Si falta `VITE_OBS_BASE_URL` o `VITE_OBS_API_KEY`, el SDK no se inicializa (degradacion silenciosa).

## Portabilidad (extraccion futura del hub)

La URL de observabilidad es una variable separada de la del backend. Al extraer el hub a un servicio propio solo se cambia `VITE_OBS_BASE_URL` (y `VITE_OBS_WS_URL`), sin tocar codigo.

## Dependencias agregadas

- `rrweb@^2.1.0`
- `web-vitals@^5.3.0` (captura de RUM Web Vitals, Fase 11)

## Verificacion

```bash
npm run build
```

OK 2026-07-11.
