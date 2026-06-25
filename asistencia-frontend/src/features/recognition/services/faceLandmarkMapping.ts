import type { ArcFaceLandmarks } from '../../../services/arcFaceAlignment'

const LEFT_EYE_OUTER_INDEX = 33
const RIGHT_EYE_OUTER_INDEX = 263
const NOSE_TIP_INDEX = 1
const LEFT_MOUTH_CORNER_INDEX = 61
const RIGHT_MOUTH_CORNER_INDEX = 291

type LandmarkSource = {
  x: number
  y: number
}

export function landmarksToArcFaceLandmarks(
  landmarks: LandmarkSource[],
  width: number,
  height: number,
): ArcFaceLandmarks | null {
  const leftEye = landmarks[LEFT_EYE_OUTER_INDEX]
  const rightEye = landmarks[RIGHT_EYE_OUTER_INDEX]
  const nose = landmarks[NOSE_TIP_INDEX]
  const leftMouth = landmarks[LEFT_MOUTH_CORNER_INDEX]
  const rightMouth = landmarks[RIGHT_MOUTH_CORNER_INDEX]

  if (!leftEye || !rightEye || !nose || !leftMouth || !rightMouth) return null
  if (width <= 0 || height <= 0) return null

  return {
    leftEye: { x: leftEye.x * width, y: leftEye.y * height },
    rightEye: { x: rightEye.x * width, y: rightEye.y * height },
    nose: { x: nose.x * width, y: nose.y * height },
    leftMouth: { x: leftMouth.x * width, y: leftMouth.y * height },
    rightMouth: { x: rightMouth.x * width, y: rightMouth.y * height },
  }
}
