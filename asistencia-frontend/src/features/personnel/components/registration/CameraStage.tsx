import type { RefObject } from 'react'

import { Alert } from '../../../../components/ui/Alert'
import { ProcessingOverlay } from '../../../../components/ui/ProcessingOverlay'
import { FaceBoxOverlay } from '../../../recognition/components/FaceBoxOverlay'
import { FaceCoverageIndicator } from '../../../recognition/components/FaceCoverageIndicator'
import type { FaceAlignment } from '../../../recognition/services/faceAlignment'
import { getFaceWidthPercent } from '../../../recognition/services/faceAlignment'
import type { FaceBox } from '../../../recognition/services/facePresenceDetector'
import { CaptureCountdown } from './CaptureCountdown'

type CameraStageProps = {
  videoRef: RefObject<HTMLVideoElement | null>
  active: boolean
  mirror?: boolean
  faceBox: FaceBox | null
  alignment: FaceAlignment
  countdown: number | null
  capturing: boolean
  captureProgress?: number
  statusMessage: string
  cameraError: string | null
  permissionDenied: boolean
  onRetry: () => void
  devices: MediaDeviceInfo[]
  deviceId: string | null
  targetWidthPercent?: number
  onSelectDevice: (id: string) => void
}

function statusToneClass(alignment: FaceAlignment): string {
  if (alignment === 'aligned') return 'border-emerald-200 bg-emerald-50 text-emerald-800'
  if (alignment === 'searching') return 'border-slate-200 bg-slate-50 text-slate-700'
  return 'border-amber-200 bg-amber-50 text-amber-900'
}

export function CameraStage({
  videoRef,
  active,
  mirror = false,
  faceBox,
  alignment,
  countdown,
  capturing,
  captureProgress,
  statusMessage,
  cameraError,
  permissionDenied,
  onRetry,
  devices,
  deviceId,
  targetWidthPercent,
  onSelectDevice,
}: CameraStageProps) {
  const showVideo = active && !permissionDenied

  return (
    <div>
      <div className="text-[11px] font-bold tracking-widest text-brand-blue/80">VALIDACION BIOMETRICA</div>

      <div className="relative mt-3 aspect-video overflow-hidden rounded-xl bg-slate-950 ring-1 ring-black/10">
        {showVideo && (
          <video
            ref={videoRef}
            aria-label="Vista previa de la camara para el registro facial"
            className={['h-full w-full object-cover', mirror ? '-scale-x-100' : ''].join(' ')}
            playsInline
            muted
            autoPlay
          />
        )}

        {showVideo && <FaceBoxOverlay box={faceBox} alignment={alignment} mirror={mirror} />}
        {showVideo && (
          <FaceCoverageIndicator
            widthPercent={getFaceWidthPercent(faceBox)}
            alignment={alignment}
            targetPercent={targetWidthPercent}
          />
        )}
        {showVideo && <CaptureCountdown value={countdown} />}

        <ProcessingOverlay
          open={capturing}
          title="Procesando captura..."
          progress={captureProgress}
          scope="container"
        />

        {permissionDenied && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center text-white">
            <p className="text-sm font-semibold">No pudimos acceder a la camara.</p>
            <p className="text-xs leading-5 text-white/70">
              Permite el acceso a la camara en el navegador y vuelve a intentar.
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Reintentar
            </button>
          </div>
        )}

        {!active && !permissionDenied && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-sm font-semibold text-white/80">
            Camara apagada
          </div>
        )}

        {capturing && (
          <div className="sr-only" aria-live="polite">
            Procesando captura...
          </div>
        )}
      </div>

      {showVideo && devices.length > 1 && (
        <label className="mt-2 block">
          <span className="sr-only">Seleccionar camara</span>
          <select
            value={deviceId ?? ''}
            onChange={(event) => onSelectDevice(event.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-blue/20"
          >
            {devices.map((device, index) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camara ${index + 1}`}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="mt-3">
        {cameraError && !permissionDenied ? (
          <Alert variant="error" message={cameraError} />
        ) : (
          <div
            role="status"
            aria-live="polite"
            className={['flex items-center gap-2 rounded-md border p-3 text-sm font-medium', statusToneClass(alignment)].join(' ')}
          >
            {capturing && (
              <span
                className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden="true"
              />
            )}
            <span>{statusMessage}</span>
          </div>
        )}
      </div>
    </div>
  )
}
