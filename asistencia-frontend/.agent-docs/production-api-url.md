# URL de producción — Asistencias Frontend

**Fecha de migración**: 2026-07-04

## URL actual

```
https://api.gigafiberperu.cloud/ispadmin
```

## URL anterior

```
http://212.85.13.47:8080/ispadmin
```

El puerto 8080 fue restringido a `127.0.0.1` en el VPS después de activar HTTPS.
La URL anterior dejó de funcionar externamente tras el cambio.

## Archivo de configuración

`asistencia-frontend/.env`:

```dotenv
VITE_API_BASE_URL=https://api.gigafiberperu.cloud/ispadmin
```

## Tras cambiar la URL

Requiere rebuild y redespliegue del frontend:

```bash
cd asistencia-frontend
npm run build
# Copiar dist/ al servidor donde se sirve el SPA
```

## Verificación

Marcar asistencia con reconocimiento facial y confirmar que el registro llega al backend
(`GET /ispadmin/api/face-data/admin/embedding-inventory` debe responder 200).
