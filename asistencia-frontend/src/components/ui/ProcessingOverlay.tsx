type ProcessingOverlayProps = {
  open: boolean
  title: string
  description?: string
  progress?: number
  scope?: 'viewport' | 'container'
}

export function ProcessingOverlay({
  open,
  title,
  description,
  progress,
  scope = 'viewport',
}: ProcessingOverlayProps) {
  if (!open) return null

  const positionClass =
    scope === 'viewport' ? 'fixed inset-0 z-[70]' : 'absolute inset-0 z-20'

  const clampedProgress =
    progress !== undefined ? Math.max(0, Math.min(100, Math.round(progress))) : undefined

  return (
    <div
      className={[
        positionClass,
        'flex items-center justify-center bg-slate-950/55 backdrop-blur-sm',
      ].join(' ')}
      aria-busy="true"
      aria-live="polite"
    >
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-white/95 p-6 text-center shadow-xl ring-1 ring-black/5">
        <span
          className="mx-auto block h-10 w-10 animate-spin rounded-full border-[3px] border-brand-blue border-t-transparent"
          aria-hidden="true"
        />
        <h3 className="mt-4 text-lg font-bold text-slate-950">{title}</h3>
        {description && <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>}
        {clampedProgress !== undefined && (
          <>
            <div className="mt-4 text-3xl font-black tabular-nums text-brand-blue">{clampedProgress}%</div>
            <div
              role="progressbar"
              aria-valuenow={clampedProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={title}
              className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200"
            >
              <div
                className="h-full rounded-full bg-brand-blue transition-all duration-300 ease-out"
                style={{ width: `${clampedProgress}%` }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
