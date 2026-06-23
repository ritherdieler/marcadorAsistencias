import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useCamera } from '../../../hooks/useCamera'
import { createMonotonicProgress } from '../../../utils/monotonicProgress'
import { yieldToUi } from '../../../utils/yieldToUi'
import { captureFacePhoto } from '../../recognition/services/cameraEvidence'
import { detectVisibleFacePose, type FaceBox } from '../../recognition/services/facePresenceDetector'
import { evaluateFaceAlignment, faceAlignmentMessage, getFaceWidthPercent, type FaceAlignment } from '../../recognition/services/faceAlignment'
import { useFaceCoverageConfig } from '../../recognition/hooks/useFaceCoverageConfig'

export type CaptureAngle = 'front' | 'left' | 'right'

export type { FaceAlignment } from '../../recognition/services/faceAlignment'

export type AngleCaptureState = {
  blob: Blob | null
  previewUrl: string | null
}

export type AngleCaptureBlobs = Record<CaptureAngle, Blob>

export const ENROLLMENT_ANGLES: { key: CaptureAngle; label: string; instruction: string }[] = [
  { key: 'front', label: 'Frontal', instruction: 'Mira directamente a la camara y manten el rostro centrado.' },
  { key: 'left', label: 'Izquierda', instruction: 'Gira lentamente el rostro hacia tu izquierda.' },
  { key: 'right', label: 'Derecha', instruction: 'Gira lentamente el rostro hacia tu derecha.' },
]

const DETECT_INTERVAL_MS = 280
const ALIGN_HOLD_MS = 1500

const emptyCaptures = (): Record<CaptureAngle, AngleCaptureState> => ({
  front: { blob: null, previewUrl: null },
  left: { blob: null, previewUrl: null },
  right: { blob: null, previewUrl: null },
})

const angleLabel = (angle: CaptureAngle): string =>
  ENROLLMENT_ANGLES.find((item) => item.key === angle)?.label.toLowerCase() ?? 'rostro'

const angleInstruction = (angle: CaptureAngle): string =>
  ENROLLMENT_ANGLES.find((item) => item.key === angle)?.instruction ?? ''

interface UseFaceEnrollmentOptions {
  active: boolean
  autoCapture: boolean
}

export function useFaceEnrollment({ active, autoCapture }: UseFaceEnrollmentOptions) {
  const { getRuntimeConfig } = useFaceCoverageConfig()
  const alignmentConfig = getRuntimeConfig('registration')
  const { videoRef, stream, error: cameraError, permissionDenied, start, stop } = useCamera()

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [faceBox, setFaceBox] = useState<FaceBox | null>(null)
  const [alignment, setAlignment] = useState<FaceAlignment>('searching')
  const [currentAngle, setCurrentAngle] = useState<CaptureAngle>('front')
  const [captures, setCaptures] = useState<Record<CaptureAngle, AngleCaptureState>>(emptyCaptures)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [captureProgress, setCaptureProgress] = useState(0)
  const [statusMessage, setStatusMessage] = useState('Activando camara...')

  const capturesRef = useRef(captures)
  const currentAngleRef = useRef(currentAngle)
  const autoCaptureRef = useRef(autoCapture)
  const alignedSinceRef = useRef<number | null>(null)
  const checkingRef = useRef(false)
  const capturingRef = useRef(false)

  useEffect(() => {
    capturesRef.current = captures
  }, [captures])

  useEffect(() => {
    currentAngleRef.current = currentAngle
  }, [currentAngle])

  useEffect(() => {
    autoCaptureRef.current = autoCapture
    if (!autoCapture) {
      alignedSinceRef.current = null
      setCountdown(null)
    }
  }, [autoCapture])

  const releasePreviews = useCallback(() => {
    const current = capturesRef.current
    ENROLLMENT_ANGLES.forEach(({ key }) => {
      const url = current[key].previewUrl
      if (url) URL.revokeObjectURL(url)
    })
  }, [])

  const doCapture = useCallback(async (video: HTMLVideoElement, angle: CaptureAngle) => {
    if (capturingRef.current) return
    capturingRef.current = true
    setCapturing(true)
    setCaptureProgress(0)
    setCountdown(null)
    alignedSinceRef.current = null

    try {
      const report = createMonotonicProgress(setCaptureProgress)
      setCaptureProgress(5)
      await yieldToUi()
      const blob = await captureFacePhoto(video, 'enrollment', report)
      setCaptureProgress(100)
      const previewUrl = URL.createObjectURL(blob)
      const previous = capturesRef.current
      const previousUrl = previous[angle].previewUrl
      if (previousUrl) URL.revokeObjectURL(previousUrl)

      const next = { ...previous, [angle]: { blob, previewUrl } }
      capturesRef.current = next
      setCaptures(next)

      const pending = ENROLLMENT_ANGLES.find((item) => !next[item.key].blob)
      if (pending) {
        setCurrentAngle(pending.key)
        setStatusMessage(`Captura ${angleLabel(angle)} lista. ${pending.instruction}`)
      } else {
        setStatusMessage('Capturas completas.')
      }
    } catch {
      setStatusMessage('No se pudo capturar la foto. Intenta de nuevo.')
    } finally {
      capturingRef.current = false
      setCapturing(false)
      setCaptureProgress(0)
    }
  }, [])

  useEffect(() => {
    if (!active) {
      stop()
      setFaceBox(null)
      setAlignment('searching')
      setCountdown(null)
      alignedSinceRef.current = null
      setStatusMessage('Camara apagada.')
      return
    }

    if (stream) return
    setStatusMessage('Activando camara...')
    void start(deviceId ?? undefined).catch(() => {})
  }, [active, deviceId, start, stop, stream])

  useEffect(() => {
    if (!stream) return
    navigator.mediaDevices
      ?.enumerateDevices?.()
      .then((list) => setDevices(list.filter((device) => device.kind === 'videoinput')))
      .catch(() => {})
  }, [stream])

  useEffect(() => {
    if (!active || !stream) return

    let cancelled = false

    const checkFrame = async () => {
      if (cancelled || checkingRef.current || capturingRef.current) return
      const video = videoRef.current
      if (!video || video.readyState < 2) return

      checkingRef.current = true
      try {
        const result = await detectVisibleFacePose(video)
        if (cancelled) return

        if (!result.visible || !result.box) {
          setFaceBox(result.box ?? null)
          setAlignment('searching')
          alignedSinceRef.current = null
          setCountdown(null)
          setStatusMessage('Coloca tu rostro dentro del marco.')
          return
        }

        setFaceBox(result.box)
        const angle = currentAngleRef.current
        const quality = evaluateFaceAlignment(result.box, result.pose, angle, alignmentConfig)
        setAlignment(quality)

        if (quality !== 'aligned') {
          alignedSinceRef.current = null
          setCountdown(null)
          setStatusMessage(
            faceAlignmentMessage(
              quality,
              {
                widthPercent: getFaceWidthPercent(result.box),
                targetPercent: alignmentConfig.targetWidthPercent,
                poseInstruction: angleInstruction(angle),
              },
              alignmentConfig.targetWidthPercent,
            ),
          )
          return
        }

        if (!autoCaptureRef.current) {
          setCountdown(null)
          setStatusMessage(
            faceAlignmentMessage(
              'aligned',
              {
                widthPercent: getFaceWidthPercent(result.box),
                targetPercent: alignmentConfig.targetWidthPercent,
              },
              alignmentConfig.targetWidthPercent,
            ),
          )
          return
        }

        const now = Date.now()
        alignedSinceRef.current ??= now
        const elapsed = now - alignedSinceRef.current
        const remaining = Math.max(0, ALIGN_HOLD_MS - elapsed)
        const tick = Math.ceil(remaining / 500)
        setCountdown(tick > 0 ? tick : null)
        setStatusMessage(
          `Rostro al ${getFaceWidthPercent(result.box)}% de ancho. Manten la posicion...`,
        )

        if (elapsed >= ALIGN_HOLD_MS) {
          await doCapture(video, angle)
        }
      } catch {
        if (!cancelled) {
          setFaceBox(null)
          setAlignment('searching')
        }
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
  }, [active, alignmentConfig, stream, doCapture, videoRef])

  useEffect(() => releasePreviews, [releasePreviews])

  const selectDevice = useCallback(
    (id: string) => {
      setDeviceId(id)
      if (active) {
        stop()
        void start(id).catch(() => {})
      }
    },
    [active, start, stop],
  )

  const retryCamera = useCallback(() => {
    void start(deviceId ?? undefined).catch(() => {})
  }, [deviceId, start])

  const manualCapture = useCallback(() => {
    const video = videoRef.current
    if (!video || video.readyState < 2 || capturingRef.current) return
    void doCapture(video, currentAngleRef.current)
  }, [doCapture, videoRef])

  const recapture = useCallback((angle: CaptureAngle) => {
    const previous = capturesRef.current
    const previousUrl = previous[angle].previewUrl
    if (previousUrl) URL.revokeObjectURL(previousUrl)

    const next = { ...previous, [angle]: { blob: null, previewUrl: null } }
    capturesRef.current = next
    setCaptures(next)
    setCurrentAngle(angle)
    alignedSinceRef.current = null
    setCountdown(null)
    setStatusMessage(angleInstruction(angle))
  }, [])

  const reset = useCallback(() => {
    releasePreviews()
    const fresh = emptyCaptures()
    capturesRef.current = fresh
    setCaptures(fresh)
    setCurrentAngle('front')
    alignedSinceRef.current = null
    setCountdown(null)
    setAlignment('searching')
    setFaceBox(null)
  }, [releasePreviews])

  const capturedCount = useMemo(
    () => ENROLLMENT_ANGLES.filter(({ key }) => captures[key].blob).length,
    [captures],
  )

  const isComplete = capturedCount === ENROLLMENT_ANGLES.length

  const collectBlobs = useCallback((): AngleCaptureBlobs | null => {
    const current = capturesRef.current
    if (!current.front.blob || !current.left.blob || !current.right.blob) return null
    return { front: current.front.blob, left: current.left.blob, right: current.right.blob }
  }, [])

  const canManualCapture = active && !permissionDenied && faceBox !== null && !capturing

  return {
    videoRef,
    cameraError,
    permissionDenied,
    devices,
    deviceId,
    faceBox,
    alignment,
    currentAngle,
    captures,
    countdown,
    capturing,
    captureProgress,
    statusMessage,
    capturedCount,
    isComplete,
    canManualCapture,
    targetWidthPercent: alignmentConfig.targetWidthPercent,
    selectDevice,
    retryCamera,
    manualCapture,
    recapture,
    setCurrentAngle,
    reset,
    collectBlobs,
  }
}
