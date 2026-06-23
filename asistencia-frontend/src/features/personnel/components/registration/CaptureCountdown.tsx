type CaptureCountdownProps = {
  value: number | null
}

export function CaptureCountdown({ value }: CaptureCountdownProps) {
  if (!value) return null

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
      <div className="flex h-24 w-24 animate-pulse items-center justify-center rounded-full bg-slate-950/55 text-5xl font-black text-white backdrop-blur-sm ring-2 ring-emerald-300/80">
        {value}
      </div>
    </div>
  )
}
