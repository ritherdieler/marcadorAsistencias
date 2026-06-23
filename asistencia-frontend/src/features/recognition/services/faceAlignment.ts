import type { FaceAlignmentRuntimeConfig } from './faceAlignmentConfig'
import { DEFAULT_FACE_COVERAGE_CONFIG, toRuntimeConfig } from './faceAlignmentConfig'
import type { FaceBox, FacePose } from './facePresenceDetector'

export type FaceAlignment =
  | 'searching'
  | 'too_far'
  | 'too_close'
  | 'off_center'
  | 'wrong_pose'
  | 'aligned'

export type FaceAlignmentMessageOptions = {
  widthPercent?: number
  targetPercent?: number
  poseInstruction?: string
}

export const DEFAULT_REGISTRATION_RUNTIME_CONFIG = toRuntimeConfig('registration', DEFAULT_FACE_COVERAGE_CONFIG)

export function getFaceWidthPercent(box: FaceBox | null): number {
  return box ? Math.round(box.width * 100) : 0
}

export function evaluateFaceAlignment(
  box: FaceBox,
  pose: FacePose,
  expectedPose: FacePose | null,
  config: FaceAlignmentRuntimeConfig,
): FaceAlignment {
  if (box.width < config.minFaceWidth) return 'too_far'
  if (box.width > config.maxFaceWidth) return 'too_close'

  const tolerance =
    expectedPose && expectedPose !== 'front' ? config.centerToleranceTurn : config.centerToleranceFront
  const offCenterX = Math.abs(box.centerX - 0.5) > tolerance
  const offCenterY = Math.abs(box.centerY - config.centerTargetY) > tolerance + 0.06
  if (offCenterX || offCenterY) return 'off_center'

  if (expectedPose && pose !== expectedPose) return 'wrong_pose'
  return 'aligned'
}

function widthPrefix(options: FaceAlignmentMessageOptions, fallbackTarget: number): string {
  if (options.widthPercent === undefined) return ''
  const target = options.targetPercent ?? fallbackTarget
  return `Rostro al ${options.widthPercent}% de ancho. Objetivo: ${target}%. `
}

export function faceAlignmentMessage(
  alignment: FaceAlignment,
  options?: FaceAlignmentMessageOptions | string,
  fallbackTarget = DEFAULT_REGISTRATION_RUNTIME_CONFIG.targetWidthPercent,
): string {
  const opts: FaceAlignmentMessageOptions =
    typeof options === 'string' ? { poseInstruction: options } : (options ?? {})
  const prefix = widthPrefix(opts, fallbackTarget)

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
