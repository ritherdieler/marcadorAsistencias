import { LoadingButton } from '../../../components/ui/LoadingButton'
import {
  clampTargetPercent,
  FACE_COVERAGE_MAX_PERCENT,
  FACE_COVERAGE_MIN_PERCENT,
  FACE_COVERAGE_PRESETS,
  type FaceCoverageConfig,
  type FaceCoverageFlow,
} from '../../recognition/services/faceAlignmentConfig'
import { CoveragePresetCard } from './CoveragePresetCard'

type FaceCoverageControlsProps = {
  activeFlow: FaceCoverageFlow
  draft: FaceCoverageConfig
  hasPendingChanges: boolean
  saving: boolean
  onFlowChange: (flow: FaceCoverageFlow) => void
  onTargetChange: (flow: FaceCoverageFlow, percent: number) => void
  onSave: () => void
  onReset: () => void
}

const FLOW_TABS: { id: FaceCoverageFlow; label: string; hint: string }[] = [
  { id: 'attendance', label: 'Marcacion', hint: 'Terminal / kiosko' },
  { id: 'registration', label: 'Registro', hint: 'Alta facial multiangulo' },
]

export function FaceCoverageControls({
  activeFlow,
  draft,
  hasPendingChanges,
  saving,
  onFlowChange,
  onTargetChange,
  onSave,
  onReset,
}: FaceCoverageControlsProps) {
  const currentPercent = draft[activeFlow].targetWidthPercent

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
                Guardado: {draft[tab.id].targetWidthPercent}%
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
