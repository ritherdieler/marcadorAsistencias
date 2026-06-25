import {
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
  type FaceCoverageConfig,
  type FaceCoverageFlow,
} from '../../recognition/services/faceAlignmentConfig'
import { CoveragePresetCard } from './CoveragePresetCard'

type CoverageDistanceControlsProps = {
  activeFlow: FaceCoverageFlow
  draft: FaceCoverageConfig
  onFlowChange: (flow: FaceCoverageFlow) => void
  onTargetChange: (flow: FaceCoverageFlow, percent: number) => void
  onUpperWidthRatioChange: (flow: FaceCoverageFlow, ratio: number) => void
}

const FLOW_TABS: { id: FaceCoverageFlow; label: string; hint: string }[] = [
  { id: 'attendance', label: 'Marcacion', hint: 'Terminal / kiosko' },
  { id: 'registration', label: 'Registro', hint: 'Alta facial multiangulo' },
]

export function CoverageDistanceControls({
  activeFlow,
  draft,
  onFlowChange,
  onTargetChange,
  onUpperWidthRatioChange,
}: CoverageDistanceControlsProps) {
  const flowSettings = draft[activeFlow]
  const currentPercent = flowSettings.targetWidthPercent
  const currentRatio = flowSettings.upperWidthRatio
  const maxPercent = computeMaxWidthPercent(currentPercent, currentRatio)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-950">Cobertura y distancia</h2>
        <p className="mt-1 text-sm text-slate-600">
          Define la cobertura minima del rostro y la tolerancia hacia la camara para cada flujo.
        </p>
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
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
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
    </div>
  )
}
