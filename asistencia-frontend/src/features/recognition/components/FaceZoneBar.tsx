import type { FaceAlignment } from '../services/faceAlignment'
import { getFaceWidthPercent } from '../services/faceAlignment'
import type { FaceAlignmentRuntimeConfig } from '../services/faceAlignmentConfig'
import type { FaceBox } from '../services/facePresenceDetector'
import { zoneBarIndicatorPercent } from '../services/faceGuideLayout'

type FaceZoneBarProps = {
  alignment: FaceAlignment
  faceBox: FaceBox | null
  runtimeConfig: FaceAlignmentRuntimeConfig
}

const ZONE_LEJOS_END = 100 / 3
const ZONE_BIEN_END = (100 / 3) * 2

export function FaceZoneBar({ alignment, faceBox, runtimeConfig }: FaceZoneBarProps) {
  const widthPercent = faceBox ? getFaceWidthPercent(faceBox) : 0
  const minPercent = runtimeConfig.minFaceWidth * 100
  const maxPercent = runtimeConfig.maxFaceWidth * 100
  const aligned = alignment === 'aligned'
  const dotLeft = faceBox ? zoneBarIndicatorPercent(widthPercent, minPercent, maxPercent) : 0

  const dotClass =
    aligned
      ? 'bg-emerald-400'
      : alignment === 'too_close' || alignment === 'too_far'
        ? 'bg-amber-400'
        : 'bg-white'

  return (
    <div
      className="pointer-events-none absolute bottom-3 left-1/2 z-10 w-[min(90%,16rem)] -translate-x-1/2"
      aria-hidden="true"
    >
      <div
        className={[
          'relative h-2.5 overflow-hidden rounded-full ring-1 ring-white/20',
          aligned ? 'bg-emerald-950/40' : 'bg-slate-950/50',
        ].join(' ')}
      >
        <div
          className="absolute inset-y-0 left-0 bg-amber-400/35"
          style={{ width: `${ZONE_LEJOS_END}%` }}
        />
        <div
          className={[
            'absolute inset-y-0 bg-emerald-400/45',
            aligned ? 'opacity-100' : 'opacity-70',
          ].join(' ')}
          style={{ left: `${ZONE_LEJOS_END}%`, width: `${ZONE_BIEN_END - ZONE_LEJOS_END}%` }}
        />
        <div
          className="absolute inset-y-0 bg-amber-400/35"
          style={{ left: `${ZONE_BIEN_END}%`, width: `${100 - ZONE_BIEN_END}%` }}
        />
        <div
          className={[
            'absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md transition-[left] duration-150 ease-out',
            dotClass,
          ].join(' ')}
          style={{ left: `${dotLeft}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] font-semibold uppercase tracking-wide text-white/80">
        <span>Lejos</span>
        <span>Bien</span>
        <span>Cerca</span>
      </div>
    </div>
  )
}
