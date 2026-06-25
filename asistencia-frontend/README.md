# Asistencia Facial - Frontend

Frontend React + Tailwind para marcacion y administracion de asistencia.

## 1) Requisitos

- Node.js 18+
- Backend corriendo, por defecto en `http://localhost:8080/ispadmin`

## 2) Configuracion de backend

Crea un archivo `.env` en la raiz:

```bash
VITE_API_BASE_URL=http://localhost:8080/ispadmin
```

## 3) Flujo facial

El frontend no genera embeddings ni usa librerias faciales JavaScript.

- La camara captura una foto.
- La foto se envia al backend.
- El backend genera el descriptor con DJL.
- El backend compara contra `face_data`.
- El backend registra asistencia o salida.

## 4) Endpoints usados

- `POST /users/login`
- `POST /api/face-data/photo`
- `POST /api/face/identify/photo`
- `POST /api/face/verify/photo`
- `POST /api/face/evidence`

## 5) Ejecutar

```bash
npm install
npm run dev
```

Rutas principales:

- `http://localhost:5173/terminal`
- `http://localhost:5173/login`
- `http://localhost:5173/admin`

## Documentacion de features

Decisiones de implementacion y UX documentadas en [`.agent-docs/README.md`](.agent-docs/README.md).
