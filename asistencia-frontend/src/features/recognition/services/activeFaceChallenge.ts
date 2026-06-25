import type { FacePose } from './facePose3d'
import {
  buildEnabledChallengeSteps,
  loadFaceChallengeConfig,
  pickRandomChallengeType,
  type FaceChallengeConfig,
  type FaceChallengeStepId,
} from './faceChallengeConfig'
import {
  expectedTurnPose,
  resolveFacePose,
  type FacePoseAnalysisInput,
} from './facePoseResolver'

export type FaceChallengeType = 'LEFT_TURN' | 'RIGHT_TURN'
export type FaceChallengeStage = FaceChallengeStepId | 'passed'

export interface FaceChallengeStep {
  stage: FaceChallengeStage
  passed: boolean
  prompt: string
}

export type FaceAnalysisInput = FacePoseAnalysisInput & {
  blinkScore?: number
  blinkCycleComplete?: boolean
}

const TURN_HINT: Record<FaceChallengeType, string> = {
  LEFT_TURN: 'a tu izquierda',
  RIGHT_TURN: 'a tu derecha',
}

export type FaceChallengeProgress = {
  stage: FaceChallengeStage
  turnPhase: 'await_turn' | 'await_center' | null
  turnCycleAssigned: boolean
}

export interface ActiveFaceChallenge {
  readonly type: FaceChallengeType
  getProgress: () => FaceChallengeProgress
  submitAnalysis: (input: FaceAnalysisInput) => FaceChallengeStep
  submitPose: (pose: FacePose) => FaceChallengeStep
  reset: () => void
}

function isStepSatisfied(
  stepId: FaceChallengeStepId,
  pose: FacePose,
  input: FaceAnalysisInput,
  blinkCycleDetected: boolean,
): boolean {
  switch (stepId) {
    case 'center':
    case 'recenter':
      return pose === 'front'
    case 'turn':
      return false
    case 'blink':
      if (input.blinkCycleComplete === true) {
        return true
      }
      return blinkCycleDetected
  }
}

function detectBlinkCycle(
  blinkScore: number | undefined,
  thresholds: FaceChallengeConfig['thresholds'],
  blinkState: { sawClosed: boolean; sawOpenAfterClose: boolean },
): boolean {
  if (blinkScore === undefined) {
    return false
  }

  if (!blinkState.sawClosed) {
    if (blinkScore >= thresholds.blinkClosedMin) {
      blinkState.sawClosed = true
    }
    return false
  }

  if (!blinkState.sawOpenAfterClose && blinkScore <= thresholds.blinkOpenMax) {
    blinkState.sawOpenAfterClose = true
    return true
  }

  return false
}

export function createActiveFaceChallenge(
  type: FaceChallengeType,
  config: FaceChallengeConfig = loadFaceChallengeConfig(),
): ActiveFaceChallenge {
  const mirror = config.mirrorSelfiePerspective
  const sequence = buildEnabledChallengeSteps(config)
  let stepIndex = 0
  let hits = 0
  let turnCyclesCompleted = 0
  let turnPhase: 'await_turn' | 'await_center' = 'await_turn'
  let currentTurnType: FaceChallengeType = type
  let turnCycleTypeAssigned = false
  const blinkState = { sawClosed: false, sawOpenAfterClose: false }

  const currentStepId = (): FaceChallengeStepId => sequence[stepIndex] ?? 'center'

  const turnSettings = config.steps.turn

  const beginTurnCycle = () => {
    if (turnCyclesCompleted > 0) {
      currentTurnType = pickRandomChallengeType()
    }
    turnPhase = 'await_turn'
    turnCycleTypeAssigned = true
  }

  const reset = () => {
    stepIndex = 0
    hits = 0
    turnCyclesCompleted = 0
    turnPhase = 'await_turn'
    currentTurnType = type
    turnCycleTypeAssigned = false
    blinkState.sawClosed = false
    blinkState.sawOpenAfterClose = false
  }

  const turnProgress = (): {
    completed: number
    total: number
    phase: 'await_turn' | 'await_center'
    type: FaceChallengeType
  } => ({
    completed: turnCyclesCompleted,
    total: turnSettings.requiredTurns,
    phase: turnPhase,
    type: currentTurnType,
  })

  const processTurnStep = (pose: FacePose): boolean => {
    const requiredTurns = turnSettings.requiredTurns
    const requiredTurnSamples = turnSettings.requiredSamples
    const requiredCenterSamples = turnSettings.centerSamplesAfterTurn
    const expected = expectedTurnPose(currentTurnType, mirror)

    if (requiredTurns <= 1) {
      if (pose !== expected) {
        hits = 0
        return false
      }
      hits += 1
      if (hits < requiredTurnSamples) {
        return false
      }
      stepIndex += 1
      hits = 0
      turnCyclesCompleted = 0
      turnPhase = 'await_turn'
      turnCycleTypeAssigned = false
      return true
    }

    if (turnPhase === 'await_turn') {
      if (pose !== expected) {
        hits = 0
        return false
      }
      hits += 1
      if (hits < requiredTurnSamples) {
        return false
      }
      turnPhase = 'await_center'
      hits = 0
      return false
    }

    if (pose !== 'front') {
      hits = 0
      return false
    }

    hits += 1
    if (hits < requiredCenterSamples) {
      return false
    }

    turnCyclesCompleted += 1
    turnCycleTypeAssigned = false
    hits = 0
    if (turnCyclesCompleted < requiredTurns) {
      turnPhase = 'await_turn'
      return false
    }

    stepIndex += 1
    turnCyclesCompleted = 0
    turnPhase = 'await_turn'
    turnCycleTypeAssigned = false
    return true
  }

  const submitAnalysis = (input: FaceAnalysisInput): FaceChallengeStep => {
    if (stepIndex >= sequence.length) {
      return { stage: 'passed', passed: true, prompt: promptFor('passed', currentTurnType) }
    }

    const stepId = currentStepId()
    const pose = resolveFacePose(input, config)

    if (stepId === 'turn') {
      if (!turnCycleTypeAssigned && turnPhase === 'await_turn') {
        beginTurnCycle()
      }
      processTurnStep(pose)
      const stage: FaceChallengeStage = stepIndex >= sequence.length ? 'passed' : currentStepId()
      const activeStage = stage === 'passed' ? 'passed' : stage
      const progress = turnProgress()
      return {
        stage,
        passed: stage === 'passed',
        prompt:
          activeStage === 'turn'
            ? promptFor('turn', progress.type, progress)
            : promptFor(activeStage, currentTurnType),
      }
    }

    const blinkCycleDetected = detectBlinkCycle(input.blinkScore, config.thresholds, blinkState)
    const satisfied = isStepSatisfied(stepId, pose, input, blinkCycleDetected)

    if (satisfied) {
      hits += 1
      if (hits >= config.steps[stepId].requiredSamples) {
        stepIndex += 1
        hits = 0
        if (stepId === 'blink') {
          blinkState.sawClosed = false
          blinkState.sawOpenAfterClose = false
        }
      }
    } else {
      hits = 0
      if (stepId === 'blink') {
        blinkState.sawClosed = false
        blinkState.sawOpenAfterClose = false
      }
    }

    const stage: FaceChallengeStage = stepIndex >= sequence.length ? 'passed' : currentStepId()
    return { stage, passed: stage === 'passed', prompt: promptFor(stage, currentTurnType) }
  }

  const submitPose = (pose: FacePose): FaceChallengeStep => submitAnalysis({ pose })

  const getProgress = (): FaceChallengeProgress => {
    const stage: FaceChallengeStage = stepIndex >= sequence.length ? 'passed' : currentStepId()
    if (stage !== 'turn') {
      return { stage, turnPhase: null, turnCycleAssigned: false }
    }
    return {
      stage,
      turnPhase,
      turnCycleAssigned: turnCycleTypeAssigned,
    }
  }

  return {
    get type() {
      return currentTurnType
    },
    getProgress,
    submitAnalysis,
    submitPose,
    reset,
  }
}

export function challengePromptForType(type: FaceChallengeType, config?: FaceChallengeConfig): string {
  const resolved = config ?? loadFaceChallengeConfig()
  const firstStep = buildEnabledChallengeSteps(resolved)[0] ?? 'center'
  if (firstStep === 'turn' && resolved.steps.turn.requiredTurns > 1) {
    return promptFor('turn', type, {
      completed: 0,
      total: resolved.steps.turn.requiredTurns,
      phase: 'await_turn',
    })
  }
  return promptFor(firstStep, type)
}

function promptFor(
  stage: FaceChallengeStage,
  type: FaceChallengeType,
  turnProgress?: { completed: number; total: number; phase: 'await_turn' | 'await_center' },
): string {
  switch (stage) {
    case 'center':
      return 'Centra tu rostro y mira a la camara'
    case 'turn':
      if (turnProgress && turnProgress.total > 1) {
        const currentTurn = turnProgress.completed + 1
        if (turnProgress.phase === 'await_center') {
          return `Giro ${currentTurn} de ${turnProgress.total} completado. Vuelve al centro`
        }
        return `Giro ${currentTurn} de ${turnProgress.total}: gira la cabeza ${TURN_HINT[type]}`
      }
      return `Gira lentamente la cabeza ${TURN_HINT[type]}`
    case 'recenter':
      return 'Ahora vuelve al centro'
    case 'blink':
      return 'Parpadea una vez de forma natural'
    case 'passed':
      return 'Reto completado, identificando...'
  }
}
