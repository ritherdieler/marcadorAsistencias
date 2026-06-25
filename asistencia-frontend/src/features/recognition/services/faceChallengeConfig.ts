export type FaceChallengeStepId = 'center' | 'turn' | 'recenter' | 'blink'

export type FaceChallengeTurnType = 'LEFT_TURN' | 'RIGHT_TURN'

export type FaceChallengeStepSettings = {
  enabled: boolean
  requiredSamples: number
}

export type FaceChallengeTurnStepSettings = {
  enabled: boolean
  requiredTurns: number
  requiredSamples: number
  centerSamplesAfterTurn: number
}

export type FaceChallengeSteps = {
  center: FaceChallengeStepSettings
  turn: FaceChallengeTurnStepSettings
  recenter: FaceChallengeStepSettings
  blink: FaceChallengeStepSettings
}

export type FaceChallengeThresholds = {
  yawFrontDeg: number
  yawTurnDeg: number
  blinkOpenMax: number
  blinkClosedMin: number
}

export type FaceChallengeConfig = {
  enabled: boolean
  mirrorSelfiePerspective: boolean
  usePose3d: boolean
  steps: FaceChallengeSteps
  thresholds: FaceChallengeThresholds
}

export const FACE_CHALLENGE_STORAGE_KEY = 'giga-face-challenge-config'
export const FACE_CHALLENGE_CONFIG_EVENT = 'giga-face-challenge-config-changed'

export const FACE_CHALLENGE_MIN_SAMPLES = 1
export const FACE_CHALLENGE_MAX_SAMPLES = 10

export const FACE_CHALLENGE_MIN_YAW_FRONT = 3
export const FACE_CHALLENGE_MAX_YAW_FRONT = 20
export const FACE_CHALLENGE_MIN_YAW_TURN = 10
export const FACE_CHALLENGE_MAX_YAW_TURN = 45

export const FACE_CHALLENGE_MIN_BLINK_OPEN = 0.05
export const FACE_CHALLENGE_MAX_BLINK_OPEN = 0.5
export const FACE_CHALLENGE_MIN_BLINK_CLOSED = 0.3
export const FACE_CHALLENGE_MAX_BLINK_CLOSED = 0.9

export const FACE_CHALLENGE_STEP_ORDER: FaceChallengeStepId[] = ['center', 'turn', 'recenter', 'blink']

export const FACE_CHALLENGE_STEP_LABELS: Record<FaceChallengeStepId, string> = {
  center: 'Centro inicial',
  turn: 'Giro lateral',
  recenter: 'Volver al centro',
  blink: 'Parpadeo',
}

const DEFAULT_TURN_STEP_SETTINGS: FaceChallengeTurnStepSettings = {
  enabled: true,
  requiredTurns: 1,
  requiredSamples: 1,
  centerSamplesAfterTurn: 1,
}

const DEFAULT_STEP_SETTINGS: Record<Exclude<FaceChallengeStepId, 'turn'>, FaceChallengeStepSettings> = {
  center: { enabled: true, requiredSamples: 2 },
  recenter: { enabled: true, requiredSamples: 2 },
  blink: { enabled: true, requiredSamples: 1 },
}

export const DEFAULT_FACE_CHALLENGE_CONFIG: FaceChallengeConfig = {
  enabled: true,
  mirrorSelfiePerspective: false,
  usePose3d: false,
  steps: {
    center: { ...DEFAULT_STEP_SETTINGS.center },
    turn: { ...DEFAULT_TURN_STEP_SETTINGS },
    recenter: { ...DEFAULT_STEP_SETTINGS.recenter },
    blink: { ...DEFAULT_STEP_SETTINGS.blink },
  },
  thresholds: {
    yawFrontDeg: 8,
    yawTurnDeg: 18,
    blinkOpenMax: 0.25,
    blinkClosedMin: 0.55,
  },
}

export function clampRequiredSamples(value: number): number {
  return Math.min(FACE_CHALLENGE_MAX_SAMPLES, Math.max(FACE_CHALLENGE_MIN_SAMPLES, Math.round(value)))
}

export function clampYawFrontDeg(value: number): number {
  return Math.min(FACE_CHALLENGE_MAX_YAW_FRONT, Math.max(FACE_CHALLENGE_MIN_YAW_FRONT, Math.round(value)))
}

export function clampYawTurnDeg(value: number): number {
  return Math.min(FACE_CHALLENGE_MAX_YAW_TURN, Math.max(FACE_CHALLENGE_MIN_YAW_TURN, Math.round(value)))
}

export function clampBlinkOpenMax(value: number): number {
  const clamped = Math.min(FACE_CHALLENGE_MAX_BLINK_OPEN, Math.max(FACE_CHALLENGE_MIN_BLINK_OPEN, value))
  return Math.round(clamped * 100) / 100
}

export function clampBlinkClosedMin(value: number): number {
  const clamped = Math.min(FACE_CHALLENGE_MAX_BLINK_CLOSED, Math.max(FACE_CHALLENGE_MIN_BLINK_CLOSED, value))
  return Math.round(clamped * 100) / 100
}

function normalizeStepSettings(
  source: Partial<FaceChallengeStepSettings> | undefined,
  fallback: FaceChallengeStepSettings,
): FaceChallengeStepSettings {
  return {
    enabled: source?.enabled ?? fallback.enabled,
    requiredSamples: clampRequiredSamples(source?.requiredSamples ?? fallback.requiredSamples),
  }
}

function normalizeTurnStepSettings(
  source: Partial<FaceChallengeTurnStepSettings> | undefined,
  fallback: FaceChallengeTurnStepSettings,
): FaceChallengeTurnStepSettings {
  const enabled = source?.enabled ?? fallback.enabled
  const hasExplicitTurns = source?.requiredTurns !== undefined

  let requiredTurns: number
  let requiredSamples: number

  if (hasExplicitTurns) {
    requiredTurns = clampRequiredSamples(source!.requiredTurns!)
    requiredSamples = clampRequiredSamples(source?.requiredSamples ?? fallback.requiredSamples)
  } else if (source?.requiredSamples !== undefined) {
    requiredTurns = clampRequiredSamples(source.requiredSamples)
    requiredSamples = fallback.requiredSamples
  } else {
    requiredTurns = fallback.requiredTurns
    requiredSamples = fallback.requiredSamples
  }

  return {
    enabled,
    requiredTurns,
    requiredSamples,
    centerSamplesAfterTurn: clampRequiredSamples(
      source?.centerSamplesAfterTurn ?? fallback.centerSamplesAfterTurn,
    ),
  }
}

export function normalizeFaceChallengeConfig(raw: unknown): FaceChallengeConfig {
  const source = typeof raw === 'object' && raw !== null ? (raw as Partial<FaceChallengeConfig>) : {}
  const sourceSteps = (source.steps ?? {}) as Partial<FaceChallengeSteps>

  const steps: FaceChallengeSteps = {
    center: normalizeStepSettings(sourceSteps.center, DEFAULT_FACE_CHALLENGE_CONFIG.steps.center),
    turn: normalizeTurnStepSettings(sourceSteps.turn, DEFAULT_FACE_CHALLENGE_CONFIG.steps.turn),
    recenter: normalizeStepSettings(sourceSteps.recenter, DEFAULT_FACE_CHALLENGE_CONFIG.steps.recenter),
    blink: normalizeStepSettings(sourceSteps.blink, DEFAULT_FACE_CHALLENGE_CONFIG.steps.blink),
  }

  const allDisabled = FACE_CHALLENGE_STEP_ORDER.every((stepId) => !steps[stepId].enabled)
  if (allDisabled) {
    steps.center = { ...steps.center, enabled: true }
  }

  const sourceThresholds = (source.thresholds ?? {}) as Partial<FaceChallengeThresholds>

  return {
    enabled: source.enabled ?? DEFAULT_FACE_CHALLENGE_CONFIG.enabled,
    mirrorSelfiePerspective: source.mirrorSelfiePerspective ?? DEFAULT_FACE_CHALLENGE_CONFIG.mirrorSelfiePerspective,
    usePose3d: source.usePose3d ?? DEFAULT_FACE_CHALLENGE_CONFIG.usePose3d,
    steps,
    thresholds: {
      yawFrontDeg: clampYawFrontDeg(sourceThresholds.yawFrontDeg ?? DEFAULT_FACE_CHALLENGE_CONFIG.thresholds.yawFrontDeg),
      yawTurnDeg: clampYawTurnDeg(sourceThresholds.yawTurnDeg ?? DEFAULT_FACE_CHALLENGE_CONFIG.thresholds.yawTurnDeg),
      blinkOpenMax: clampBlinkOpenMax(sourceThresholds.blinkOpenMax ?? DEFAULT_FACE_CHALLENGE_CONFIG.thresholds.blinkOpenMax),
      blinkClosedMin: clampBlinkClosedMin(
        sourceThresholds.blinkClosedMin ?? DEFAULT_FACE_CHALLENGE_CONFIG.thresholds.blinkClosedMin,
      ),
    },
  }
}

export function buildEnabledChallengeSteps(config: FaceChallengeConfig): FaceChallengeStepId[] {
  const enabled = FACE_CHALLENGE_STEP_ORDER.filter((stepId) => config.steps[stepId].enabled)
  return enabled.length > 0 ? enabled : ['center']
}

export function loadFaceChallengeConfig(): FaceChallengeConfig {
  try {
    const raw = localStorage.getItem(FACE_CHALLENGE_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_FACE_CHALLENGE_CONFIG, steps: { ...DEFAULT_FACE_CHALLENGE_CONFIG.steps } }
    return normalizeFaceChallengeConfig(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_FACE_CHALLENGE_CONFIG, steps: { ...DEFAULT_FACE_CHALLENGE_CONFIG.steps } }
  }
}

export function saveFaceChallengeConfig(config: FaceChallengeConfig): FaceChallengeConfig {
  const normalized = normalizeFaceChallengeConfig(config)
  localStorage.setItem(FACE_CHALLENGE_STORAGE_KEY, JSON.stringify(normalized))
  window.dispatchEvent(new Event(FACE_CHALLENGE_CONFIG_EVENT))
  return normalized
}

export function resetFaceChallengeConfig(): FaceChallengeConfig {
  localStorage.removeItem(FACE_CHALLENGE_STORAGE_KEY)
  window.dispatchEvent(new Event(FACE_CHALLENGE_CONFIG_EVENT))
  return { ...DEFAULT_FACE_CHALLENGE_CONFIG, steps: { ...DEFAULT_FACE_CHALLENGE_CONFIG.steps } }
}

function stepSettingsEqual(a: FaceChallengeStepSettings, b: FaceChallengeStepSettings): boolean {
  return a.enabled === b.enabled && a.requiredSamples === b.requiredSamples
}

export function pickRandomChallengeType(): FaceChallengeTurnType {
  return Math.random() < 0.5 ? 'LEFT_TURN' : 'RIGHT_TURN'
}

function turnStepSettingsEqual(a: FaceChallengeTurnStepSettings, b: FaceChallengeTurnStepSettings): boolean {
  return (
    a.enabled === b.enabled &&
    a.requiredTurns === b.requiredTurns &&
    a.requiredSamples === b.requiredSamples &&
    a.centerSamplesAfterTurn === b.centerSamplesAfterTurn
  )
}

export function faceChallengeConfigsEqual(a: FaceChallengeConfig, b: FaceChallengeConfig): boolean {
  return (
    a.enabled === b.enabled &&
    a.mirrorSelfiePerspective === b.mirrorSelfiePerspective &&
    a.usePose3d === b.usePose3d &&
    stepSettingsEqual(a.steps.center, b.steps.center) &&
    turnStepSettingsEqual(a.steps.turn, b.steps.turn) &&
    stepSettingsEqual(a.steps.recenter, b.steps.recenter) &&
    stepSettingsEqual(a.steps.blink, b.steps.blink) &&
    a.thresholds.yawFrontDeg === b.thresholds.yawFrontDeg &&
    a.thresholds.yawTurnDeg === b.thresholds.yawTurnDeg &&
    a.thresholds.blinkOpenMax === b.thresholds.blinkOpenMax &&
    a.thresholds.blinkClosedMin === b.thresholds.blinkClosedMin
  )
}
