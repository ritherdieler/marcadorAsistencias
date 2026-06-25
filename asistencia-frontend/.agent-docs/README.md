# Indice de documentacion del agente

Documentacion tecnica de features implementadas en `asistencia-frontend`. Mantener actualizado al cerrar cada tarea (ver regla `.cursor/rules/agent-docs.mdc`).

## Vision facial (nucleo)

| Documento | Contenido |
|-----------|-----------|
| [`face-vision-unified.md`](face-vision-unified.md) | Arquitectura unificada: worker, MediaPipe, flujos marcacion/registro/admin |
| [`face-vision-unification-phase1.md`](face-vision-unification-phase1.md) | Fase 1 historica |
| [`face-vision-unification-phase2.md`](face-vision-unification-phase2.md) | Fase 2 historica |
| [`face-recognition-config.md`](face-recognition-config.md) | Config de captura y perfiles de foto |
| [`face-recognition-precision-improvements.md`](face-recognition-precision-improvements.md) | Mejoras de precision ArcFace / pipeline |

## UX de alineacion y cobertura

| Documento | Contenido |
|-----------|-----------|
| [`face-position-guide.md`](face-position-guide.md) | Silueta bancaria, scrim, anillo de cercania, banda too_far/too_close |
| [`face-registration-ux.md`](face-registration-ux.md) | Registro multiangulo, guia compartida, loader de captura, camara en terminal |
| [`face-landmarks-overlay.md`](face-landmarks-overlay.md) | Capas Face Mesh, estilos y toggles admin |

## Reto activo (liveness)

| Documento | Contenido |
|-----------|-----------|
| [`face-recognition-active-challenge.md`](face-recognition-active-challenge.md) | Nivel B: state machine, token backend, alineacion previa al reto |
| [`face-challenge-config.md`](face-challenge-config.md) | Config persistida `giga-face-challenge-config` |

## Infra y otros

| Documento | Contenido |
|-----------|-----------|
| [`backend-face-endpoints.md`](backend-face-endpoints.md) | Endpoints REST faciales del backend |
| [`network-status-ux.md`](network-status-ux.md) | Indicador online/offline y sincronizacion |
| [`login-sha384.md`](login-sha384.md) | Login con hash SHA-384 |
| [`vite-dev-cleanup.md`](vite-dev-cleanup.md) | Limpieza de cache Vite en dev |

## Cambios recientes (referencia rapida)

| Fecha | Feature | Docs actualizados |
|-------|---------|-------------------|
| 2026-06-25 | Guia estilo bancario (silueta SVG, scrim, anillo) | `face-position-guide.md` |
| 2026-06-25 | Alineacion obligatoria antes del reto activo | `face-vision-unified.md`, `face-recognition-active-challenge.md` |
| 2026-06-25 | Banda too_close = min(objetivo x 1.35, 75%) | `face-position-guide.md`, `face-registration-ux.md` |
| 2026-06-25 | `upperWidthRatio` configurable por flujo (admin) | `face-position-guide.md`, `face-registration-ux.md` |

## Verificacion habitual

```bash
npm run build
```

Registrar OK y fecha al final del doc modificado.
