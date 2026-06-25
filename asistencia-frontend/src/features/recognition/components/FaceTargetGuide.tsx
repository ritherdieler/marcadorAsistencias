import type { FaceAlignment } from '../services/faceAlignment'
import type { FaceAlignmentRuntimeConfig } from '../services/faceAlignmentConfig'
import type { FaceBox } from '../services/facePresenceDetector'
import {
  FACE_SILHOUETTE_PATH,
  FACE_SILHOUETTE_VIEWBOX,
  faceGuideSilhouetteCenter,
  faceGuideSilhouetteStyle,
  faceProximityProgress,
  faceTargetGuideDimensions,
} from '../services/faceGuideLayout'

type FaceTargetGuideProps = {
  alignment: FaceAlignment
  centerTargetY: number
  faceBox: FaceBox | null
  runtimeConfig: FaceAlignmentRuntimeConfig
  showProximityRing?: boolean
}

export function FaceTargetGuide({
  alignment,
  centerTargetY,
  faceBox,
  runtimeConfig,
  showProximityRing = true,
}: FaceTargetGuideProps) {
  const aligned = alignment === 'aligned'
  const warning =
    alignment === 'too_far' ||
    alignment === 'too_close' ||
    alignment === 'off_center' ||
    alignment === 'wrong_pose'

  const stroke = aligned ? '#34d399' : warning ? '#fcd34d' : 'rgba(255,255,255,0.72)'
  const innerStroke = aligned ? 'rgba(52,211,153,0.55)' : warning ? 'rgba(252,211,77,0.65)' : 'rgba(255,255,255,0.45)'
  const strokeWidth = aligned ? 2.2 : 1.8
  const strokeDasharray = aligned ? undefined : '7 5'

  const band = faceTargetGuideDimensions(
    runtimeConfig.targetWidthPercent,
    runtimeConfig.maxTargetWidthPercent,
  )
  const center = faceGuideSilhouetteCenter()
  const innerTransform = `translate(${center.x} ${center.y}) scale(${band.innerScale}) translate(${-center.x} ${-center.y})`

  const progress = faceBox ? faceProximityProgress(faceBox.width, runtimeConfig) : 0
  const showRing = showProximityRing && !aligned && progress > 0

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div
        className={[
          'absolute transition-all duration-200 ease-out',
          aligned ? 'drop-shadow-[0_0_22px_rgba(52,211,153,0.55)]' : '',
        ].join(' ')}
        style={faceGuideSilhouetteStyle(band.outerWidthPercent, centerTargetY)}
      >
        <svg
          viewBox={`${FACE_SILHOUETTE_VIEWBOX.x} ${FACE_SILHOUETTE_VIEWBOX.y} ${FACE_SILHOUETTE_VIEWBOX.width} ${FACE_SILHOUETTE_VIEWBOX.height}`}
          className="h-full w-full overflow-visible"
          preserveAspectRatio="xMidYMid meet"
        >
          <path
            d={FACE_SILHOUETTE_PATH}
            fill="rgba(255,255,255,0.03)"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {band.innerScale < 0.995 && (
            <path
              d={FACE_SILHOUETTE_PATH}
              fill="none"
              stroke={innerStroke}
              strokeWidth={1.4}
              strokeDasharray="4 4"
              strokeLinecap="round"
              strokeLinejoin="round"
              transform={innerTransform}
            />
          )}
          {showRing && (
            <path
              d={FACE_SILHOUETTE_PATH}
              fill="none"
              stroke="#34d399"
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={100}
              strokeDasharray="100"
              strokeDashoffset={100 - progress * 100}
              className="transition-[stroke-dashoffset] duration-200 ease-out"
              transform={innerTransform}
            />
          )}
        </svg>
      </div>
    </div>
  )
}
