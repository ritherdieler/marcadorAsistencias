# Autenticacion por token (Bearer + refresh)

Build verified: `npm run build` (2026-07-13).

> **Proyecto interno — no se despliega en subdominio publico.** Asistencias es de uso interno:
> adopta esta autenticacion por token, pero **no** se publica en `asistencias.gigafiberperu.cloud`
> ni lleva SSL. Su acceso/distribucion es interno. (El backend `api.gigafiberperu.cloud/ispadmin`
> que consume si es publico.)

## Contrato del backend

- `POST /users/login` (`{username, password: SHA-384}`) devuelve `UserDto` con `accessToken` y `refreshToken`.
- Todas las demas llamadas requieren `Authorization: Bearer <accessToken>`.
- En `401`: `POST /users/token/refresh` (`{refreshToken}`) devuelve `{accessToken, refreshToken}`; se reintenta la request original.
- Rutas publicas (sin token): `/users/login`, `/users/token/refresh`.

## Persistencia (`localStorage`)

- `auth_token`: access token vigente.
- `refresh_token`: refresh token vigente.
- `auth_user`: usuario logueado (incluye tokens en el objeto User).

## Cambios

- `src/types/user.ts`: `User` incluye `accessToken` y `refreshToken` opcionales.
- `src/features/auth/utils/authStorage.ts`: nuevos `setAuthTokens()` y `getRefreshToken()`; `clearAuth()` borra `auth_token` y `refresh_token`.
- `src/services/authService.ts`: tras el login guarda tokens con `setAuthTokens(data.accessToken, data.refreshToken)`.
- `src/services/httpClient.ts`:
  - Request interceptor agrega `Bearer` solo si la ruta no es publica.
  - Response interceptor maneja `401`: refresh con single-flight (`refreshPromise`), actualiza tokens y reintenta la request original una sola vez (flag `_retry`). Si el refresh falla: `clearAuth()` + redireccion a `/login`.
  - El refresh usa `axios.post` directo (sin interceptores) para evitar Bearer invalido y bucles.
- `src/services/localAppData.ts`: `refresh_token` agregado a las claves de limpieza.

## Flujo 401

1. Request con `Bearer` vencido -> `401`.
2. Se llama `/users/token/refresh` (una sola vez concurrente).
3. Exito: se guardan `auth_token`/`refresh_token`, se reintenta la request original con el nuevo token.
4. Fallo: `clearAuth()` y `window.location.assign('/login')`.
