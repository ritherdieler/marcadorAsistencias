import {
  ENROLLMENT_ANGLES,
  type AngleCaptureState,
  type CaptureAngle,
} from '../../hooks/useFaceEnrollment'

type CapturedThumbnailsProps = {
  captures: Record<CaptureAngle, AngleCaptureState>
  currentAngle: CaptureAngle
  onRecapture: (angle: CaptureAngle) => void
  disabled?: boolean
  showRecapture?: boolean
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CapturedThumbnails({
  captures,
  currentAngle,
  onRecapture,
  disabled = false,
  showRecapture = true,
}: CapturedThumbnailsProps) {
  return (
    <ul className="grid grid-cols-3 gap-3">
      {ENROLLMENT_ANGLES.map((angle) => {
        const state = captures[angle.key]
        const isCurrent = currentAngle === angle.key && !state.blob
        const captured = Boolean(state.blob)

        return (
          <li key={angle.key} className="space-y-2">
            <div
              className={[
                'relative aspect-[3/4] overflow-hidden rounded-xl border bg-slate-100',
                captured ? 'border-emerald-300' : isCurrent ? 'border-brand-blue ring-2 ring-brand-blue/30' : 'border-slate-200',
              ].join(' ')}
            >
              {state.previewUrl ? (
                <img src={state.previewUrl} alt={`Captura ${angle.label}`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-1 text-center text-[11px] font-semibold text-slate-400">
                  {isCurrent ? 'Capturando...' : 'Pendiente'}
                </div>
              )}

              {captured && (
                <span
                  className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-white"
                  aria-hidden="true"
                >
                  <CheckIcon />
                </span>
              )}
            </div>

            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-semibold text-slate-700">{angle.label}</span>
              {showRecapture && captured && (
                <button
                  type="button"
                  onClick={() => onRecapture(angle.key)}
                  disabled={disabled}
                  className="rounded-md px-2 py-1 text-[11px] font-semibold text-brand-blue transition hover:bg-brand-blue/10 disabled:opacity-40"
                >
                  Recapturar
                </button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
