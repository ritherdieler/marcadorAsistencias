import type { FaceBox, FacePose } from './facePresenceDetector'

export type FaceAlignment =
  | 'searching'
  | 'too_far'
  | 'too_close'
  | 'off_center'
  | 'wrong_pose'
  | 'aligned'

export const FACE_ALIGNMENT_TARGET_WIDTH_PERCENT = 30

export const FACE_ALIGNMENT = {
  minFaceWidth: 0.3,
  maxFaceWidth: 0.75,
  centerToleranceFront: 0.16,
  centerToleranceTurn: 0.3,
  centerTargetY: 0.46,
} as const

export type FaceAlignmentMessageOptions = {
  widthPercent?: number
  targetPercent?: number
  poseInstruction?: string
}

export function getFaceWidthPercent(box: FaceBox | null): number {
  return box ? Math.round(box.width * 100) : 0
}

export function evaluateFaceAlignment(
  box: FaceBox,
  pose: FacePose,
  expectedPose: FacePose | null,
): FaceAlignment {
  if (box.width < FACE_ALIGNMENT.minFaceWidth) return 'too_far'
  if (box.width > FACE_ALIGNMENT.maxFaceWidth) return 'too_close'

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

function widthPrefix(options: FaceAlignmentMessageOptions): string {
  if (options.widthPercent === undefined) return ''
  const target = options.targetPercent ?? FACE_ALIGNMENT_TARGET_WIDTH_PERCENT
  return `Rostro al ${options.widthPercent}% de ancho. Objetivo: ${target}%. `
}

export function faceAlignmentMessage(
  alignment: FaceAlignment,
  options?: FaceAlignmentMessageOptions | string,
): string {
  const opts: FaceAlignmentMessageOptions =
    typeof options === 'string' ? { poseInstruction: options } : (options ?? {})
  const prefix = widthPrefix(opts)

  switch (alignment) {
    case 'too_far':
      return `${prefix}Acercate un poco a la camara.`
    case 'too_close':
      return `${prefix}Alejate un poco de la camara.`
    case 'off_center':
      return `${prefix}Centra tu rostro dentro del marco.`
    case 'wrong_pose':
      return `${prefix}${opts.poseInstruction ?? 'Ajusta la posicion del rostro.'}`
    case 'searching':
      return 'Coloca tu rostro dentro del marco.'
    default:
      return prefix ? `${prefix}Posicion correcta.` : 'Posicion correcta.'
  }
}
