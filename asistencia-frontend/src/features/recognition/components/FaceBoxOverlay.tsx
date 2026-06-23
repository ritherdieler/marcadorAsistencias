import type { FaceBox } from '../services/facePresenceDetector'
import type { FaceAlignment } from '../services/faceAlignment'

type FaceBoxOverlayProps = {
  box: FaceBox | null
  alignment: FaceAlignment
  mirror?: boolean
}

export function FaceBoxOverlay({ box, alignment, mirror = false }: FaceBoxOverlayProps) {
  if (!box) {
    return (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <div className="h-[64%] w-[46%] max-w-[260px] rounded-[48%] border-2 border-dashed border-white/55" />
      </div>
    )
  }

  const aligned = alignment === 'aligned'
  const warning =
    alignment === 'too_far' ||
    alignment === 'too_close' ||
    alignment === 'off_center' ||
    alignment === 'wrong_pose'

  const borderColor = aligned ? 'border-emerald-400' : warning ? 'border-amber-300' : 'border-sky-300'
  const glow = aligned
    ? 'shadow-[0_0_26px_rgba(52,211,153,0.55)]'
    : warning
      ? 'shadow-[0_0_18px_rgba(252,211,77,0.35)]'
      : 'shadow-[0_0_18px_rgba(56,189,248,0.35)]'

  const centerX = mirror ? 1 - box.centerX : box.centerX
  const left = (centerX - box.width / 2) * 100
  const top = (box.centerY - box.height / 2) * 100
  const width = box.width * 100
  const height = box.height * 100

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div
        className={['absolute rounded-2xl border-2 transition-all duration-150 ease-out', borderColor, glow].join(' ')}
        style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
      >
        <span className={['absolute left-1 top-1 h-5 w-5 rounded-tl-xl border-l-2 border-t-2', borderColor].join(' ')} />
        <span className={['absolute right-1 top-1 h-5 w-5 rounded-tr-xl border-r-2 border-t-2', borderColor].join(' ')} />
        <span className={['absolute bottom-1 left-1 h-5 w-5 rounded-bl-xl border-b-2 border-l-2', borderColor].join(' ')} />
        <span className={['absolute bottom-1 right-1 h-5 w-5 rounded-br-xl border-b-2 border-r-2', borderColor].join(' ')} />
      </div>
    </div>
  )
}
