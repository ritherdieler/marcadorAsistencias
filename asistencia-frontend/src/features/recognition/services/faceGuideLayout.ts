export const FACE_SILHOUETTE_PATH =
  'M50 7 C73 7 91 26 93 52 C94 70 88 88 74 104 C64 114 56 122 50 125 C44 122 36 114 26 104 C12 88 6 70 7 52 C9 26 27 7 50 7 Z'

export const FACE_SILHOUETTE_VIEWBOX = {
  x: 6,
  y: 7,
  width: 88,
  height: 118,
}

export const FACE_SILHOUETTE_HEIGHT_RATIO =
  FACE_SILHOUETTE_VIEWBOX.height / FACE_SILHOUETTE_VIEWBOX.width

export function faceTargetGuideDimensions(
  targetWidthPercent: number,
  maxTargetWidthPercent: number,
): {
  outerWidthPercent: number
  innerWidthPercent: number
  innerScale: number
  outerHeightPercent: number
} {
  const outerWidthPercent = maxTargetWidthPercent
  const innerScale = maxTargetWidthPercent > 0 ? targetWidthPercent / maxTargetWidthPercent : 1
  return {
    outerWidthPercent,
    innerWidthPercent: targetWidthPercent,
    innerScale,
    outerHeightPercent: outerWidthPercent * FACE_SILHOUETTE_HEIGHT_RATIO,
  }
}

export function faceGuideSilhouetteStyle(
  widthPercent: number,
  centerTargetY: number,
): {
  width: string
  aspectRatio: string
  left: string
  top: string
  transform: string
} {
  return {
    width: `${widthPercent}%`,
    aspectRatio: `${FACE_SILHOUETTE_VIEWBOX.width} / ${FACE_SILHOUETTE_VIEWBOX.height}`,
    left: '50%',
    top: `${centerTargetY * 100}%`,
    transform: 'translate(-50%, -50%)',
  }
}

export function faceGuideSilhouetteCenter(): { x: number; y: number } {
  return {
    x: FACE_SILHOUETTE_VIEWBOX.x + FACE_SILHOUETTE_VIEWBOX.width / 2,
    y: FACE_SILHOUETTE_VIEWBOX.y + FACE_SILHOUETTE_VIEWBOX.height / 2,
  }
}

export function faceProximityProgress(
  faceWidth: number,
  runtimeConfig: { minFaceWidth: number; maxFaceWidth: number },
): number {
  const { minFaceWidth, maxFaceWidth } = runtimeConfig
  const target = minFaceWidth
  const floor = target * 0.5

  if (faceWidth > maxFaceWidth) return 0
  if (target <= floor) return faceWidth >= target && faceWidth <= maxFaceWidth ? 1 : 0
  if (faceWidth <= floor) return 0
  if (faceWidth < target) {
    return Math.min(1, (faceWidth - floor) / (target - floor))
  }
  return 1
}

export function zoneBarIndicatorPercent(
  widthPercent: number,
  minFaceWidthPercent: number,
  maxFaceWidthPercent: number,
): number {
  const lejosZoneEnd = 100 / 3
  const bienZoneEnd = (100 / 3) * 2

  if (widthPercent > maxFaceWidthPercent) {
    const overflowSpan = Math.max(maxFaceWidthPercent * 0.3, 5)
    const progress = Math.min(1, (widthPercent - maxFaceWidthPercent) / overflowSpan)
    return bienZoneEnd + progress * (100 - bienZoneEnd)
  }

  if (widthPercent < minFaceWidthPercent) {
    const floor = minFaceWidthPercent * 0.5
    if (minFaceWidthPercent <= floor) return 0
    const progress = Math.min(1, Math.max(0, (widthPercent - floor) / (minFaceWidthPercent - floor)))
    return progress * lejosZoneEnd
  }

  const bandSpan = maxFaceWidthPercent - minFaceWidthPercent
  if (bandSpan <= 0) return lejosZoneEnd + (bienZoneEnd - lejosZoneEnd) / 2

  const progress = Math.min(1, Math.max(0, (widthPercent - minFaceWidthPercent) / bandSpan))
  return lejosZoneEnd + progress * (bienZoneEnd - lejosZoneEnd)
}
