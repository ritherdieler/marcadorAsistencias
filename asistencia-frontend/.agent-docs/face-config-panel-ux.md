# Panel de configuracion facial — UX por secciones (2026-06-25)

## Proposito

Reducir la sobrecarga del admin de configuracion facial: una seccion visible a la vez, vista previa fija y un solo guardado global.

## Archivos clave

| Archivo | Rol |
|---------|-----|
| `AdminFaceCoveragePage.tsx` | Orquestacion: drafts, seccion activa, barra global |
| `FaceConfigSectionNav.tsx` | Navegacion por secciones (tablist) |
| `FaceConfigActionBar.tsx` | Guardar / Restablecer unificados |
| `faceConfigSections.ts` | IDs y metadatos de secciones |
| `CoverageDistanceControls.tsx` | Cobertura objetivo, ratio, presets por flujo |
| `VisualGuideControls.tsx` | Silueta, flechas, barra, scrim, marco |
| `ChallengeBasicControls.tsx` | Reto activo: toggles y pasos |
| `LandmarkDiagnosticsControls.tsx` | Landmarks y capas (diagnostico) |
| `ChallengeThresholdControls.tsx` | Umbrales yaw/blink (avanzado) |
| `LayerToggle.tsx`, `ToggleSwitch.tsx` | Controles compartidos |

## Secciones

| ID | Contenido | Badge pendiente cuando |
|----|-----------|------------------------|
| `coverage` | Flujo marcacion/registro, objetivo, tolerancia, presets | Cambia `attendance` o `registration` |
| `guides` | Guia de posicion + marco del rostro | Cambia `faceGuide` o `showFaceBox` |
| `challenge` | Habilitar reto, espejo, pose 3D, pasos | Cambia core del reto (sin umbrales) |
| `advanced` | Landmarks + umbrales yaw/blink | Cambia capas/colores landmarks o `thresholds` |

## Layout

- Desktop (`xl+`): grid 2 columnas — controles a la izquierda, `FaceCoveragePreview` sticky a la derecha.
- Movil: nav horizontal scrolleable, preview debajo del header de pagina, barra de acciones sticky inferior.
- Una sola barra `FaceConfigActionBar`: indicador global de pendientes, Guardar (cobertura + reto si aplica), Restablecer ambos.

## Accesibilidad

- `role="tablist"` / `role="tab"` / `role="tabpanel"` con `aria-controls`, `aria-labelledby`, `aria-selected`.
- Badge de pendientes por seccion con `aria-label` descriptivo.

## Build

```bash
npm run build
```

OK (2026-06-25).

## Ajuste layout cobertura (2026-06-25)

- Presets Lejano / Estandar / Estricto movidos dentro del bloque **Cobertura objetivo** (antes quedaban fuera del contenedor gris).
