import {
  buildScheduleStatusExamples,
  getCheckInLabel,
  getLateAfterLabel,
  TOLERANCE_PRESETS,
  toTimeInputValue,
  updateScheduleTime,
  type AttendanceScheduleConfig,
} from '../services/attendanceScheduleConfig'

type AttendanceScheduleInfoProps = {
  draft: AttendanceScheduleConfig
  onDraftChange: (next: AttendanceScheduleConfig) => void
}

function ScheduleTimeline({ draft }: { draft: AttendanceScheduleConfig }) {
  const checkInLabel = getCheckInLabel(draft)
  const lateAfterLabel = getLateAfterLabel(draft)
  const windowMinutes = Math.max(draft.toleranceMinutes, 1)
  const punctualWidth = Math.min(72, 28 + windowMinutes)

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ventana de puntualidad</div>
      <div className="mt-4 flex items-center gap-3">
        <div className="text-center">
          <div className="text-[11px] font-semibold uppercase text-slate-500">Ingreso</div>
          <div className="mt-1 text-sm font-bold text-slate-900">{checkInLabel}</div>
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="h-3 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
              style={{ width: `${punctualWidth}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] font-medium text-slate-600">
            <span className="text-emerald-700">Puntual</span>
            <span className="text-amber-700">Tardanza desde {lateAfterLabel}</span>
          </div>
        </div>

        <div className="text-center">
          <div className="text-[11px] font-semibold uppercase text-slate-500">Tolerancia</div>
          <div className="mt-1 text-sm font-bold text-brand-blue">{draft.toleranceMinutes} min</div>
        </div>
      </div>
    </div>
  )
}

export function AttendanceScheduleInfo({ draft, onDraftChange }: AttendanceScheduleInfoProps) {
  const checkInLabel = getCheckInLabel(draft)
  const lateAfterLabel = getLateAfterLabel(draft)
  const toleranceLabel = `${draft.toleranceMinutes} ${draft.toleranceMinutes === 1 ? 'minuto' : 'minutos'}`
  const examples = buildScheduleStatusExamples(draft)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hora de ingreso</div>
          <div className="mt-2 text-3xl font-black text-brand-blue">{checkInLabel}</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tolerancia</div>
          <div className="mt-2 text-3xl font-black text-brand-blue">{toleranceLabel}</div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Tardanza desde</div>
          <div className="mt-2 text-2xl font-black text-amber-800 sm:text-3xl">Despues de {lateAfterLabel}</div>
        </div>
      </div>

      <ScheduleTimeline draft={draft} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Ajustes</h3>
            <p className="mt-1 text-xs text-slate-600">Define cuando una marcacion se considera puntual o tardanza.</p>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-semibold text-slate-700">Hora de ingreso oficial</span>
            <input
              type="time"
              value={toTimeInputValue(draft)}
              onChange={(event) => onDraftChange(updateScheduleTime(draft, event.target.value))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
            />
          </label>

          <div className="space-y-2">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">Tolerancia en minutos</span>
              <input
                type="range"
                min={0}
                max={120}
                step={1}
                value={draft.toleranceMinutes}
                onChange={(event) =>
                  onDraftChange({
                    ...draft,
                    toleranceMinutes: Number(event.target.value),
                  })}
                className="w-full accent-brand-blue"
              />
            </label>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>0 min</span>
              <span className="rounded-full bg-brand-soft/60 px-2 py-0.5 font-semibold text-brand-blue">
                {draft.toleranceMinutes} min
              </span>
              <span>120 min</span>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Presets rapidos</span>
            <div className="flex flex-wrap gap-2">
              {TOLERANCE_PRESETS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => onDraftChange({ ...draft, toleranceMinutes: minutes })}
                  className={[
                    'rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                    draft.toleranceMinutes === minutes
                      ? 'border-brand-blue bg-brand-blue text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-brand-blue/40 hover:bg-brand-soft/30',
                  ].join(' ')}
                >
                  {minutes} min
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Vista previa de marcaciones</h3>
            <p className="mt-1 text-xs text-slate-600">Ejemplos calculados con la configuracion actual.</p>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Escenario</th>
                  <th className="px-3 py-2 font-semibold">Hora</th>
                  <th className="px-3 py-2 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {examples.map((example) => (
                  <tr key={example.label} className="border-t border-slate-100">
                    <td className="px-3 py-2.5 text-slate-700">{example.label}</td>
                    <td className="px-3 py-2.5 font-semibold text-slate-900">{example.time}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={[
                          'inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold',
                          example.status === 'OK'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800',
                        ].join(' ')}
                      >
                        {example.status === 'OK' ? 'Puntual' : 'Tardanza'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Hasta las <span className="font-bold text-slate-950">{lateAfterLabel}</span> la asistencia queda como{' '}
            <span className="font-bold text-emerald-700">Puntual</span>. Despues de esa hora queda como{' '}
            <span className="font-bold text-amber-700">Tardanza</span>.
          </p>
        </div>
      </div>
    </div>
  )
}
