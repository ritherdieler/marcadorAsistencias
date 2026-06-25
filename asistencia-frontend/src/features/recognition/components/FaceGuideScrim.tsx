import { useId } from 'react'

import { FACE_SILHOUETTE_PATH, FACE_SILHOUETTE_VIEWBOX } from '../services/faceGuideLayout'

type FaceGuideScrimProps = {
  maxTargetWidthPercent: number
  centerTargetY: number
  opacity?: number
}

const FRAME_WIDTH = 160
const FRAME_HEIGHT = 90

export function FaceGuideScrim({ maxTargetWidthPercent, centerTargetY, opacity = 0.5 }: FaceGuideScrimProps) {
  const maskId = useId()

  const widthUnits = (maxTargetWidthPercent / 100) * FRAME_WIDTH
  const heightUnits = widthUnits * (FACE_SILHOUETTE_VIEWBOX.height / FACE_SILHOUETTE_VIEWBOX.width)
  const holeX = FRAME_WIDTH / 2 - widthUnits / 2
  const holeY = centerTargetY * FRAME_HEIGHT - heightUnits / 2

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <svg
        viewBox={`0 0 ${FRAME_WIDTH} ${FRAME_HEIGHT}`}
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width={FRAME_WIDTH} height={FRAME_HEIGHT} fill="white" />
            <svg
              x={holeX}
              y={holeY}
              width={widthUnits}
              height={heightUnits}
              viewBox={`${FACE_SILHOUETTE_VIEWBOX.x} ${FACE_SILHOUETTE_VIEWBOX.y} ${FACE_SILHOUETTE_VIEWBOX.width} ${FACE_SILHOUETTE_VIEWBOX.height}`}
              preserveAspectRatio="none"
            >
              <path d={FACE_SILHOUETTE_PATH} fill="black" />
            </svg>
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width={FRAME_WIDTH}
          height={FRAME_HEIGHT}
          fill={`rgba(0,0,0,${opacity})`}
          mask={`url(#${maskId})`}
        />
      </svg>
    </div>
  )
}
