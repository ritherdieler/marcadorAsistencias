import type { FaceBox, FacePose } from './facePresenceDetector'

export type FaceAlignment =
  | 'searching'
  | 'too_far'
  | 'too_close'
  | 'off_center'
  | 'wrong_pose'
  | 'aligned'

export const FACE_ALIGNMENT = {
  minFaceArea: 0.045,
  maxFaceArea: 0.62,
  centerToleranceFront: 0.16,
  centerToleranceTurn: 0.3,
  centerTargetY: 0.46,
} as const

/**
 * Evaluates whether a detected face is well positioned for capture.
 * Pass `expectedPose = null` to skip the pose check (e.g. attendance, where any
 * well-framed frontal-ish face is acceptable).
 */
export function evaluateFaceAlignment(
  box: FaceBox,
  pose: FacePose,
  expectedPose: FacePose | null,
): FaceAlignment {
  const area = box.width * box.height
  if (area < FACE_ALIGNMENT.minFaceArea) return 'too_far'
  if (area > FACE_ALIGNMENT.maxFaceArea) return 'too_close'

  const tolerance =
    expectedPose && expectedPose !== 'front'
      ? FACE_ALIGNMENT.centerToleranceTurn
      : FACE_ALIGNMENT.centerToleranceFront
  const offCenterX = Math.abs(box.centerX - 0.5) > tolerance
  const offCenterY = Math.abs(box.centerY - FACE_ALIGNMENT.centerTargetY) > tolerance + 0.06
  if (offCenterX || offCenterY) return 'off_center'

  if (expectedPose && pose !== expectedPose) return 'wrong_pose'
  return 'aligned'
}

export function faceAlignmentMessage(alignment: FaceAlignment, poseInstruction?: string): string {
  switch (alignment) {
    case 'too_far':
      return 'Acercate un poco a la camara.'
    case 'too_close':
      return 'Alejate un poco de la camara.'
    case 'off_center':
      return 'Centra tu rostro dentro del marco.'
    case 'wrong_pose':
      return poseInstruction ?? 'Ajusta la posicion del rostro.'
    case 'searching':
      return 'Coloca tu rostro dentro del marco.'
    default:
      return 'Posicion correcta.'
  }
}
