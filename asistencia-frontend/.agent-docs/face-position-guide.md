# Face position guide (2026-06-25)

Replaces numeric `FaceCoverageIndicator` badge with configurable visual guides on the camera overlay.

## Components

| File | Role |
|------|------|
| `FacePositionGuide.tsx` | Container; renders enabled sub-guides |
| `FaceTargetGuide.tsx` | Silueta de rostro (SVG) con ancho = `targetWidthPercent` + anillo de cercania |
| `FaceGuideScrim.tsx` | Atenua el fondo con recorte facial (estilo bancario) |
| `FaceDirectionArrows.tsx` | Animated chevrons for too_far / too_close / off_center |
| `FaceZoneBar.tsx` | Barra Lejos / Bien / Cerca; indicador mapeado a 3 zonas iguales segun ancho vs banda |
| `faceGuideLayout.ts` | Dimensionamiento de la silueta y `faceProximityProgress()` |

## Config (`faceGuide` in `giga-face-coverage-config`)

| Field | Default |
|-------|---------|
| `showTargetOval` | `true` |
| `showDirectionArrows` | `true` |
| `showZoneBar` | `false` |
| `dimOutside` | `true` |
| `showProximityRing` | `true` |

`showFaceLandmarks` default ahora `false` (malla solo bajo demanda; configurable en panel).

Admin toggles: seccion **Guias visuales** en `AdminFaceCoveragePage` → `VisualGuideControls`.

## Tamaño vs cobertura objetivo

- **Marco exterior** = `maxTargetWidthPercent` = `min(objetivo × upperWidthRatio, 75%)` (limite antes de *Alejate*).
- **Marco interior punteado** = `targetWidthPercent` (cobertura minima / objetivo inferior).
- Ancho via CSS `width: max%` + `aspect-ratio` del path SVG; el alto se deriva proporcionalmente.
- `faceGuideSilhouetteStyle()` centra la silueta en `centerTargetY`.
- El scrim (`FaceGuideScrim`) usa el mismo ancho maximo que el marco exterior.
- Al mover objetivo o ratio en admin, marco y scrim se redimensionan en vivo.

## Centrado

- Frontal / kiosko: tolerancia fija `centerToleranceFront = 0.10` (±10% del frame). El centro del rostro debe quedar entre 40% y 60% horizontal y dentro de `centerTargetY ± (0.10 + 0.06)` vertical.
- Valor balanceado: 16% dejaba pasar rostros visiblemente descentrados como "Perfecto"; el ajuste a silueta (`maxFaceWidth`) era demasiado estricto (~1.5% de margen) y rechazaba rostros centrados.
- Perfiles de registro (`left`/`right`): usa `centerToleranceTurn` (30%).

## Banda de distancia (too_far / too_close)

- `minFaceWidth` = `targetWidthPercent / 100` (objetivo inferior).
- `upperWidthRatio` configurable por flujo en admin (default `1.35`, rango `1.1`–`1.6`).
- `maxFaceWidth` = `computeMaxFaceWidth(target, upperWidthRatio)` = `min(objetivo × ratio, 75%)`.
- Ejemplo objetivo 20% + ratio 1.35: alineado entre 20% y 27%; por debajo → *Acercate*; por encima → *Alejate*.
- `faceProximityProgress()` retorna 0 si `faceWidth > maxFaceWidth` (sin anillo verde engañoso).
- Vista previa admin muestra banda `20–27%` y mensaje diagnostico con rango.

## Estilo bancario

- `FaceGuideScrim`: SVG full-frame (`viewBox 160x90`, 16:9 fijo como los contenedores `aspect-video`) con `mask` que recorta la silueta; el resto se oscurece. Sin distorsion porque las unidades x/y son iguales en 16:9.
- Anillo de cercania (`FaceTargetGuide`): segundo path con `pathLength=100` y `stroke-dashoffset` segun `faceProximityProgress(faceBox.width, runtimeConfig)`; se completa al acercarse al objetivo. Oculto al estar alineado (la silueta ya es verde).

## User-facing copy

Kiosk and registration use `faceAlignmentMessage()` (no percentages). Admin preview adds `faceAlignmentDiagnosticMessage()` below the video.

## Build verification

```bash
npm run build
```

| Fecha | Cambio | Resultado |
|-------|--------|-----------|
| 2026-06-25 | Guia estilo bancario inicial | OK |
| 2026-06-25 | Banda too_close proporcional (`computeMaxFaceWidth`, ratio configurable) | OK |
| 2026-06-25 | Centrado alineado a silueta (`faceFitsGuideSilhouette`) | OK |
| 2026-06-25 | Centrado por tolerancia fija balanceada (`centerToleranceFront = 0.10`) | OK |
