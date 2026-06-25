import { useCallback, useEffect, useRef, useState } from 'react'

import { LoadingButton } from '../../../components/ui/LoadingButton'
import { ProcessingOverlay } from '../../../components/ui/ProcessingOverlay'
import { useCamera } from '../../../hooks/useCamera'
import { useNetworkStatus } from '../../../hooks/useNetworkStatus'
import {
  enqueueOfflineAttendance,
  isConnectionError,
  syncOfflineAttendanceQueue,
} from '../../../services/offlineAttendanceQueue'
import { identifyCapturedFace } from '../../../services/faceIdentityService'
import { forgetLocalCheckIn, rememberLocalCheckIn } from '../../../services/localAttendanceState'
import { refreshOfflineFaceDataset } from '../../../services/offlineFaceDataset'
import { saveFaceEvidencePhoto, startFaceChallenge, verifyAttendanceWithPassword, verifyFacePhoto } from '../../../services/recognitionService'
import type { User } from '../../../types/user'
import { formatUserRole } from '../../../utils/userRole'
import { captureFacePhoto } from '../../recognition/services/cameraEvidence'
import { FaceBoxOverlay } from '../../recognition/components/FaceBoxOverlay'
import { FaceLandmarksOverlay } from '../../recognition/components/FaceLandmarksOverlay'
import { FacePositionGuide } from '../../recognition/components/FacePositionGuide'
import { detectVisibleFacePose, type FaceBox, type FaceLandmarkPoint } from '../../recognition/services/facePresenceDetector'
import {
  createActiveFaceChallenge,
  challengePromptForType,
  type ActiveFaceChallenge,
  type FaceChallengeType,
} from '../../recognition/services/activeFaceChallenge'
import { pickRandomChallengeType } from '../../recognition/services/faceChallengeConfig'
import { detectBlinkCycle, readBlinkScores, type BlinkScores } from '../../recognition/services/faceBlendshapeUtils'
import { useFaceChallengeConfig } from '../../recognition/hooks/useFaceChallengeConfig'
import {
  evaluateChallengeAlignmentGate,
  evaluateFaceAlignment,
  faceAlignmentMessage,
  type FaceAlignment,
} from '../../recognition/services/faceAlignment'
import { useFaceCoverageConfig } from '../../recognition/hooks/useFaceCoverageConfig'
import { yieldToUi } from '../../../utils/yieldToUi'

type CapturePhase = 'idle' | 'capturing' | 'identifying' | 'confirming'

type AttendanceResult = {
  title: string
  description: string
  statusLabel: string
  checkInTime?: string
  variant: 'success' | 'warning'
}

type IdentifiedPerson = {
  user: User
  photo: Blob
  nextAction: 'CHECK_IN' | 'CHECK_OUT'
  faceDataId?: number | null
  score?: number | null
}


const FACE_LOST_CLEAR_MS = 900
const FACE_CENTER_SHIFT_THRESHOLD = 0.18
const FACE_SIZE_CHANGE_THRESHOLD = 0.45

function getCurrentTimeLabel() {
  // Centraliza el formato de hora que se muestra cuando una marcacion queda pendiente.
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function didFaceChangeSignificantly(previous: FaceBox | null, current?: FaceBox): boolean {
  if (!previous || !current) return false

  const centerShift = Math.hypot(current.centerX - previous.centerX, current.centerY - previous.centerY)
  const previousArea = Math.max(previous.width * previous.height, 0.0001)
  const currentArea = Math.max(current.width * current.height, 0.0001)
  const sizeChange = Math.abs(currentArea - previousArea) / previousArea

  return centerShift > FACE_CENTER_SHIFT_THRESHOLD || sizeChange > FACE_SIZE_CHANGE_THRESHOLD
}

export function AttendanceMarker() {
  const {
    getRuntimeConfig,
    showFaceLandmarks,
    showFaceBox,
    faceGuide,
    landmarkDrawStyle,
    landmarkPointSizePx,
    landmarkAlignmentColors,
    landmarkLayers,
  } = useFaceCoverageConfig()
  const alignmentConfig = getRuntimeConfig('attendance')
  const { config: challengeConfig, enabled: challengeEnabled } = useFaceChallengeConfig()
  const { videoRef, start, stop, stream, error: cameraError } = useCamera()
  const {
    isOnline,
    isSyncing,
    pendingSyncCount,
    refreshPendingSyncCount,
    setSyncing,
    reportConnectionError,
  } = useNetworkStatus()

  const [cameraReady, setCameraReady] = useState(false)
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const pendingSyncCountRef = useRef(0)
  const identityAttemptRef = useRef(0)
  const lastFaceBoxRef = useRef<FaceBox | null>(null)
  const faceMissingSinceRef = useRef<number | null>(null)
  const challengeRef = useRef<ActiveFaceChallenge | null>(null)
  const challengeTokenRef = useRef<string | null>(null)
  const challengeTypeRef = useRef<FaceChallengeType>('LEFT_TURN')
  const challengePassedRef = useRef(false)
  const blinkHistoryRef = useRef<BlinkScores[]>([])
  const [status, setStatus] = useState('Camara apagada')
  const [identifiedPreviewUrl, setIdentifiedPreviewUrl] = useState<string | null>(null)
  const [faceBox, setFaceBox] = useState<FaceBox | null>(null)
  const [landmarks, setLandmarks] = useState<FaceLandmarkPoint[] | null>(null)
  const [alignment, setAlignment] = useState<FaceAlignment>('searching')
  const [message, setMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<'info' | 'error'>('info')
  const [identified, setIdentified] = useState<IdentifiedPerson | null>(null)
  const [unrecognizedDialog, setUnrecognizedDialog] = useState<string | null>(null)
  const [result, setResult] = useState<AttendanceResult | null>(null)
  const [identifying, setIdentifying] = useState(false)
  const [capturePhase, setCapturePhase] = useState<CapturePhase>('idle')
  const [captureProgress, setCaptureProgress] = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [passwordFallbackOpen, setPasswordFallbackOpen] = useState(false)
  const [fallbackUsername, setFallbackUsername] = useState('')
  const [fallbackPassword, setFallbackPassword] = useState('')
  const [fallbackLoading, setFallbackLoading] = useState(false)
  const [challengeDone, setChallengeDone] = useState(false)
  const [challengePrompt, setChallengePrompt] = useState('Centra tu rostro y mira a la camara')
  const [backendChallengeEnabled, setBackendChallengeEnabled] = useState(false)

  const effectiveLivenessRequired = challengeEnabled || (backendChallengeEnabled && isOnline)

  const resetChallenge = useCallback(
    (backendEnabledOverride?: boolean, preserveTurnType = false) => {
      const backendOn = backendEnabledOverride ?? backendChallengeEnabled
      const livenessRequired = challengeEnabled || (backendOn && isOnline)
      if (!preserveTurnType) {
        challengeTypeRef.current = pickRandomChallengeType()
      }
      challengeRef.current = null
      challengeTokenRef.current = null
      blinkHistoryRef.current = []
      challengePassedRef.current = !livenessRequired
      setChallengeDone(!livenessRequired)
      setChallengePrompt(
        livenessRequired
          ? challengePromptForType(challengeTypeRef.current, challengeConfig)
          : 'Coloca tu rostro frente a la camara',
      )
    },
    [backendChallengeEnabled, challengeConfig, challengeEnabled, isOnline],
  )

  useEffect(() => {
    challengeRef.current = null
  }, [challengeConfig])

  const fetchBackendChallengeStatus = useCallback(async (): Promise<boolean> => {
    if (!navigator.onLine) {
      setBackendChallengeEnabled(false)
      return false
    }
    try {
      const challenge = await startFaceChallenge()
      setBackendChallengeEnabled(challenge.enabled)
      return challenge.enabled
    } catch {
      setBackendChallengeEnabled(false)
      return false
    }
  }, [])

  const requestChallengeToken = useCallback(async () => {
    if (!navigator.onLine || !backendChallengeEnabled) {
      challengeTokenRef.current = null
      return
    }
    try {
      const challenge = await startFaceChallenge()
      challengeTokenRef.current = challenge.enabled ? challenge.challengeId : null
    } catch {
      challengeTokenRef.current = null
    }
  }, [backendChallengeEnabled])

  const revokeIdentifiedPreview = useCallback(() => {
    setIdentifiedPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }, [])

  const clearCurrentIdentity = useCallback((clearDialogs = true) => {
    identityAttemptRef.current += 1
    lastFaceBoxRef.current = null
    faceMissingSinceRef.current = null
    revokeIdentifiedPreview()
    setIdentified(null)
    setIdentifying(false)
    setCapturePhase('idle')
    setCaptureProgress(0)
    setConfirming(false)
    setCheckingOut(false)
    if (clearDialogs) {
      setUnrecognizedDialog(null)
      setResult(null)
    }
  }, [revokeIdentifiedPreview])

  const stopCameraStream = useCallback(() => {
    setCameraReady(false)
    setCameraEnabled(false)
    setFaceBox(null)
    setLandmarks(null)
    setAlignment('searching')
    setStatus('Rostro identificado')

    const video = videoRef.current
    if (video) {
      video.srcObject = null
    }

    stop()
  }, [stop, videoRef])

  const setIdentifiedWithPreview = useCallback((person: IdentifiedPerson) => {
    setIdentifiedPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(person.photo)
    })
    setIdentified(person)
    stopCameraStream()
  }, [stopCameraStream])

  const cancelIdentified = useCallback(() => {
    clearCurrentIdentity(false)
    setMessage(null)
    setCameraEnabled(true)
  }, [clearCurrentIdentity])

  const handleChallengeRejected = useCallback(() => {
    // El token expiro o falto: reinicia el reto y vuelve a la camara para repetir el giro.
    resetChallenge()
    clearCurrentIdentity(false)
    setMessageType('error')
    setMessage('El reto de seguridad expiro. Repite el giro de cabeza para marcar.')
    setCameraEnabled(true)
  }, [clearCurrentIdentity, resetChallenge])

  const closePasswordFallback = useCallback(() => {
    // Limpia credenciales para que no queden visibles si el modal se vuelve a abrir.
    setPasswordFallbackOpen(false)
    setFallbackUsername('')
    setFallbackPassword('')
  }, [])

  const turnCameraOff = useCallback(() => {
    setCameraEnabled(false)
    setCameraReady(false)
    clearCurrentIdentity()
    resetChallenge()
    setFaceBox(null)
    setLandmarks(null)
    setAlignment('searching')
    setMessage(null)
    setStatus('Camara apagada')

    const video = videoRef.current
    if (video) {
      video.srcObject = null
    }

    stop()
  }, [clearCurrentIdentity, resetChallenge, stop, videoRef])

  const retryUnrecognizedFace = useCallback(() => {
    setUnrecognizedDialog(null)
    setMessage(null)
  }, [])

  const cancelUnrecognizedFace = useCallback(() => {
    setUnrecognizedDialog(null)
    turnCameraOff()
  }, [turnCameraOff])

  const sendConfirmedEvidenceInBackground = useCallback((photo: Blob, reason: string, userId?: number | null) => {
    // Envia la evidencia al backend sin bloquear el boton; el backend se encarga de subirla a Firebase.
    void saveFaceEvidencePhoto(photo, reason, userId).catch(() => {
      setMessageType('error')
      setMessage('La marcacion fue registrada, pero la foto de evidencia no se pudo subir en este momento.')
    })
  }, [])

  useEffect(() => {
    pendingSyncCountRef.current = pendingSyncCount
  }, [pendingSyncCount])

  useEffect(() => {
    const url = identifiedPreviewUrl
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [identifiedPreviewUrl])

  const synchronizeOfflineRecords = useCallback(async () => {
    if (!cameraEnabled || !isOnline || isSyncing || pendingSyncCountRef.current === 0) return

    setSyncing(true)
    try {
      setMessage(null)
      const syncResult = await syncOfflineAttendanceQueue()
      await refreshPendingSyncCount()
      if (syncResult.synced > 0) {
        setMessageType(syncResult.remaining > 0 ? 'error' : 'info')
        setMessage(
          syncResult.remaining > 0
            ? 'Algunas marcaciones siguen pendientes por sincronizar.'
            : 'Marcaciones sincronizadas correctamente.',
        )
      }
    } catch (error) {
      if (isConnectionError(error)) {
        reportConnectionError()
      }
    } finally {
      setSyncing(false)
    }
  }, [cameraEnabled, isOnline, isSyncing, refreshPendingSyncCount, reportConnectionError, setSyncing])

  useEffect(() => {
    if (!cameraEnabled) {
      setCameraReady(false)
      setStatus('Camara apagada')
      return
    }

    resetChallenge()

    ;(async () => {
      const backendEnabled = await fetchBackendChallengeStatus()
      resetChallenge(backendEnabled, true)
      setStatus('Activando camara...')
      await start()
      setCameraReady(true)
      setStatus('Camara encendida')
    })().catch(() => {
      setMessageType('error')
      setStatus('No se pudo iniciar la camara.')
    })
  }, [cameraEnabled, fetchBackendChallengeStatus, resetChallenge, start])

  useEffect(() => {
    if (!cameraEnabled) return

    void synchronizeOfflineRecords()
    if (isOnline) {
      void refreshOfflineFaceDataset().catch(() => undefined)
    }

    const syncWhenVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (isOnline) {
        void refreshOfflineFaceDataset().catch(() => undefined)
      }
      void synchronizeOfflineRecords()
    }

    const handleOnline = () => {
      void synchronizeOfflineRecords()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('focus', synchronizeOfflineRecords)
    document.addEventListener('visibilitychange', syncWhenVisible)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('focus', synchronizeOfflineRecords)
      document.removeEventListener('visibilitychange', syncWhenVisible)
    }
  }, [cameraEnabled, isOnline, synchronizeOfflineRecords])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (pendingSyncCount > 0) {
        void synchronizeOfflineRecords()
      }
    }, 2000)

    return () => window.clearInterval(timer)
  }, [pendingSyncCount, synchronizeOfflineRecords])

  const identifyCurrentFace = useCallback(async () => {
    if (!cameraEnabled || !cameraReady || !stream || identifying || capturePhase !== 'idle' || confirming || identified || unrecognizedDialog || result) return

    setIdentifying(true)
    let capturedPhoto: Blob | null = null
    const attemptId = identityAttemptRef.current

    try {
      const video = videoRef.current
      if (!video || video.readyState < 2) return

      const faceState = await detectVisibleFacePose(video)
      if (!faceState.visible) {
        setFaceBox(null)
        setLandmarks(null)
        setAlignment('searching')
        const now = Date.now()
        faceMissingSinceRef.current ??= now
        if (now - faceMissingSinceRef.current >= FACE_LOST_CLEAR_MS) {
          clearCurrentIdentity()
        }
        setMessage(null)
        return
      }

      faceMissingSinceRef.current = null
      setFaceBox(faceState.box ?? null)
      setLandmarks(faceState.landmarks ?? null)

      if (effectiveLivenessRequired && !challengePassedRef.current) {
        const challenge =
          challengeRef.current ??
          (challengeRef.current = createActiveFaceChallenge(challengeTypeRef.current, challengeConfig))

        if (!faceState.box) {
          setAlignment('searching')
          return
        }

        const alignmentGate = evaluateChallengeAlignmentGate(
          faceState.box,
          faceState.pose,
          alignmentConfig,
          challenge.getProgress(),
        )

        if (alignmentGate !== 'aligned') {
          setAlignment(alignmentGate)
          return
        }

        const blinkScores = readBlinkScores(faceState.blendshapes)
        let blinkCycleComplete = false
        if (blinkScores) {
          blinkHistoryRef.current.push(blinkScores)
          if (blinkHistoryRef.current.length > 30) {
            blinkHistoryRef.current.shift()
          }
          blinkCycleComplete = detectBlinkCycle(blinkHistoryRef.current, {
            closedThreshold: challengeConfig.thresholds.blinkClosedMin,
            openThreshold: challengeConfig.thresholds.blinkOpenMax,
          })
        }

        const blinkScore = blinkScores ? Math.max(blinkScores.left, blinkScores.right) : undefined

        const step = challenge.submitAnalysis({
          pose: faceState.pose,
          pose3d: faceState.pose3d,
          landmarks: faceState.landmarks ?? undefined,
          blinkScore,
          blinkCycleComplete,
        })
        setChallengePrompt(step.prompt)
        setAlignment('aligned')
        if (step.passed) {
          setChallengeDone(true)
          await requestChallengeToken()
          challengePassedRef.current = true
        }
        return
      }

      const faceAlignment = faceState.box
        ? evaluateFaceAlignment(faceState.box, faceState.pose, null, alignmentConfig)
        : 'aligned'
      setAlignment(faceState.box ? faceAlignment : 'searching')

      // Solo identifica cuando el rostro esta bien encuadrado; guia al usuario y mejora la captura.
      if (faceState.box && faceAlignment !== 'aligned') {
        setMessage(null)
        return
      }

      if (didFaceChangeSignificantly(lastFaceBoxRef.current, faceState.box)) {
        clearCurrentIdentity()
        return
      }
      lastFaceBoxRef.current = faceState.box ?? null

      setCapturePhase('capturing')
      setCaptureProgress(5)
      await yieldToUi()
      capturedPhoto = await captureFacePhoto(video, 'verification', setCaptureProgress)

      if (attemptId !== identityAttemptRef.current) return

      setCapturePhase('identifying')
      setCaptureProgress(95)
      const identifyResult = await identifyCapturedFace(capturedPhoto, {
        isOnline: true,
        challengeToken: challengeTokenRef.current,
      })
      setCaptureProgress(100)
      if (attemptId !== identityAttemptRef.current) return

      const currentFaceState = await detectVisibleFacePose(video)
      if (!currentFaceState.visible || didFaceChangeSignificantly(faceState.box ?? null, currentFaceState.box)) {
        clearCurrentIdentity()
        return
      }

      if (identifyResult.requiresReenrollment) {
        setResult({
          title: 'Revalidacion facial requerida',
          description: identifyResult.message ?? 'Tu registro facial debe actualizarse antes de marcar asistencia.',
          statusLabel: 'Revalidar',
          variant: 'warning',
        })
        return
      }

      if (!identifyResult.matched || !identifyResult.user || !identifyResult.nextAction) {
        setMessage(null)
        setUnrecognizedDialog(identifyResult.message ?? 'No pudimos identificar este rostro.')
        return
      }

      setMessage(null)
      setIdentifiedWithPreview({
        user: identifyResult.user,
        photo: capturedPhoto,
        nextAction: identifyResult.nextAction,
        faceDataId: identifyResult.faceDataId,
        score: identifyResult.score,
      })
    } catch (error) {
      if (isConnectionError(error) && capturedPhoto) {
        if (attemptId !== identityAttemptRef.current) return
        reportConnectionError()
        try {
          const offlineResult = await identifyCapturedFace(capturedPhoto, { isOnline: false })
          if (attemptId !== identityAttemptRef.current) return
          if (!offlineResult.matched || !offlineResult.user || !offlineResult.nextAction) {
            setMessage(null)
            setUnrecognizedDialog(
              offlineResult.message ?? 'Sin conexion. No pudimos reconocer el rostro con el dataset offline guardado.',
            )
            return
          }

          setMessage(null)
          setIdentifiedWithPreview({
            user: offlineResult.user,
            photo: capturedPhoto,
            nextAction: offlineResult.nextAction,
            faceDataId: offlineResult.faceDataId,
            score: offlineResult.score,
          })
          return
        } catch {
          setMessageType('error')
          setMessage('Sin conexion. El modelo facial offline no pudo cargarse correctamente.')
          return
        }
      }

      setMessageType('error')
      setMessage(
        isOnline
          ? 'No se pudo identificar el rostro. Revisa conexion con el backend.'
          : 'Sin conexion. Para identificar un rostro por primera vez se necesita internet.',
      )
    } finally {
      setIdentifying(false)
      setCapturePhase('idle')
      setCaptureProgress(0)
    }
  }, [alignmentConfig, cameraEnabled, cameraReady, capturePhase, challengeConfig, clearCurrentIdentity, confirming, effectiveLivenessRequired, identified, identifying, reportConnectionError, requestChallengeToken, result, setIdentifiedWithPreview, stream, unrecognizedDialog, videoRef])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void identifyCurrentFace()
    }, 450)

    return () => window.clearInterval(timer)
  }, [identifyCurrentFace])

  async function confirmAttendance() {
    if (!identified) return

    setConfirming(true)
    setCapturePhase('confirming')
    setCaptureProgress(95)
    try {
      const res = await verifyFacePhoto(identified.photo, 'CHECK_IN', undefined, challengeTokenRef.current)
      if (res.challengeRequired) {
        handleChallengeRejected()
        return
      }
      if (res.requiresReenrollment) {
        setResult({
          title: 'Revalidacion facial requerida',
          description: res.message ?? 'Tu registro facial debe actualizarse antes de marcar asistencia.',
          statusLabel: 'Revalidar',
          variant: 'warning',
        })
        clearCurrentIdentity(false)
        return
      }

      if (!res.matched) {
        setMessageType('error')
        setMessage(res.message ?? 'Rostro no registrado.')
        return
      }

      const isLate = res.attendanceStatus === 'TARDANZA'
      const checkInTime = res.checkInTime ?? '-'

      sendConfirmedEvidenceInBackground(identified.photo, 'CHECK_IN_CONFIRMED', identified.user.id)
      rememberLocalCheckIn(identified.user)

      setResult({
        title: res.alreadyRegistered
          ? 'Asistencia ya registrada'
          : isLate
            ? 'Asistencia registrada con tardanza'
            : 'Asistencia registrada',
        description: res.alreadyRegistered
          ? `Tu asistencia de hoy ya fue registrada a las ${checkInTime}.`
          : isLate
            ? `Tu ingreso fue registrado a las ${checkInTime}. Como es despues de las 8:15AM, queda marcado como tardanza.`
            : `Tu ingreso fue registrado correctamente a las ${checkInTime}.`,
        statusLabel: isLate ? 'Tardanza' : 'Puntual',
        checkInTime,
        variant: res.alreadyRegistered || isLate ? 'warning' : 'success',
      })
      setCaptureProgress(100)
      clearCurrentIdentity(false)
    } catch (error) {
      if (isConnectionError(error)) {
        await enqueueOfflineAttendance({
          action: 'CHECK_IN',
          photo: identified.photo,
          userId: identified.user.id,
          userName: identified.user.name,
          faceDataId: identified.faceDataId ?? null,
          score: identified.score ?? null,
        })
        reportConnectionError()
        await refreshPendingSyncCount()
        setResult({
          title: 'Asistencia guardada',
          description: 'No hay conexion. La asistencia quedo guardada y se sincronizara automaticamente cuando vuelva internet.',
          statusLabel: 'Pendiente',
          checkInTime: getCurrentTimeLabel(),
          variant: 'warning',
        })
        setMessage(null)
        clearCurrentIdentity(false)
        return
      }

      setMessageType('error')
      setMessage('Error al registrar asistencia. Revisa el backend.')
    } finally {
      setConfirming(false)
      setCapturePhase('idle')
      setCaptureProgress(0)
    }
  }

  async function markCheckOut() {
    setCheckingOut(true)
    setCapturePhase('confirming')
    setCaptureProgress(95)
    let photo = identified?.photo

    try {
      const video = videoRef.current

      if (!photo) {
        if (!video || video.readyState < 2) {
          setMessageType('error')
          setMessage('No se detecto rostro para marcar salida.')
          return
        }
        setCapturePhase('capturing')
        setCaptureProgress(5)
        await yieldToUi()
        photo = await captureFacePhoto(video, 'verification', setCaptureProgress)
        setCapturePhase('confirming')
        setCaptureProgress(95)
      }

      if (!photo) {
        setMessageType('error')
        setMessage('No se detecto rostro para marcar salida.')
        return
      }

      const res = await verifyFacePhoto(photo, 'CHECK_OUT', undefined, challengeTokenRef.current)
      setCaptureProgress(100)
      if (res.challengeRequired) {
        handleChallengeRejected()
        return
      }
      if (res.requiresReenrollment) {
        setResult({
          title: 'Revalidacion facial requerida',
          description: res.message ?? 'Tu registro facial debe actualizarse antes de marcar salida.',
          statusLabel: 'Revalidar',
          variant: 'warning',
        })
        return
      }

      setMessageType(res.matched ? 'info' : 'error')
      if (res.matched) {
        setMessage(null)
        forgetLocalCheckIn(identified?.user.id ?? res.user?.id)
        sendConfirmedEvidenceInBackground(photo, 'CHECK_OUT_CONFIRMED', identified?.user.id)
        setResult({
          title: 'Salida registrada',
          description: res.message ?? 'Tu salida fue registrada correctamente.',
          statusLabel: 'Salida',
          checkInTime: getCurrentTimeLabel(),
          variant: 'success',
        })
      } else {
        setMessage(res.message ?? 'Rostro no registrado.')
      }
    } catch (error) {
      if (isConnectionError(error) && photo) {
        await enqueueOfflineAttendance({
          action: 'CHECK_OUT',
          photo,
          userId: identified?.user.id,
          userName: identified?.user.name,
          faceDataId: identified?.faceDataId ?? null,
          score: identified?.score ?? null,
        })
        reportConnectionError()
        await refreshPendingSyncCount()
        setResult({
          title: 'Salida guardada',
          description: 'No hay conexion. La salida quedo guardada y se sincronizara automaticamente cuando vuelva internet.',
          statusLabel: 'Pendiente',
          checkInTime: getCurrentTimeLabel(),
          variant: 'warning',
        })
        setMessage(null)
        clearCurrentIdentity(false)
        return
      }

      setMessageType('error')
      setMessage('Error al registrar salida. Revisa el backend.')
    } finally {
      setCheckingOut(false)
      setCapturePhase('idle')
      setCaptureProgress(0)
    }
  }

  async function markAttendanceWithPassword() {
    const username = fallbackUsername.trim()
    if (!username || !fallbackPassword) {
      setMessageType('error')
      setMessage('Ingresa usuario y contrasena para marcar asistencia.')
      return
    }

    setFallbackLoading(true)
    try {
      const res = await verifyAttendanceWithPassword({
        username,
        password: fallbackPassword,
      })

      if (!res.matched) {
        setMessageType('error')
        setMessage(res.message ?? 'No se pudo validar usuario y contrasena.')
        return
      }

      const isCheckOut = res.action === 'CHECK_OUT'
      const isLate = res.attendanceStatus === 'TARDANZA'
      const timeLabel = res.checkInTime ?? getCurrentTimeLabel()

      if (isCheckOut) {
        forgetLocalCheckIn(res.user?.id)
      } else if (res.user) {
        rememberLocalCheckIn(res.user)
      }

      closePasswordFallback()
      setMessage(null)
      clearCurrentIdentity(false)
      setResult({
        title: isCheckOut
          ? 'Salida registrada'
          : res.alreadyRegistered
            ? 'Asistencia ya registrada'
            : isLate
              ? 'Asistencia registrada con tardanza'
              : 'Asistencia registrada',
        description: res.message ?? (
          isCheckOut
            ? 'Tu salida fue registrada correctamente.'
            : `Tu ingreso fue registrado correctamente a las ${timeLabel}.`
        ),
        statusLabel: isCheckOut ? 'Salida' : isLate ? 'Tardanza' : 'Puntual',
        checkInTime: timeLabel,
        variant: res.alreadyRegistered || isLate ? 'warning' : 'success',
      })
    } catch {
      setMessageType('error')
      setMessage('No se pudo marcar asistencia con usuario y contrasena. Revisa el backend.')
    } finally {
      setFallbackLoading(false)
    }
  }

  // Ejecuta la accion que el backend determino para el rostro identificado.
  async function confirmIdentifiedAction() {
    if (!identified) return

    if (identified.nextAction === 'CHECK_OUT') {
      await markCheckOut()
      clearCurrentIdentity(false)
      return
    }

    await confirmAttendance()
  }

  const showIdentifiedMessage = identified !== null && !cameraEnabled
  const showCameraOffMessage = !cameraEnabled && !identified
  const showOfflineMessage = cameraEnabled && !isOnline
  const showSyncMessage = cameraEnabled && isOnline && isSyncing && pendingSyncCount > 0 && capturePhase === 'idle'
  const showProcessingFaceMessage = cameraEnabled && cameraReady && capturePhase !== 'idle' && !showSyncMessage
  const showChallengeMessage = cameraEnabled && cameraReady && capturePhase === 'idle' && effectiveLivenessRequired && !challengeDone
  const showWaitingFaceMessage = cameraEnabled && cameraReady && capturePhase === 'idle' && challengeDone && !showOfflineMessage && !showSyncMessage

  const captureOverlayTitle =
    capturePhase === 'capturing'
      ? 'Procesando foto...'
      : capturePhase === 'identifying'
        ? 'Identificando rostro...'
        : 'Confirmando...'

  const challengeNeedsAlignment =
    showChallengeMessage && alignment !== 'aligned' && alignment !== 'searching'

  const overlayMessage =
    showIdentifiedMessage
      ? 'Rostro identificado. Confirma tu marcacion en el dialogo.'
      : showCameraOffMessage
      ? 'Camara apagada'
      : showProcessingFaceMessage
        ? 'Identificando rostro...'
      : showChallengeMessage
        ? challengeNeedsAlignment
          ? faceAlignmentMessage(alignment)
          : alignment === 'searching'
            ? 'Coloca tu rostro dentro del marco'
            : challengePrompt
      : showOfflineMessage
        ? pendingSyncCount > 0
          ? 'Sin conexion. Tu marcacion se guardara y se sincronizara cuando vuelva internet.'
          : 'Sin conexion. El sistema sigue disponible en modo offline.'
        : showSyncMessage
          ? 'Sincronizando marcaciones pendientes...'
          : showWaitingFaceMessage
              ? alignment === 'searching'
                ? 'Coloca tu rostro frente a la camara'
                : alignment === 'aligned'
                  ? 'Perfecto, manten la posicion, identificando...'
                  : faceAlignmentMessage(alignment)
              : status

  return (
    <div className="space-y-4">
      <ProcessingOverlay
        open={capturePhase !== 'idle'}
        title={captureOverlayTitle}
        progress={captureProgress}
        scope="viewport"
      />

      {unrecognizedDialog && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="h-2 bg-red-500" />
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-50 text-lg font-black text-red-700">
                  !
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-950">Rostro no reconocido</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{unrecognizedDialog}</p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <LoadingButton type="button" variant="dark" onClick={cancelUnrecognizedFace}>
                  Cancelar
                </LoadingButton>
                <LoadingButton type="button" variant="primary" onClick={retryUnrecognizedFace}>
                  Reintentar
                </LoadingButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {identified && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="h-2 bg-brand-blue" />
            <div className="p-6">
              <div className="flex items-start gap-4">
                {identifiedPreviewUrl ? (
                  <img
                    src={identifiedPreviewUrl}
                    alt="Rostro capturado"
                    className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-brand-blue/30"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-lg font-black text-brand-blue">
                    ID
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-bold text-slate-950">Rostro identificado</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Confirma que los datos sean correctos antes de registrar {identified.nextAction === 'CHECK_OUT' ? 'salida' : 'asistencia'}.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Nombre</span>
                  <span className="font-semibold text-slate-950">{identified.user.name ?? 'Usuario'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">DNI</span>
                  <span className="font-semibold text-slate-950">{identified.user.dni ?? '-'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Rol</span>
                  <span className="font-semibold text-slate-950">{formatUserRole(identified.user.type)}</span>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <LoadingButton
                  type="button"
                  variant="dark"
                  onClick={cancelIdentified}
                  disabled={confirming || checkingOut}
                >
                  Cancelar
                </LoadingButton>
                <LoadingButton
                  type="button"
                  variant="primary"
                  loading={confirming || checkingOut}
                  loadingText="Confirmando..."
                  onClick={() => void confirmIdentifiedAction()}
                >
                  {identified.nextAction === 'CHECK_OUT' ? 'Confirmar salida' : 'Confirmar asistencia'}
                </LoadingButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className={['h-2', result.variant === 'success' ? 'bg-emerald-500' : 'bg-amber-500'].join(' ')} />
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-950">{result.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{result.description}</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hora</div>
                  <div className="mt-1 text-lg font-bold text-slate-950">{result.checkInTime ?? '-'}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</div>
                  <div className={['mt-1 text-lg font-bold', result.variant === 'success' ? 'text-emerald-700' : 'text-amber-700'].join(' ')}>
                    {result.statusLabel}
                  </div>
                </div>
              </div>
              <LoadingButton type="button" variant="dark" className="mt-6 w-full" onClick={() => setResult(null)}>
                Entendido
              </LoadingButton>
            </div>
          </div>
        </div>
      )}

      {passwordFallbackOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="h-2 bg-brand-orange" />
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-950">Marcar con usuario y contrasena</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Usa esta opcion solo cuando el reconocimiento facial no este disponible.
              </p>

              <div className="mt-5 space-y-3">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Usuario</span>
                  <input
                    value={fallbackUsername}
                    onChange={(event) => setFallbackUsername(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                    placeholder="Ingresa tu usuario"
                    autoComplete="username"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Contrasena</span>
                  <input
                    value={fallbackPassword}
                    onChange={(event) => setFallbackPassword(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                    placeholder="Ingresa tu contrasena"
                    type="password"
                    autoComplete="current-password"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void markAttendanceWithPassword()
                    }}
                  />
                </label>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <LoadingButton
                  type="button"
                  variant="dark"
                  onClick={closePasswordFallback}
                  disabled={fallbackLoading}
                >
                  Cancelar
                </LoadingButton>
                <LoadingButton
                  type="button"
                  variant="primary"
                  loading={fallbackLoading}
                  loadingText="Validando..."
                  onClick={() => void markAttendanceWithPassword()}
                >
                  Marcar asistencia
                </LoadingButton>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative overflow-hidden rounded-xl bg-black ring-1 ring-black/10">
        {identifiedPreviewUrl && !cameraReady ? (
          <img
            src={identifiedPreviewUrl}
            alt="Rostro capturado"
            className="aspect-video w-full object-cover"
          />
        ) : (
          <video ref={videoRef} className="aspect-video w-full object-cover" playsInline muted autoPlay />
        )}
        {cameraEnabled && cameraReady && (
          <FacePositionGuide
            alignment={alignment}
            faceBox={faceBox}
            runtimeConfig={alignmentConfig}
            faceGuide={faceGuide}
          />
        )}
        {cameraEnabled && cameraReady && (
          <FaceBoxOverlay box={faceBox} showFaceBox={showFaceBox} alignment={alignment} />
        )}
        {cameraEnabled && cameraReady && showFaceLandmarks && (
          <FaceLandmarksOverlay
            landmarks={landmarks}
            alignment={alignment}
            landmarkLayers={landmarkLayers}
            landmarkDrawStyle={landmarkDrawStyle}
            landmarkPointSizePx={landmarkPointSizePx}
            landmarkAlignmentColors={landmarkAlignmentColors}
          />
        )}
      </div>

      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800"
      >
        {showSyncMessage ? (
          <div className="flex items-center gap-3">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-blue" aria-hidden="true" />
            <span>{cameraError ?? overlayMessage}</span>
          </div>
        ) : (
          cameraError ?? overlayMessage
        )}
      </div>

      {!result && (
        <div className="grid gap-3">
          {!identified && (
            <LoadingButton
              type="button"
              variant={cameraEnabled ? 'dark' : 'primary'}
              className={cameraEnabled ? 'fixed bottom-6 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 shadow-xl sm:w-auto' : undefined}
              onClick={() => {
                if (cameraEnabled) {
                  turnCameraOff()
                  return
                }

                setMessage(null)
                setResult(null)
                setCameraEnabled(true)
              }}
              disabled={confirming || checkingOut}
            >
              {cameraEnabled ? 'Apagar camara' : 'Encender camara'}
            </LoadingButton>
          )}
          <LoadingButton
            type="button"
            variant="dark"
            onClick={() => {
              setMessage(null)
              setPasswordFallbackOpen(true)
            }}
          >
            Usar usuario y contrasena
          </LoadingButton>
        </div>
      )}

      {message && (
        <div
          className={[
            'rounded-xl border px-4 py-3 text-sm font-medium',
            messageType === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-slate-200 bg-slate-50 text-slate-800',
          ].join(' ')}
        >
          {message}
        </div>
      )}
    </div>
  )
}
