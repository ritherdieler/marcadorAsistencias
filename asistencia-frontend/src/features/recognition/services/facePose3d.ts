export type FacePose = 'front' | 'left' | 'right' | 'unknown'

export type FacePose3d = {
  yaw: number
  pitch: number
  roll: number
}

export type FacePoseYawThresholds = {
  frontMaxAbsYaw: number
  turnMinAbsYaw: number
}

const DEFAULT_YAW_THRESHOLDS: FacePoseYawThresholds = {
  frontMaxAbsYaw: 12,
  turnMinAbsYaw: 18,
}

const NOSE_TIP_INDEX = 1
const LEFT_EYE_OUTER_INDEX = 33
const RIGHT_EYE_OUTER_INDEX = 263
const FACE_POSE_FRONT_THRESHOLD = 0.09
const FACE_POSE_TURN_THRESHOLD = 0.105

type NormalizedPoint = {
  x: number
  y: number
}

type FaceBounds = {
  minX: number
  minY: number
  width: number
  height: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI
}

function computeBounds(landmarks: NormalizedPoint[]): FaceBounds | null {
  if (!landmarks.length) return null

  let minX = 1
  let minY = 1
  let maxX = 0
  let maxY = 0

  for (const point of landmarks) {
    if (point.x < minX) minX = point.x
    if (point.x > maxX) maxX = point.x
    if (point.y < minY) minY = point.y
    if (point.y > maxY) maxY = point.y
  }

  return { minX, minY, width: maxX - minX, height: maxY - minY }
}

export function extractFacePose3d(matrix: { rows: number; columns: number; data: number[] }): FacePose3d | null {
  if (matrix.rows < 3 || matrix.columns < 3 || matrix.data.length < 9) return null

  const r00 = matrix.data[0]
  const r10 = matrix.data[4]
  const r20 = matrix.data[8]
  const r21 = matrix.data[9]
  const r22 = matrix.data[10]

  const pitch = Math.asin(clamp(-r20, -1, 1))
  const yaw = Math.atan2(r10, r00)
  const roll = Math.atan2(r21, r22)

  return {
    yaw: radToDeg(yaw),
    pitch: radToDeg(pitch),
    roll: radToDeg(roll),
  }
}

export function deriveFacePoseFromYaw(
  yaw: number,
  thresholds: FacePoseYawThresholds = DEFAULT_YAW_THRESHOLDS,
): FacePose {
  const absYaw = Math.abs(yaw)
  if (absYaw <= thresholds.frontMaxAbsYaw) return 'front'
  if (yaw >= thresholds.turnMinAbsYaw) return 'left'
  if (yaw <= -thresholds.turnMinAbsYaw) return 'right'
  return 'unknown'
}

export function estimateFacePoseFromLandmarks(landmarks: NormalizedPoint[]): FacePose {
  const nose = landmarks[NOSE_TIP_INDEX]
  const leftEye = landmarks[LEFT_EYE_OUTER_INDEX]
  const rightEye = landmarks[RIGHT_EYE_OUTER_INDEX]
  const box = computeBounds(landmarks)
  if (!nose || !leftEye || !rightEye || !box || box.width <= 0) return 'unknown'

  const eyeCenterX = (leftEye.x + rightEye.x) / 2
  const noseOffsetRatio = (nose.x - eyeCenterX) / box.width

  if (Math.abs(noseOffsetRatio) <= FACE_POSE_FRONT_THRESHOLD) return 'front'
  if (noseOffsetRatio >= FACE_POSE_TURN_THRESHOLD) return 'left'
  if (noseOffsetRatio <= -FACE_POSE_TURN_THRESHOLD) return 'right'
  return 'unknown'
}
