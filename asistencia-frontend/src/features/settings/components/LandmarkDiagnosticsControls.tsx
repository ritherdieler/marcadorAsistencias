import { FACE_CONTOUR_GROUPS } from '../../recognition/services/faceLandmarkConnections'
import {
  clampLandmarkPointSize,
  FACE_LANDMARK_COLOR_PRESETS,
  FACE_LANDMARK_POINT_SIZE_MAX,
  FACE_LANDMARK_POINT_SIZE_MIN,
  type FaceCoverageConfig,
  type FaceLandmarkAlignmentColorKey,
  type FaceLandmarkDrawStyle,
  type FaceLandmarkLayerId,
} from '../../recognition/services/faceAlignmentConfig'
import { LayerToggle } from './LayerToggle'
import { ToggleSwitch } from './ToggleSwitch'

type LandmarkDiagnosticsControlsProps = {
  draft: FaceCoverageConfig
  onShowFaceLandmarksChange: (value: boolean) => void
  onLandmarkDrawStyleChange: (value: FaceLandmarkDrawStyle) => void
  onLandmarkPointSizeChange: (value: number) => void
  onLandmarkAlignmentColorChange: (key: FaceLandmarkAlignmentColorKey, value: string) => void
  onLandmarkLayerChange: (layerId: FaceLandmarkLayerId, value: boolean) => void
}

const LANDMARK_LAYER_LABELS: Record<FaceLandmarkLayerId, string> = {
  tesselation: 'Malla completa',
  oval: 'Silueta',
  contours: 'Contornos',
  leftEyebrow: 'Ceja izquierda',
  rightEyebrow: 'Ceja derecha',
  nose: 'Nariz',
  leftEye: 'Ojo izquierdo',
  rightEye: 'Ojo derecho',
  leftIris: 'Iris izquierdo',
  rightIris: 'Iris derecho',
  lips: 'Labios',
}

const DRAW_STYLE_OPTIONS: { id: FaceLandmarkDrawStyle; label: string }[] = [
  { id: 'continuous', label: 'Continuo' },
  { id: 'dotted', label: 'Punteado' },
]

const ALIGNMENT_COLOR_OPTIONS: {
  id: FaceLandmarkAlignmentColorKey
  label: string
  hint: string
}[] = [
  { id: 'searching', label: 'Buscando rostro', hint: 'Sin rostro o colocandolo en el marco' },
  { id: 'aligned', label: 'Alineado', hint: 'Posicion correcta para captura' },
  { id: 'warning', label: 'Ajuste requerido', hint: 'Lejos, cerca, descentrado o pose incorrecta' },
]

export function LandmarkDiagnosticsControls({
  draft,
  onShowFaceLandmarksChange,
  onLandmarkDrawStyleChange,
  onLandmarkPointSizeChange,
  onLandmarkAlignmentColorChange,
  onLandmarkLayerChange,
}: LandmarkDiagnosticsControlsProps) {
  const showTesselationWarning = draft.landmarkLayers.tesselation

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-950">Avanzado / Diagnostico</h2>
        <p className="mt-1 text-sm text-slate-600">
          Herramientas de depuracion visual. No afectan la deteccion ni la marcacion en produccion.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">Landmarks faciales</div>
            <p className="mt-1 text-xs text-slate-600">
              Superpone capas del Face Mesh sobre el rostro detectado en la vista previa.
            </p>
          </div>
          <ToggleSwitch
            checked={draft.showFaceLandmarks}
            label="Mostrar landmarks faciales"
            onChange={onShowFaceLandmarksChange}
          />
        </div>

        {draft.showFaceLandmarks && (
          <>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estilo de dibujo</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {DRAW_STYLE_OPTIONS.map((option) => {
                  const selected = draft.landmarkDrawStyle === option.id
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onLandmarkDrawStyleChange(option.id)}
                      className={[
                        'rounded-xl border px-3 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40',
                        selected
                          ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100',
                      ].join(' ')}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Colores por estado</div>
              <p className="mt-1 text-xs text-slate-500">
                Define el color de lineas y puntos segun la alineacion del rostro en la vista previa.
              </p>
              <div className="mt-3 space-y-3">
                {ALIGNMENT_COLOR_OPTIONS.map((option) => (
                  <div key={option.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{option.label}</div>
                        <p className="mt-0.5 text-xs text-slate-500">{option.hint}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <input
                          id={`landmark-color-${option.id}`}
                          type="color"
                          value={draft.landmarkAlignmentColors[option.id]}
                          aria-label={`Color ${option.label}`}
                          onChange={(event) => onLandmarkAlignmentColorChange(option.id, event.target.value)}
                          className="h-10 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                        />
                        <span className="text-xs font-mono text-slate-500">
                          {draft.landmarkAlignmentColors[option.id]}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {FACE_LANDMARK_COLOR_PRESETS.map((preset) => {
                        const selected = draft.landmarkAlignmentColors[option.id] === preset.value
                        return (
                          <button
                            key={`${option.id}-${preset.id}`}
                            type="button"
                            aria-pressed={selected}
                            aria-label={`${option.label}: color ${preset.label}`}
                            onClick={() => onLandmarkAlignmentColorChange(option.id, preset.value)}
                            className={[
                              'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40',
                              selected
                                ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
                            ].join(' ')}
                          >
                            <span
                              className="h-3.5 w-3.5 rounded-full border border-slate-300"
                              style={{ backgroundColor: preset.value }}
                              aria-hidden="true"
                            />
                            {preset.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {draft.landmarkDrawStyle === 'dotted' && (
              <div>
                <label htmlFor="landmark-point-size-slider" className="text-sm font-semibold text-slate-900">
                  Tamano de punto — {draft.landmarkPointSizePx}px
                </label>
                <input
                  id="landmark-point-size-slider"
                  type="range"
                  min={FACE_LANDMARK_POINT_SIZE_MIN}
                  max={FACE_LANDMARK_POINT_SIZE_MAX}
                  step={1}
                  value={draft.landmarkPointSizePx}
                  aria-valuemin={FACE_LANDMARK_POINT_SIZE_MIN}
                  aria-valuemax={FACE_LANDMARK_POINT_SIZE_MAX}
                  aria-valuenow={draft.landmarkPointSizePx}
                  aria-valuetext={`${draft.landmarkPointSizePx} pixeles`}
                  onChange={(event) =>
                    onLandmarkPointSizeChange(clampLandmarkPointSize(Number(event.target.value)))
                  }
                  className="mt-3 h-2 w-full cursor-pointer accent-brand-blue"
                />
                <div className="mt-2 flex justify-between text-xs font-semibold text-slate-500">
                  <span>{FACE_LANDMARK_POINT_SIZE_MIN}px</span>
                  <span>{FACE_LANDMARK_POINT_SIZE_MAX}px</span>
                </div>
              </div>
            )}

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Capas visibles</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {FACE_CONTOUR_GROUPS.map((group) => (
                  <LayerToggle
                    key={group.id}
                    label={LANDMARK_LAYER_LABELS[group.id]}
                    checked={draft.landmarkLayers[group.id]}
                    onChange={(value) => onLandmarkLayerChange(group.id, value)}
                  />
                ))}
              </div>
            </div>

            {showTesselationWarning && (
              <div
                role="alert"
                className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900"
              >
                La malla completa dibuja 478 puntos por frame y puede reducir el rendimiento en dispositivos lentos.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
