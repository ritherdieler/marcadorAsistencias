import { useEffect, useMemo, useRef, useState } from 'react'

import { useCamera } from '../../../hooks/useCamera'
import { FaceBoxOverlay } from '../../recognition/components/FaceBoxOverlay'
import { FaceCoverageIndicator } from '../../recognition/components/FaceCoverageIndicator'
import {
  evaluateFaceAlignment,
  faceAlignmentMessage,
  getFaceWidthPercent,
  type FaceAlignment,
} from '../../recognition/services/faceAlignment'
import { toRuntimeConfig, type FaceCoverageFlow } from '../../recognition/services/faceAlignmentConfig'

import { detectVisibleFacePose, type FaceBox } from '../../recognition/services/facePresenceDetector'

type FaceCoveragePreviewProps = {
  activeFlow: FaceCoverageFlow
  targetWidthPercent: number
}

const DETECT_INTERVAL_MS = 280

function buildDraftRuntimeConfig(activeFlow: FaceCoverageFlow, targetWidthPercent: number) {
  return toRuntimeConfig(activeFlow, {
    attendance: { targetWidthPercent },
    registration: { targetWidthPercent },
  })
}

export function FaceCoveragePreview({ activeFlow, targetWidthPercent }: FaceCoveragePreviewProps) {
  const { videoRef, stream, error: cameraError, permissionDenied, start } = useCamera()
  const [faceBox, setFaceBox] = useState<FaceBox | null>(null)
  const [alignment, setAlignment] = useState<FaceAlignment>('searching')
  const [statusMessage, setStatusMessage] = useState('Activando camara...')
  const checkingRef = useRef(false)

  const runtimeConfig = useMemo(
    () => buildDraftRuntimeConfig(activeFlow, targetWidthPercent),
    [activeFlow, targetWidthPercent],
  )

  useEffect(() => {
    void start().catch(() => undefined)
  }, [start])

  useEffect(() => {
    if (!stream) return

    let cancelled = false

    const checkFrame = async () => {
      if (cancelled || checkingRef.current) return
      const video = videoRef.current
      if (!video || video.readyState < 2) return

      checkingRef.current = true
      try {
        const result = await detectVisibleFacePose(video)
        if (cancelled) return

        if (!result.visible || !result.box) {
          setFaceBox(null)
          setAlignment('searching')
          setStatusMessage('Coloca tu rostro frente a la camara para probar el umbral.')
          return
        }

        setFaceBox(result.box)
        const quality = evaluateFaceAlignment(result.box, result.pose, null, runtimeConfig)
        setAlignment(quality)
        const widthPercent = getFaceWidthPercent(result.box)

        if (quality === 'aligned') {
          setStatusMessage(
            `Rostro al ${widthPercent}% de ancho. Con umbral ${targetWidthPercent}%: posicion valida para ${activeFlow === 'attendance' ? 'marcar' : 'registrar'}.`,
          )
          return
        }

        setStatusMessage(
          faceAlignmentMessage(
            quality,
            { widthPercent, targetPercent: targetWidthPercent },
            targetWidthPercent,
          ),
        )
      } finally {
        checkingRef.current = false
      }
    }

    void checkFrame()
    const timer = window.setInterval(() => void checkFrame(), DETECT_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeFlow, runtimeConfig, stream, targetWidthPercent, videoRef])

  const widthPercent = getFaceWidthPercent(faceBox)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-950">Vista previa en vivo</h2>
        <p className="mt-1 text-sm text-slate-600">
          Mueve el slider y observa como cambia la linea objetivo y la validacion del rostro.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-black ring-1 ring-black/10">
        <video ref={videoRef} className="aspect-video w-full object-cover" playsInline muted autoPlay />
        {stream && !permissionDenied && (
          <>
            <FaceBoxOverlay box={faceBox} alignment={alignment} />
            <FaceCoverageIndicator widthPercent={widthPercent} alignment={alignment} targetPercent={targetWidthPercent} />
          </>
        )}
        {permissionDenied && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950 px-6 text-center text-sm text-white">
            Permite el acceso a la camara para usar la vista previa.
          </div>
        )}
      </div>

      <div
        role="status"
        aria-live="polite"
        className={[
          'rounded-xl border px-4 py-3 text-sm font-medium',
          alignment === 'aligned'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : alignment === 'searching'
              ? 'border-slate-200 bg-slate-50 text-slate-700'
              : 'border-amber-200 bg-amber-50 text-amber-900',
        ].join(' ')}
      >
        {cameraError && !permissionDenied ? cameraError : statusMessage}
      </div>
    </div>
  )
}
