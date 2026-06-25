import { LoadingButton } from '../../../components/ui/LoadingButton'
import {
  clampBlinkClosedMin,
  clampBlinkOpenMax,
  clampRequiredSamples,
  clampYawFrontDeg,
  clampYawTurnDeg,
  FACE_CHALLENGE_MAX_BLINK_CLOSED,
  FACE_CHALLENGE_MAX_BLINK_OPEN,
  FACE_CHALLENGE_MAX_SAMPLES,
  FACE_CHALLENGE_MAX_YAW_FRONT,
  FACE_CHALLENGE_MAX_YAW_TURN,
  FACE_CHALLENGE_MIN_BLINK_CLOSED,
  FACE_CHALLENGE_MIN_BLINK_OPEN,
  FACE_CHALLENGE_MIN_SAMPLES,
  FACE_CHALLENGE_MIN_YAW_FRONT,
  FACE_CHALLENGE_MIN_YAW_TURN,
  FACE_CHALLENGE_STEP_LABELS,
  FACE_CHALLENGE_STEP_ORDER,
  type FaceChallengeConfig,
  type FaceChallengeStepId,
} from '../../recognition/services/faceChallengeConfig'

type FaceChallengeControlsProps = {
  draft: FaceChallengeConfig
  onDraftChange: (next: FaceChallengeConfig) => void
  hasPendingChanges: boolean
  saving: boolean
  onSave: () => void
  onReset: () => void
}

function ToggleSwitch({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40',
        checked ? 'bg-brand-blue' : 'bg-slate-300',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition',
          checked ? 'translate-x-5' : 'translate-x-1',
        ].join(' ')}
      />
    </button>
  )
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

export function FaceChallengeControls({
  draft,
  onDraftChange,
  hasPendingChanges,
  saving,
  onSave,
  onReset,
}: FaceChallengeControlsProps) {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Reto activo (anti-spoofing)</h2>
            <p className="mt-1 text-sm text-slate-600">
              Configura la secuencia de liveness facial antes de identificar en el kiosko.
            </p>
          </div>
          {hasPendingChanges && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              Cambios pendientes
            </span>
          )}
        </div>
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

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Umbrales de deteccion</h3>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <label htmlFor="face-challenge-yaw-front" className="text-sm font-semibold text-slate-900">
            Yaw frontal — {draft.thresholds.yawFrontDeg}°
          </label>
          <p className="mt-1 text-xs text-slate-600">Angulo maximo para considerar el rostro centrado.</p>
          <input
            id="face-challenge-yaw-front"
            type="range"
            min={FACE_CHALLENGE_MIN_YAW_FRONT}
            max={FACE_CHALLENGE_MAX_YAW_FRONT}
            step={1}
            value={draft.thresholds.yawFrontDeg}
            onChange={(event) =>
              onDraftChange({
                ...draft,
                thresholds: {
                  ...draft.thresholds,
                  yawFrontDeg: clampYawFrontDeg(Number(event.target.value)),
                },
              })
            }
            className="mt-4 h-2 w-full cursor-pointer accent-brand-blue"
          />
          <div className="mt-1 flex justify-between text-xs font-semibold text-slate-500">
            <span>{FACE_CHALLENGE_MIN_YAW_FRONT}°</span>
            <span>{FACE_CHALLENGE_MAX_YAW_FRONT}°</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <label htmlFor="face-challenge-yaw-turn" className="text-sm font-semibold text-slate-900">
            Yaw de giro — {draft.thresholds.yawTurnDeg}°
          </label>
          <p className="mt-1 text-xs text-slate-600">Angulo minimo para validar el giro lateral.</p>
          <input
            id="face-challenge-yaw-turn"
            type="range"
            min={FACE_CHALLENGE_MIN_YAW_TURN}
            max={FACE_CHALLENGE_MAX_YAW_TURN}
            step={1}
            value={draft.thresholds.yawTurnDeg}
            onChange={(event) =>
              onDraftChange({
                ...draft,
                thresholds: {
                  ...draft.thresholds,
                  yawTurnDeg: clampYawTurnDeg(Number(event.target.value)),
                },
              })
            }
            className="mt-4 h-2 w-full cursor-pointer accent-brand-blue"
          />
          <div className="mt-1 flex justify-between text-xs font-semibold text-slate-500">
            <span>{FACE_CHALLENGE_MIN_YAW_TURN}°</span>
            <span>{FACE_CHALLENGE_MAX_YAW_TURN}°</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <label htmlFor="face-challenge-blink-open" className="text-sm font-semibold text-slate-900">
            Ojos abiertos max — {draft.thresholds.blinkOpenMax.toFixed(2)}
          </label>
          <p className="mt-1 text-xs text-slate-600">Score maximo para considerar los ojos abiertos.</p>
          <input
            id="face-challenge-blink-open"
            type="range"
            min={FACE_CHALLENGE_MIN_BLINK_OPEN}
            max={FACE_CHALLENGE_MAX_BLINK_OPEN}
            step={0.01}
            value={draft.thresholds.blinkOpenMax}
            onChange={(event) =>
              onDraftChange({
                ...draft,
                thresholds: {
                  ...draft.thresholds,
                  blinkOpenMax: clampBlinkOpenMax(Number(event.target.value)),
                },
              })
            }
            className="mt-4 h-2 w-full cursor-pointer accent-brand-blue"
          />
          <div className="mt-1 flex justify-between text-xs font-semibold text-slate-500">
            <span>{FACE_CHALLENGE_MIN_BLINK_OPEN}</span>
            <span>{FACE_CHALLENGE_MAX_BLINK_OPEN}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <label htmlFor="face-challenge-blink-closed" className="text-sm font-semibold text-slate-900">
            Ojos cerrados min — {draft.thresholds.blinkClosedMin.toFixed(2)}
          </label>
          <p className="mt-1 text-xs text-slate-600">Score minimo para considerar los ojos cerrados.</p>
          <input
            id="face-challenge-blink-closed"
            type="range"
            min={FACE_CHALLENGE_MIN_BLINK_CLOSED}
            max={FACE_CHALLENGE_MAX_BLINK_CLOSED}
            step={0.01}
            value={draft.thresholds.blinkClosedMin}
            onChange={(event) =>
              onDraftChange({
                ...draft,
                thresholds: {
                  ...draft.thresholds,
                  blinkClosedMin: clampBlinkClosedMin(Number(event.target.value)),
                },
              })
            }
            className="mt-4 h-2 w-full cursor-pointer accent-brand-blue"
          />
          <div className="mt-1 flex justify-between text-xs font-semibold text-slate-500">
            <span>{FACE_CHALLENGE_MIN_BLINK_CLOSED}</span>
            <span>{FACE_CHALLENGE_MAX_BLINK_CLOSED}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <LoadingButton type="button" variant="dark" onClick={onReset} disabled={saving}>
          Restablecer recomendados
        </LoadingButton>
        <LoadingButton type="button" onClick={onSave} loading={saving} loadingText="Guardando..." disabled={!hasPendingChanges}>
          Guardar configuracion
        </LoadingButton>
      </div>
    </div>
  )
}
