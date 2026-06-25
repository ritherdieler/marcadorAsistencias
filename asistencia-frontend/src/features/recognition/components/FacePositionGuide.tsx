import type { FaceAlignment } from '../services/faceAlignment'
import type { FaceAlignmentRuntimeConfig, FaceGuideSettings } from '../services/faceAlignmentConfig'
import type { FaceBox } from '../services/facePresenceDetector'
import { FaceDirectionArrows } from './FaceDirectionArrows'
import { FaceGuideScrim } from './FaceGuideScrim'
import { FaceTargetGuide } from './FaceTargetGuide'
import { FaceZoneBar } from './FaceZoneBar'

type FacePositionGuideProps = {
  alignment: FaceAlignment
  faceBox: FaceBox | null
  runtimeConfig: FaceAlignmentRuntimeConfig
  faceGuide: FaceGuideSettings
  mirror?: boolean
}

export function FacePositionGuide({
  alignment,
  faceBox,
  runtimeConfig,
  faceGuide,
  mirror = false,
}: FacePositionGuideProps) {
  const showAny =
    faceGuide.showTargetOval ||
    faceGuide.showDirectionArrows ||
    faceGuide.showZoneBar ||
    faceGuide.dimOutside
  if (!showAny) return null

  return (
    <>
      {faceGuide.dimOutside && (
        <FaceGuideScrim
          maxTargetWidthPercent={runtimeConfig.maxTargetWidthPercent}
          centerTargetY={runtimeConfig.centerTargetY}
        />
      )}
      {faceGuide.showTargetOval && (
        <FaceTargetGuide
          alignment={alignment}
          centerTargetY={runtimeConfig.centerTargetY}
          faceBox={faceBox}
          runtimeConfig={runtimeConfig}
          showProximityRing={faceGuide.showProximityRing}
        />
      )}
      {faceGuide.showDirectionArrows && (
        <FaceDirectionArrows
          alignment={alignment}
          faceBox={faceBox}
          centerTargetY={runtimeConfig.centerTargetY}
          mirror={mirror}
        />
      )}
      {faceGuide.showZoneBar && (
        <FaceZoneBar alignment={alignment} faceBox={faceBox} runtimeConfig={runtimeConfig} />
      )}
    </>
  )
}
