type CaptureProgressRingProps = {
  value: number
  centerLabel?: string
}

export function CaptureProgressRing({ value, centerLabel }: CaptureProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  const degrees = Math.round((clamped / 100) * 360)

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Progreso de capturas: ${clamped} por ciento`}
      className="flex h-28 w-28 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(#0B2D5B ${degrees}deg, #e2e8f0 ${degrees}deg)` }}
    >
      <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white text-brand-blue">
        <span className="text-xl font-black leading-none">{centerLabel ?? `${clamped}%`}</span>
      </div>
    </div>
  )
}
