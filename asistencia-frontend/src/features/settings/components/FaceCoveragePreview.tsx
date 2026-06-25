import { useEffect, useMemo, useRef, useState } from 'react'

import { useCamera } from '../../../hooks/useCamera'
import { FaceBoxOverlay } from '../../recognition/components/FaceBoxOverlay'
import { FaceLandmarksOverlay } from '../../recognition/components/FaceLandmarksOverlay'
import { FacePositionGuide } from '../../recognition/components/FacePositionGuide'
import {
  evaluateFaceAlignment,
  faceAlignmentDiagnosticMessage,
  faceAlignmentMessage,
  getFaceWidthPercent,
  type FaceAlignment,
} from '../../recognition/services/faceAlignment'
import {
  computeMaxWidthPercent,
  DEFAULT_FACE_COVERAGE_CONFIG,
  DEFAULT_FACE_GUIDE_SETTINGS,
  DEFAULT_FACE_LANDMARK_LAYERS,
  toRuntimeConfig,
  type FaceCoverageFlow,
  type FaceCoverageSettings,
  type FaceGuideSettings,
  type FaceLandmarkAlignmentColors,
  type FaceLandmarkDrawStyle,
  type FaceLandmarkLayers,
} from '../../recognition/services/faceAlignmentConfig'

import { detectVisibleFacePose, type FaceBox, type FaceLandmarkPoint } from '../../recognition/services/facePresenceDetector'

type FaceCoveragePreviewProps = {
  activeFlow: FaceCoverageFlow
  flowSettings: FaceCoverageSettings
  showFaceLandmarks: boolean
  showFaceBox: boolean
  faceGuide: FaceGuideSettings
  landmarkDrawStyle: FaceLandmarkDrawStyle
  landmarkPointSizePx: number
  landmarkAlignmentColors: FaceLandmarkAlignmentColors
  landmarkLayers: FaceLandmarkLayers
}

const DETECT_INTERVAL_MS = 280

function buildDraftRuntimeConfig(activeFlow: FaceCoverageFlow, flowSettings: FaceCoverageSettings) {
  return toRuntimeConfig(activeFlow, {
    attendance:
      activeFlow === 'attendance'
        ? flowSettings
        : { ...DEFAULT_FACE_COVERAGE_CONFIG.attendance },
    registration:
      activeFlow === 'registration'
        ? flowSettings
        : { ...DEFAULT_FACE_COVERAGE_CONFIG.registration },
    showFaceLandmarks: true,
    showFaceBox: false,
    faceGuide: { ...DEFAULT_FACE_GUIDE_SETTINGS },
    landmarkDrawStyle: 'continuous',
    landmarkPointSizePx: 3,
    landmarkAlignmentColors: { ...DEFAULT_FACE_COVERAGE_CONFIG.landmarkAlignmentColors },
    landmarkLayers: { ...DEFAULT_FACE_LANDMARK_LAYERS },
  })
}

export function FaceCoveragePreview({
  activeFlow,
  flowSettings,
  showFaceLandmarks,
  showFaceBox,
  faceGuide,
  landmarkDrawStyle,
  landmarkPointSizePx,
  landmarkAlignmentColors,
  landmarkLayers,
}: FaceCoveragePreviewProps) {
  const { videoRef, stream, error: cameraError, permissionDenied, start } = useCamera()
  const [faceBox, setFaceBox] = useState<FaceBox | null>(null)
  const [landmarks, setLandmarks] = useState<FaceLandmarkPoint[] | null>(null)
  const [alignment, setAlignment] = useState<FaceAlignment>('searching')
  const [statusMessage, setStatusMessage] = useState('Activando camara...')
  const checkingRef = useRef(false)

  const targetWidthPercent = flowSettings.targetWidthPercent
  const maxTargetWidthPercent = computeMaxWidthPercent(
    flowSettings.targetWidthPercent,
    flowSettings.upperWidthRatio,
  )

  const runtimeConfig = useMemo(
    () => buildDraftRuntimeConfig(activeFlow, flowSettings),
    [activeFlow, flowSettings],
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
          setLandmarks(result.landmarks ?? null)
          setAlignment('searching')
          setStatusMessage('Coloca tu rostro frente a la camara para probar el umbral.')
          return
        }

        setFaceBox(result.box)
        setLandmarks(result.landmarks ?? null)
        const quality = evaluateFaceAlignment(result.box, result.pose, null, runtimeConfig)
        setAlignment(quality)
        setStatusMessage(faceAlignmentMessage(quality))
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
  }, [runtimeConfig, stream, videoRef])

  const widthPercent = getFaceWidthPercent(faceBox)
  const diagnosticLine =
    faceBox !== null
      ? faceAlignmentDiagnosticMessage(
          alignment,
          { widthPercent, targetPercent: targetWidthPercent, maxTargetPercent: maxTargetWidthPercent },
          targetWidthPercent,
          maxTargetWidthPercent,
        )
      : `Ancho detectado: — · Banda: ${targetWidthPercent}–${maxTargetWidthPercent}% · ratio ${flowSettings.upperWidthRatio.toFixed(2)}x`

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-950">Vista previa en vivo</h2>
        <p className="mt-1 text-sm text-slate-600">
          Ajusta objetivo, tolerancia y guia visual; la linea de diagnostico solo aparece aqui en admin.
        </p>
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-black ring-1 ring-black/10">
        <video ref={videoRef} className="aspect-video w-full object-cover" playsInline muted autoPlay />
        {stream && !permissionDenied && (
          <>
            <FacePositionGuide
              alignment={alignment}
              faceBox={faceBox}
              runtimeConfig={runtimeConfig}
              faceGuide={faceGuide}
            />
            <FaceBoxOverlay box={faceBox} showFaceBox={showFaceBox} alignment={alignment} />
            {showFaceLandmarks && (
              <FaceLandmarksOverlay
                landmarks={landmarks}
                alignment={alignment}
                landmarkLayers={landmarkLayers}
                landmarkDrawStyle={landmarkDrawStyle}
                landmarkPointSizePx={landmarkPointSizePx}
                landmarkAlignmentColors={landmarkAlignmentColors}
              />
            )}
          </>
        )}
        {permissionDenied && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950 px-6 text-center text-sm text-white">
            Permite el acceso a la camara para usar la vista previa.
          </div>
        )}
      </div>

      <p className="text-xs font-medium tabular-nums text-slate-500">{diagnosticLine}</p>

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
