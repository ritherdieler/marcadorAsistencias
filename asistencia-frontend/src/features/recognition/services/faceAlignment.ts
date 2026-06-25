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
  maxTargetPercent?: number
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

  const useTurnTolerance = Boolean(expectedPose && expectedPose !== 'front')
  const tolerance = useTurnTolerance ? config.centerToleranceTurn : config.centerToleranceFront
  const offCenterX = Math.abs(box.centerX - 0.5) > tolerance
  const offCenterY = Math.abs(box.centerY - config.centerTargetY) > tolerance + 0.06
  if (offCenterX || offCenterY) return 'off_center'

  if (expectedPose && pose !== expectedPose) return 'wrong_pose'
  return 'aligned'
}

export function evaluateFaceDistance(
  box: FaceBox,
  config: FaceAlignmentRuntimeConfig,
): 'too_far' | 'too_close' | 'aligned' {
  if (box.width < config.minFaceWidth) return 'too_far'
  if (box.width > config.maxFaceWidth) return 'too_close'
  return 'aligned'
}

export function evaluateChallengeAlignmentGate(
  box: FaceBox,
  pose: FacePose,
  config: FaceAlignmentRuntimeConfig,
  progress: { stage: string; turnPhase: 'await_turn' | 'await_center' | null; turnCycleAssigned: boolean },
): FaceAlignment {
  const turningHead =
    progress.stage === 'turn' && progress.turnPhase === 'await_turn' && progress.turnCycleAssigned

  if (turningHead) {
    return evaluateFaceDistance(box, config)
  }

  return evaluateFaceAlignment(box, pose, null, config)
}

function widthPrefix(options: FaceAlignmentMessageOptions, fallbackTarget: number, fallbackMax?: number): string {
  if (options.widthPercent === undefined) return ''
  const target = options.targetPercent ?? fallbackTarget
  const maxTarget = options.maxTargetPercent ?? fallbackMax
  const band =
    maxTarget !== undefined && maxTarget > target ? `${target}–${maxTarget}%` : `${target}%`
  return `Rostro al ${options.widthPercent}% de ancho. Banda: ${band}. `
}

export function faceAlignmentMessage(
  alignment: FaceAlignment,
  options?: FaceAlignmentMessageOptions | string,
): string {
  const opts: FaceAlignmentMessageOptions =
    typeof options === 'string' ? { poseInstruction: options } : (options ?? {})

  switch (alignment) {
    case 'too_far':
      return 'Acercate un poco'
    case 'too_close':
      return 'Alejate un poco'
    case 'off_center':
      return 'Centra tu rostro en el marco'
    case 'wrong_pose':
      return opts.poseInstruction ?? 'Ajusta la posicion del rostro'
    case 'searching':
      return 'Coloca tu rostro dentro del marco'
    default:
      return 'Perfecto, manten la posicion'
  }
}

export function faceAlignmentDiagnosticMessage(
  alignment: FaceAlignment,
  options: FaceAlignmentMessageOptions,
  fallbackTarget = DEFAULT_REGISTRATION_RUNTIME_CONFIG.targetWidthPercent,
  fallbackMax = DEFAULT_REGISTRATION_RUNTIME_CONFIG.maxTargetWidthPercent,
): string {
  const prefix = widthPrefix(options, fallbackTarget, fallbackMax)
  const userMessage = faceAlignmentMessage(alignment, options)
  if (!prefix) return userMessage
  return `${prefix.trim()} ${userMessage}`
}
