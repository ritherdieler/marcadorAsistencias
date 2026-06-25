import {
  clampBlinkClosedMin,
  clampBlinkOpenMax,
  clampYawFrontDeg,
  clampYawTurnDeg,
  FACE_CHALLENGE_MAX_BLINK_CLOSED,
  FACE_CHALLENGE_MAX_BLINK_OPEN,
  FACE_CHALLENGE_MAX_YAW_FRONT,
  FACE_CHALLENGE_MAX_YAW_TURN,
  FACE_CHALLENGE_MIN_BLINK_CLOSED,
  FACE_CHALLENGE_MIN_BLINK_OPEN,
  FACE_CHALLENGE_MIN_YAW_FRONT,
  FACE_CHALLENGE_MIN_YAW_TURN,
  type FaceChallengeConfig,
} from '../../recognition/services/faceChallengeConfig'

type ChallengeThresholdControlsProps = {
  draft: FaceChallengeConfig
  onDraftChange: (next: FaceChallengeConfig) => void
}

export function ChallengeThresholdControls({ draft, onDraftChange }: ChallengeThresholdControlsProps) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Umbrales del reto activo</h3>
        <p className="mt-1 text-xs text-slate-600">
          Ajustes finos de deteccion de giro y parpadeo. Solo modificar si el reto falla con frecuencia.
        </p>
      </div>

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
  )
}
