import {
  clampRequiredSamples,
  FACE_CHALLENGE_MAX_SAMPLES,
  FACE_CHALLENGE_MIN_SAMPLES,
  FACE_CHALLENGE_STEP_LABELS,
  FACE_CHALLENGE_STEP_ORDER,
  type FaceChallengeConfig,
  type FaceChallengeStepId,
} from '../../recognition/services/faceChallengeConfig'
import { ToggleSwitch } from './ToggleSwitch'

type ChallengeBasicControlsProps = {
  draft: FaceChallengeConfig
  onDraftChange: (next: FaceChallengeConfig) => void
}

function updateStep(
  draft: FaceChallengeConfig,
  stepId: FaceChallengeStepId,
  patch: Partial<FaceChallengeConfig['steps'][typeof stepId]>,
): FaceChallengeConfig {
  return {
    ...draft,
    steps: {
      ...draft.steps,
      [stepId]: { ...draft.steps[stepId], ...patch },
    },
  }
}

export function ChallengeBasicControls({ draft, onDraftChange }: ChallengeBasicControlsProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-950">Reto activo (anti-spoofing)</h2>
        <p className="mt-1 text-sm text-slate-600">
          Configura la secuencia de liveness facial antes de identificar en el kiosko.
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div>
          <div className="text-sm font-semibold text-slate-900">Reto activo habilitado</div>
          <p className="mt-1 text-xs text-slate-600">Exige completar la secuencia configurada antes de identificar.</p>
        </div>
        <ToggleSwitch
          checked={draft.enabled}
          label="Habilitar reto activo"
          onChange={(enabled) => onDraftChange({ ...draft, enabled })}
        />
      </div>

      <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div>
          <div className="text-sm font-semibold text-slate-900">Perspectiva espejo (selfie)</div>
          <p className="mt-1 text-xs text-slate-600">
            Invierte las instrucciones de giro para que coincidan con la vista previa tipo selfie.
          </p>
        </div>
        <ToggleSwitch
          checked={draft.mirrorSelfiePerspective}
          label="Perspectiva espejo"
          onChange={(mirrorSelfiePerspective) => onDraftChange({ ...draft, mirrorSelfiePerspective })}
        />
      </div>

      <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div>
          <div className="text-sm font-semibold text-slate-900">Pose 3D (yaw)</div>
          <p className="mt-1 text-xs text-slate-600">
            Usa angulos de cabeza en grados cuando el detector los provea en lugar de pose 2D.
          </p>
        </div>
        <ToggleSwitch
          checked={draft.usePose3d}
          label="Usar pose 3D"
          onChange={(usePose3d) => onDraftChange({ ...draft, usePose3d })}
        />
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Pasos del reto</h3>
        {FACE_CHALLENGE_STEP_ORDER.map((stepId) => {
          const step = draft.steps[stepId]
          const turnStep = stepId === 'turn' ? draft.steps.turn : null
          return (
            <div key={stepId} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{FACE_CHALLENGE_STEP_LABELS[stepId]}</div>
                  <p className="mt-1 text-xs text-slate-600">
                    {stepId === 'turn' && turnStep
                      ? `Giros: ${turnStep.requiredTurns} · Muestras en giro: ${turnStep.requiredSamples}${
                          turnStep.requiredTurns > 1
                            ? ` · Muestras al centro: ${turnStep.centerSamplesAfterTurn} (direccion aleatoria)`
                            : ''
                        }`
                      : `Muestras consecutivas requeridas: ${step.requiredSamples}`}
                  </p>
                </div>
                <ToggleSwitch
                  checked={step.enabled}
                  label={`Habilitar paso ${FACE_CHALLENGE_STEP_LABELS[stepId]}`}
                  onChange={(enabled) => onDraftChange(updateStep(draft, stepId, { enabled }))}
                />
              </div>
              {step.enabled && stepId !== 'turn' && (
                <div className="mt-4">
                  <label htmlFor={`face-challenge-samples-${stepId}`} className="text-xs font-semibold text-slate-700">
                    Muestras requeridas
                  </label>
                  <input
                    id={`face-challenge-samples-${stepId}`}
                    type="range"
                    min={FACE_CHALLENGE_MIN_SAMPLES}
                    max={FACE_CHALLENGE_MAX_SAMPLES}
                    step={1}
                    value={step.requiredSamples}
                    aria-valuemin={FACE_CHALLENGE_MIN_SAMPLES}
                    aria-valuemax={FACE_CHALLENGE_MAX_SAMPLES}
                    aria-valuenow={step.requiredSamples}
                    aria-valuetext={`${step.requiredSamples} muestras`}
                    onChange={(event) =>
                      onDraftChange(
                        updateStep(draft, stepId, {
                          requiredSamples: clampRequiredSamples(Number(event.target.value)),
                        }),
                      )
                    }
                    className="mt-2 h-2 w-full cursor-pointer accent-brand-blue"
                  />
                  <div className="mt-1 flex justify-between text-xs font-semibold text-slate-500">
                    <span>{FACE_CHALLENGE_MIN_SAMPLES}</span>
                    <span>{FACE_CHALLENGE_MAX_SAMPLES}</span>
                  </div>
                </div>
              )}
              {step.enabled && stepId === 'turn' && turnStep && (
                <div className="mt-4 space-y-4">
                  <div>
                    <label htmlFor="face-challenge-turn-count" className="text-xs font-semibold text-slate-700">
                      Giros laterales — {turnStep.requiredTurns}
                    </label>
                    <input
                      id="face-challenge-turn-count"
                      type="range"
                      min={FACE_CHALLENGE_MIN_SAMPLES}
                      max={FACE_CHALLENGE_MAX_SAMPLES}
                      step={1}
                      value={turnStep.requiredTurns}
                      aria-valuemin={FACE_CHALLENGE_MIN_SAMPLES}
                      aria-valuemax={FACE_CHALLENGE_MAX_SAMPLES}
                      aria-valuenow={turnStep.requiredTurns}
                      aria-valuetext={`${turnStep.requiredTurns} giros`}
                      onChange={(event) =>
                        onDraftChange(
                          updateStep(draft, 'turn', {
                            requiredTurns: clampRequiredSamples(Number(event.target.value)),
                          }),
                        )
                      }
                      className="mt-2 h-2 w-full cursor-pointer accent-brand-blue"
                    />
                    <div className="mt-1 flex justify-between text-xs font-semibold text-slate-500">
                      <span>{FACE_CHALLENGE_MIN_SAMPLES}</span>
                      <span>{FACE_CHALLENGE_MAX_SAMPLES}</span>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="face-challenge-turn-samples" className="text-xs font-semibold text-slate-700">
                      Muestras en posicion de giro — {turnStep.requiredSamples}
                    </label>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Detecciones consecutivas con la cabeza girada antes de validar cada giro.
                    </p>
                    <input
                      id="face-challenge-turn-samples"
                      type="range"
                      min={FACE_CHALLENGE_MIN_SAMPLES}
                      max={FACE_CHALLENGE_MAX_SAMPLES}
                      step={1}
                      value={turnStep.requiredSamples}
                      aria-valuemin={FACE_CHALLENGE_MIN_SAMPLES}
                      aria-valuemax={FACE_CHALLENGE_MAX_SAMPLES}
                      aria-valuenow={turnStep.requiredSamples}
                      aria-valuetext={`${turnStep.requiredSamples} muestras`}
                      onChange={(event) =>
                        onDraftChange(
                          updateStep(draft, 'turn', {
                            requiredSamples: clampRequiredSamples(Number(event.target.value)),
                          }),
                        )
                      }
                      className="mt-2 h-2 w-full cursor-pointer accent-brand-blue"
                    />
                    <div className="mt-1 flex justify-between text-xs font-semibold text-slate-500">
                      <span>{FACE_CHALLENGE_MIN_SAMPLES}</span>
                      <span>{FACE_CHALLENGE_MAX_SAMPLES}</span>
                    </div>
                  </div>
                  {turnStep.requiredTurns > 1 && (
                    <div>
                      <label htmlFor="face-challenge-turn-center-samples" className="text-xs font-semibold text-slate-700">
                        Muestras al volver al centro — {turnStep.centerSamplesAfterTurn}
                      </label>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Detecciones consecutivas de frente entre un giro y el siguiente.
                      </p>
                      <input
                        id="face-challenge-turn-center-samples"
                        type="range"
                        min={FACE_CHALLENGE_MIN_SAMPLES}
                        max={FACE_CHALLENGE_MAX_SAMPLES}
                        step={1}
                        value={turnStep.centerSamplesAfterTurn}
                        aria-valuemin={FACE_CHALLENGE_MIN_SAMPLES}
                        aria-valuemax={FACE_CHALLENGE_MAX_SAMPLES}
                        aria-valuenow={turnStep.centerSamplesAfterTurn}
                        aria-valuetext={`${turnStep.centerSamplesAfterTurn} muestras`}
                        onChange={(event) =>
                          onDraftChange(
                            updateStep(draft, 'turn', {
                              centerSamplesAfterTurn: clampRequiredSamples(Number(event.target.value)),
                            }),
                          )
                        }
                        className="mt-2 h-2 w-full cursor-pointer accent-brand-blue"
                      />
                      <div className="mt-1 flex justify-between text-xs font-semibold text-slate-500">
                        <span>{FACE_CHALLENGE_MIN_SAMPLES}</span>
                        <span>{FACE_CHALLENGE_MAX_SAMPLES}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
