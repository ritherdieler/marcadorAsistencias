# Config: quien marca asistencia (2026-09-15)

## Proposito

Permite marcar que personal **debe** usar el kiosko y aparecer en el reporte de faltas. Quien esta **exento** no puede completar marcacion en este navegador y no genera filas FALTO/FERIADO en el reporte.

## Persistencia

- Clave: `giga-attendance-marking-config`
- Formato: `{ "exemptUserIds": [number, ...] }`
- Evento: `giga-attendance-marking-config-changed`
- Default: lista vacia (todos los no-CLIENT deben marcar)

## Archivos

| Archivo | Rol |
|---------|-----|
| `src/features/settings/services/attendanceMarkingConfig.ts` | Carga, guardado, `isUserRequiredToMark` |
| `src/features/settings/hooks/useAttendanceMarkingConfig.ts` | Hook React |
| `src/features/settings/components/AttendanceMarkingManager.tsx` | UI lista + checkbox |
| `src/features/attendance/utils/attendanceReport.ts` | `filterAttendanceWorkers`, reporte |
| `src/features/attendance/components/AttendanceMarker.tsx` | Bloqueo en kiosko tras identificar |
| `src/services/offlineAttendanceQueue.ts` | Rechaza cola offline para exentos |

## UI

- **Admin → Configuracion** (`/admin/configuracion`, seccion *Quien marca asistencia*)

Checkbox **Marca** activo = obligatorio; desactivado = exento.

## Limitacion (opcion B en frontend)

El backend **no** valida exencion: otra app o API directa podria registrar asistencia. Para bloqueo server-side haria falta campo en usuario + validacion en endpoints faciales.

## Verificacion

```bash
npm test
npm run build
```

- Tests: `attendanceMarkingConfig.test.ts` + reporte exento (2026-09-15)
- Build: `npm run build` — OK (2026-09-15)
