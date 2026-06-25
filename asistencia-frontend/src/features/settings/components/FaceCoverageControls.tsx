import { LoadingButton } from '../../../components/ui/LoadingButton'
import { FACE_CONTOUR_GROUPS } from '../../recognition/services/faceLandmarkConnections'
import {
  clampLandmarkPointSize,
  clampTargetPercent,
  clampUpperWidthRatio,
  computeMaxWidthPercent,
  FACE_COVERAGE_MAX_PERCENT,
  FACE_COVERAGE_MIN_PERCENT,
  FACE_COVERAGE_PRESETS,
  FACE_COVERAGE_UPPER_RATIO_MAX,
  FACE_COVERAGE_UPPER_RATIO_MIN,
  FACE_COVERAGE_UPPER_RATIO_PRESETS,
  FACE_COVERAGE_UPPER_RATIO_STEP,
  FACE_LANDMARK_POINT_SIZE_MAX,
  FACE_LANDMARK_POINT_SIZE_MIN,
  FACE_LANDMARK_COLOR_PRESETS,
  type FaceCoverageConfig,
  type FaceCoverageFlow,
  type FaceGuideSettings,
  type FaceLandmarkAlignmentColorKey,
  type FaceLandmarkDrawStyle,
  type FaceLandmarkLayerId,
} from '../../recognition/services/faceAlignmentConfig'
import { CoveragePresetCard } from './CoveragePresetCard'

type FaceCoverageControlsProps = {
  activeFlow: FaceCoverageFlow
  draft: FaceCoverageConfig
  hasPendingChanges: boolean
  saving: boolean
  onFlowChange: (flow: FaceCoverageFlow) => void
  onTargetChange: (flow: FaceCoverageFlow, percent: number) => void
  onUpperWidthRatioChange: (flow: FaceCoverageFlow, ratio: number) => void
  onShowFaceLandmarksChange: (value: boolean) => void
  onShowFaceBoxChange: (value: boolean) => void
  onLandmarkDrawStyleChange: (value: FaceLandmarkDrawStyle) => void
  onLandmarkPointSizeChange: (value: number) => void
  onLandmarkAlignmentColorChange: (key: FaceLandmarkAlignmentColorKey, value: string) => void
  onLandmarkLayerChange: (layerId: FaceLandmarkLayerId, value: boolean) => void
  onFaceGuideChange: (key: keyof FaceGuideSettings, value: boolean) => void
  onSave: () => void
  onReset: () => void
}

const FLOW_TABS: { id: FaceCoverageFlow; label: string; hint: string }[] = [
  { id: 'attendance', label: 'Marcacion', hint: 'Terminal / kiosko' },
  { id: 'registration', label: 'Registro', hint: 'Alta facial multiangulo' },
]

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

function LayerToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <span className="text-sm font-medium text-slate-900">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40',
          checked ? 'bg-brand-blue' : 'bg-slate-300',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-5 w-5 transform rounded-full bg-white shadow transition',
            checked ? 'translate-x-5' : 'translate-x-1',
          ].join(' ')}
        />
      </button>
    </div>
  )
}

export function FaceCoverageControls({
  activeFlow,
  draft,
  hasPendingChanges,
  saving,
  onFlowChange,
  onTargetChange,
  onUpperWidthRatioChange,
  onShowFaceLandmarksChange,
  onShowFaceBoxChange,
  onLandmarkDrawStyleChange,
  onLandmarkPointSizeChange,
  onLandmarkAlignmentColorChange,
  onLandmarkLayerChange,
  onFaceGuideChange,
  onSave,
  onReset,
}: FaceCoverageControlsProps) {
  const flowSettings = draft[activeFlow]
  const currentPercent = flowSettings.targetWidthPercent
  const currentRatio = flowSettings.upperWidthRatio
  const maxPercent = computeMaxWidthPercent(currentPercent, currentRatio)
  const showTesselationWarning = draft.landmarkLayers.tesselation

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Ajustes por flujo</h2>
            <p className="mt-1 text-sm text-slate-600">Define la cobertura minima del rostro para cada caso de uso.</p>
          </div>
          {hasPendingChanges && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              Cambios pendientes
            </span>
          )}
        </div>
      </div>

      <div role="tablist" aria-label="Flujo de cobertura facial" className="grid gap-2 sm:grid-cols-2">
        {FLOW_TABS.map((tab) => {
          const selected = activeFlow === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onFlowChange(tab.id)}
              className={[
                'rounded-xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40',
                selected ? 'border-brand-blue bg-brand-blue/10' : 'border-slate-200 bg-slate-50 hover:bg-slate-100',
              ].join(' ')}
            >
              <div className="text-sm font-bold text-slate-900">{tab.label}</div>
              <div className="mt-1 text-xs text-slate-600">{tab.hint}</div>
              <div className="mt-2 text-xs font-semibold text-brand-blue">
                Guardado: {draft[tab.id].targetWidthPercent}% · ratio {draft[tab.id].upperWidthRatio.toFixed(2)}x
              </div>
            </button>
          )
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <label htmlFor="face-coverage-slider" className="text-sm font-semibold text-slate-900">
          Cobertura objetivo — {FLOW_TABS.find((tab) => tab.id === activeFlow)?.label}
        </label>
        <div className="mt-4 flex items-end gap-4">
          <div className="text-4xl font-black tabular-nums text-brand-blue">{currentPercent}%</div>
          <div className="pb-1 text-sm text-slate-600">ancho minimo del rostro</div>
        </div>
        <input
          id="face-coverage-slider"
          type="range"
          min={FACE_COVERAGE_MIN_PERCENT}
          max={FACE_COVERAGE_MAX_PERCENT}
          step={1}
          value={currentPercent}
          aria-valuemin={FACE_COVERAGE_MIN_PERCENT}
          aria-valuemax={FACE_COVERAGE_MAX_PERCENT}
          aria-valuenow={currentPercent}
          aria-valuetext={`${currentPercent} por ciento de ancho del rostro`}
          onChange={(event) => onTargetChange(activeFlow, clampTargetPercent(Number(event.target.value)))}
          className="mt-4 h-2 w-full cursor-pointer accent-brand-blue"
        />
        <div className="mt-2 flex justify-between text-xs font-semibold text-slate-500">
          <span>{FACE_COVERAGE_MIN_PERCENT}%</span>
          <span>{FACE_COVERAGE_MAX_PERCENT}%</span>
        </div>
        <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">
          Banda alineada actual:{' '}
          <span className="font-semibold tabular-nums text-slate-900">
            {currentPercent}% – {maxPercent}%
          </span>
          . Por debajo pide acercarse; por encima pide alejarse.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <label htmlFor="face-upper-ratio-slider" className="text-sm font-semibold text-slate-900">
          Tolerancia hacia camara — {FLOW_TABS.find((tab) => tab.id === activeFlow)?.label}
        </label>
        <div className="mt-4 flex items-end gap-4">
          <div className="text-4xl font-black tabular-nums text-brand-blue">{currentRatio.toFixed(2)}x</div>
          <div className="pb-1 text-sm text-slate-600">maximo = objetivo x ratio</div>
        </div>
        <input
          id="face-upper-ratio-slider"
          type="range"
          min={FACE_COVERAGE_UPPER_RATIO_MIN}
          max={FACE_COVERAGE_UPPER_RATIO_MAX}
          step={FACE_COVERAGE_UPPER_RATIO_STEP}
          value={currentRatio}
          aria-valuemin={FACE_COVERAGE_UPPER_RATIO_MIN}
          aria-valuemax={FACE_COVERAGE_UPPER_RATIO_MAX}
          aria-valuenow={currentRatio}
          aria-valuetext={`Ratio ${currentRatio.toFixed(2)}, maximo ${maxPercent} por ciento`}
          onChange={(event) =>
            onUpperWidthRatioChange(activeFlow, clampUpperWidthRatio(Number(event.target.value)))
          }
          className="mt-4 h-2 w-full cursor-pointer accent-brand-blue"
        />
        <div className="mt-2 flex justify-between text-xs font-semibold text-slate-500">
          <span>{FACE_COVERAGE_UPPER_RATIO_MIN.toFixed(2)}x</span>
          <span>{FACE_COVERAGE_UPPER_RATIO_MAX.toFixed(2)}x</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {FACE_COVERAGE_UPPER_RATIO_PRESETS.map((preset) => (
            <CoveragePresetCard
              key={preset.id}
              label={preset.label}
              percent={0}
              badge={`${preset.ratio.toFixed(2)}x`}
              description={`${preset.description} Max ${computeMaxWidthPercent(currentPercent, preset.ratio)}% con objetivo ${currentPercent}%.`}
              selected={currentRatio === preset.ratio}
              onSelect={() => onUpperWidthRatioChange(activeFlow, preset.ratio)}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {FACE_COVERAGE_PRESETS.map((preset) => (
          <CoveragePresetCard
            key={preset.id}
            label={preset.label}
            percent={preset.percent}
            description={preset.description}
            selected={currentPercent === preset.percent}
            onSelect={() => onTargetChange(activeFlow, preset.percent)}
          />
        ))}
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div>
          <div className="text-sm font-semibold text-slate-900">Guia de posicion</div>
          <p className="mt-1 text-xs text-slate-600">
            Ayudas visuales sobre la camara para acercar, centrar o encajar el rostro sin mostrar porcentajes al usuario.
          </p>
        </div>
        <div className="grid gap-2">
          <LayerToggle
            label="Marco objetivo (banda min–max)"
            checked={draft.faceGuide.showTargetOval}
            onChange={(value) => onFaceGuideChange('showTargetOval', value)}
          />
          <LayerToggle
            label="Flechas de direccion animadas"
            checked={draft.faceGuide.showDirectionArrows}
            onChange={(value) => onFaceGuideChange('showDirectionArrows', value)}
          />
          <LayerToggle
            label="Barra de zonas (lejos / bien / cerca)"
            checked={draft.faceGuide.showZoneBar}
            onChange={(value) => onFaceGuideChange('showZoneBar', value)}
          />
          <LayerToggle
            label="Atenuar fondo fuera del rostro"
            checked={draft.faceGuide.dimOutside}
            onChange={(value) => onFaceGuideChange('dimOutside', value)}
          />
          <LayerToggle
            label="Anillo de cercania (feedback al acercarse)"
            checked={draft.faceGuide.showProximityRing}
            onChange={(value) => onFaceGuideChange('showProximityRing', value)}
          />
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">Landmarks faciales</div>
            <p className="mt-1 text-xs text-slate-600">
              Superpone capas del Face Mesh sobre el rostro detectado. No afecta la deteccion.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={draft.showFaceLandmarks}
            aria-label="Mostrar landmarks faciales"
            onClick={() => onShowFaceLandmarksChange(!draft.showFaceLandmarks)}
            className={[
              'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40',
              draft.showFaceLandmarks ? 'bg-brand-blue' : 'bg-slate-300',
            ].join(' ')}
          >
            <span
              className={[
                'inline-block h-5 w-5 transform rounded-full bg-white shadow transition',
                draft.showFaceLandmarks ? 'translate-x-5' : 'translate-x-1',
              ].join(' ')}
            />
          </button>
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
                  <div
                    key={option.id}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                  >
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

      <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div>
          <div className="text-sm font-semibold text-slate-900">Marco del rostro</div>
          <p className="mt-1 text-xs text-slate-600">
            Dibuja la caja rectangular con esquinas sobre el rostro detectado. No afecta la deteccion.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={draft.showFaceBox}
          aria-label="Mostrar marco del rostro"
          onClick={() => onShowFaceBoxChange(!draft.showFaceBox)}
          className={[
            'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40',
            draft.showFaceBox ? 'bg-brand-blue' : 'bg-slate-300',
          ].join(' ')}
        >
          <span
            className={[
              'inline-block h-5 w-5 transform rounded-full bg-white shadow transition',
              draft.showFaceBox ? 'translate-x-5' : 'translate-x-1',
            ].join(' ')}
          />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <LoadingButton type="button" variant="dark" onClick={onReset} disabled={saving}>
          Restablecer recomendados
        </LoadingButton>
        <LoadingButton type="button" onClick={onSave} loading={saving} loadingText="Guardando..." disabled={!hasPendingChanges}>
          Guardar configuracion
        </LoadingButton>
      </div>
    </div>
  )
}
