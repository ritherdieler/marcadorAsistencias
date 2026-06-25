# Indicador y notificaciones de conexion

## Resumen

La app expone de forma global si el sistema esta en linea u offline, con notificaciones al cambiar de estado. El estado se centraliza en un provider montado en `main.tsx`.

## Componentes

| Archivo | Rol |
|---------|-----|
| `src/hooks/useNetworkStatus.tsx` | Provider, contexto y logica de transiciones |
| `src/components/ui/ConnectionStatusIndicator.tsx` | Badge fijo (esquina superior derecha) |
| `src/components/ui/ConnectionStatusToast.tsx` | Toast superior al cambiar conexion |
| `src/services/httpClient.ts` | Interceptor que reporta fallos de red al provider |

## Estados visibles

| Estado | Condicion | Badge |
|--------|-----------|-------|
| `initializing` | Primera carga de la app | Shimmer + pulso · "Preparando sistema..." |
| `online` | Navegador online y backend alcanzable | Punto verde · "En linea" |
| `offline` | Sin red o backend inalcanzable | Punto ambar · "Sin conexion" (+ pendientes si aplica) |
| `syncing` | Cola offline sincronizandose | Spinner + pulso · "Sincronizando N marcaciones" |

## Animaciones del indicador

- **Primera apertura (`initializing`)**: badge entra con `badge-enter`, fondo shimmer, punto pulsante azul y barra de progreso deslizante. Dura al menos 900 ms mientras se refresca la cola offline y, si hay red, el dataset facial.
- **Sincronizacion (`syncing`)**: anillo pulsante (`sync-pulse`), spinner, barra de progreso y sombra reforzada mientras `AttendanceMarker` procesa la cola.
- **Transicion a estado estable**: el badge vuelve suavemente al estilo compacto online/offline.
- Las animaciones respetan `motion-safe:` para usuarios con reduccion de movimiento.

## Notificaciones

- **Pérdida de conexion**: toast ambar — "Se perdio la conexion. Puedes seguir marcando en modo offline."
- **Conexion restaurada**: toast verde — "El sistema volvio a estar en linea."
- **Restaurada con pendientes**: incluye cantidad de marcaciones por sincronizar.
- No se muestran toasts en la carga inicial; solo en transiciones reales (debounce 300 ms).

## Integracion con marcacion

`AttendanceMarker` consume `useNetworkStatus()` para:

- Saber si puede identificar/marcar online u offline
- Marcar `setSyncing(true/false)` durante `syncOfflineAttendanceQueue`
- Llamar `reportConnectionError()` ante errores de red
- Refrescar `pendingSyncCount` tras encolar marcaciones offline

El mensaje operativo bajo la camara se mantiene; el badge global cubre el estado de red en toda la app.

## Verificacion manual

1. Abrir la app: badge "Preparando sistema..." con animacion shimmer durante ~1 s.
2. DevTools → Offline: badge ambar + toast de perdida de conexion.
3. Volver Online: badge verde + toast de restauracion.
4. Con marcaciones en cola: badge muestra syncing con pulso y barra animada.
5. Backend caido con red activa: interceptor marca offline.
