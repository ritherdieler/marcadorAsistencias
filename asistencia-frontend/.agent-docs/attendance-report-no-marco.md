# Reporte administrativo de asistencias: FALTÓ y FERIADO

## Proposito

El reporte admin se construye a partir del **personal** cruzado con asistencias por fecha laboral. Quienes no marcaron en un dia laborable aparecen como **FALTÓ**. Los dias laborables configurados como feriado aparecen como **FERIADO** (no cuentan como falta).

## Criterio de trabajadores

```ts
user.type !== 'CLIENT'
```

y no estar en la lista de **exentos** (`giga-attendance-marking-config`). Ver [`attendance-marking-config.md`](attendance-marking-config.md).

## Estados de presentacion (no vienen del backend)

| `reportStatus` | Etiqueta UI |
|----------------|-------------|
| `MARCO` | MARCÓ |
| `TARDANZA` | TARDANZA |
| `FALTO` | FALTÓ |
| `FERIADO` | FERIADO |

`AttendanceDto` del backend **no** se altera.

## Logica por trabajador + fecha

1. Con marcacion real → `MARCÓ` o `TARDANZA` (aunque no haya salida registrada).
2. Sin marcacion + dia laborable (lun–sab) + **no** feriado → `FALTO`.
3. Sin marcacion + dia laborable (lun–sab) + feriado → `FERIADO` (Metodo muestra el nombre del feriado).
4. Domingo sin marcacion → no se genera fila.

## Feriados (sector privado)

- Config en pantalla **Configuracion** (`AdminSchedulePage`, ruta `/admin/configuracion`).
- Persistencia: `localStorage` clave `giga-attendance-holidays-config`.
- Archivos: `attendanceHolidaysConfig.ts`, `useAttendanceHolidaysConfig.ts`, `AttendanceHolidaysManager.tsx`.
- Default: lista vacia (se agregan a mano).

## Archivos clave

| Archivo | Rol |
|---------|-----|
| `src/features/attendance/utils/attendanceReport.ts` | Filas, estados FALTO/FERIADO, resumen |
| `src/features/attendance/pages/AdminAttendancePage.tsx` | Tabla, tarjetas, export |
| `src/features/settings/services/attendanceHolidaysConfig.ts` | Config feriados |
| `src/features/settings/components/AttendanceHolidaysManager.tsx` | UI feriados |

## Resumen (personas unicas)

Total personal · Marcaron · Faltaron · Feriados · Tardanzas.

## UI tabla y paginacion (2026-09-15)

- Celdas vacias (ingreso, salida, metodo, DNI): guion ASCII `-` (como el listado anterior).
- Paginacion: texto `Mostrando X al Y de Z registros`, selector de tamano de pagina, barra unificada `« Anterior` | numeros | `Siguiente »` con puntos suspensivos `...` cuando hay muchas paginas.
- **Dia por defecto:** al abrir Asistencias, Desde/Hasta = hoy; el reporte lista **todo el personal** ese dia (MARCÓ/TARDANZA y FALTÓ/ FERIADO mezclados), sin buscar por DNI.

## Verificacion

```bash
npx tsc --noEmit
npm test
npm run build
```

- TypeScript (`tsc --noEmit`): OK (2026-09-15)
- Tests: 19/19 OK (`attendanceReport` + `attendanceHolidaysConfig`) (2026-09-15)
- Build: `npm run build` — OK (2026-09-15, paginacion y guiones en tabla)
