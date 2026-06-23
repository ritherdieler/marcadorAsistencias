import type { FaceAlignment } from '../services/faceAlignment'
import { DEFAULT_FACE_COVERAGE_CONFIG } from '../services/faceAlignmentConfig'

type FaceCoverageIndicatorProps = {
  widthPercent: number
  alignment: FaceAlignment
  targetPercent?: number
}

export function FaceCoverageIndicator({
  widthPercent,
  alignment,
  targetPercent = DEFAULT_FACE_COVERAGE_CONFIG.registration.targetWidthPercent,
}: FaceCoverageIndicatorProps) {
  const barWidth = Math.min(100, widthPercent)
  const reachedTarget = widthPercent >= targetPercent
  const aligned = alignment === 'aligned' && reachedTarget

  const badgeTone = aligned
    ? 'border-emerald-400/80 bg-emerald-950/75 text-emerald-100'
    : widthPercent > 0
      ? 'border-amber-400/70 bg-slate-950/75 text-amber-100'
      : 'border-slate-500/60 bg-slate-950/70 text-slate-300'

  const barTone = aligned ? 'bg-emerald-400' : widthPercent > 0 ? 'bg-amber-400' : 'bg-slate-500'

  return (
    <div
      className="pointer-events-none absolute left-3 top-3 z-10 w-[min(100%,11rem)] rounded-xl border px-3 py-2 shadow-lg backdrop-blur-sm"
      aria-hidden="true"
    >
      <div className={['rounded-lg border px-2 py-2', badgeTone].join(' ')}>
        <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80">Ancho del rostro</div>
        <div className="mt-0.5 text-2xl font-black leading-none tabular-nums">{widthPercent}%</div>
        <div className="mt-2">
          <div className="relative h-2 overflow-hidden rounded-full bg-white/15">
            <div
              className={['h-full rounded-full transition-all duration-150 ease-out', barTone].join(' ')}
              style={{ width: `${barWidth}%` }}
            />
            <div className="absolute top-0 h-full w-0.5 bg-white/90" style={{ left: `${targetPercent}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[10px] font-semibold opacity-75">
            <span>0%</span>
            <span>Objetivo {targetPercent}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
