import type { FaceAlignment } from '../services/faceAlignment'
import type { FaceBox } from '../services/facePresenceDetector'

type FaceDirectionArrowsProps = {
  alignment: FaceAlignment
  faceBox: FaceBox | null
  centerTargetY: number
  mirror?: boolean
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5l-7 7h14l-7-7z" />
    </svg>
  )
}

function InwardArrows({ animate }: { animate: boolean }) {
  const motionClass = animate ? 'motion-reduce:animate-none animate-guide-pulse-in' : ''
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-6">
      <Chevron className={['h-8 w-8 text-amber-200/90', motionClass].join(' ')} />
      <Chevron className={['h-10 w-10 text-amber-100', motionClass].join(' ')} />
      <Chevron className={['h-8 w-8 text-amber-200/90', motionClass].join(' ')} />
    </div>
  )
}

function OutwardArrows({ animate }: { animate: boolean }) {
  const motionClass = animate ? 'motion-reduce:animate-none animate-guide-pulse-out' : ''
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
      <Chevron className={['h-8 w-8 rotate-180 text-amber-200/90', motionClass].join(' ')} />
      <Chevron className={['h-10 w-10 rotate-180 text-amber-100', motionClass].join(' ')} />
      <Chevron className={['h-8 w-8 rotate-180 text-amber-200/90', motionClass].join(' ')} />
    </div>
  )
}

function CenteringArrow({
  faceBox,
  centerTargetY,
  mirror,
  animate,
}: {
  faceBox: FaceBox
  centerTargetY: number
  mirror: boolean
  animate: boolean
}) {
  const faceX = (mirror ? 1 - faceBox.centerX : faceBox.centerX) * 100
  const faceY = faceBox.centerY * 100
  const targetX = 50
  const targetY = centerTargetY * 100
  const dx = targetX - faceX
  const dy = targetY - faceY
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90
  const left = (faceX + targetX) / 2
  const top = (faceY + targetY) / 2

  return (
    <div
      className="absolute text-amber-100"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        transform: `translate(-50%, -50%) rotate(${angle}deg)`,
      }}
    >
      <Chevron className={['h-10 w-10', animate ? 'motion-reduce:animate-none animate-guide-pulse-in' : ''].join(' ')} />
    </div>
  )
}

export function FaceDirectionArrows({ alignment, faceBox, centerTargetY, mirror = false }: FaceDirectionArrowsProps) {
  const animate = typeof window !== 'undefined' ? !window.matchMedia('(prefers-reduced-motion: reduce)').matches : true

  if (alignment === 'aligned' || alignment === 'searching' || alignment === 'wrong_pose') {
    return null
  }

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {alignment === 'too_far' && <InwardArrows animate={animate} />}
      {alignment === 'too_close' && <OutwardArrows animate={animate} />}
      {alignment === 'off_center' && faceBox && (
        <CenteringArrow faceBox={faceBox} centerTargetY={centerTargetY} mirror={mirror} animate={animate} />
      )}
    </div>
  )
}
