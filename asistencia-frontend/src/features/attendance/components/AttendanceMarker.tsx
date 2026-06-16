import { useCallback, useEffect, useRef, useState } from 'react'

import { LoadingButton } from '../../../components/ui/LoadingButton'
import { useCamera } from '../../../hooks/useCamera'
import {
  enqueueOfflineAttendance,
  getOfflineAttendanceCount,
  isConnectionError,
  syncOfflineAttendanceQueue,
} from '../../../services/offlineAttendanceQueue'
import { forgetLocalCheckIn, hasLocalCheckIn, rememberLocalCheckIn } from '../../../services/localAttendanceState'
import { findBestOfflineFaceMatch, getOfflineFaceDataset, refreshOfflineFaceDataset } from '../../../services/offlineFaceDataset'
import { generateLocalFaceDescriptorCandidates } from '../../../services/localFaceDescriptor'
import { identifyFacePhoto, saveFaceEvidencePhoto, verifyAttendanceWithPassword, verifyFacePhoto } from '../../../services/recognitionService'
import type { User } from '../../../types/user'
import { formatUserRole } from '../../../utils/userRole'
import { captureVideoFrameBlob } from '../../recognition/services/cameraEvidence'
import { hasVisibleFace } from '../../recognition/services/facePresenceDetector'

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

const ATTENDANCE_CAPTURE_FORMAT = 'jpeg'
const ATTENDANCE_CAPTURE_MAX_WIDTH = 960
const ATTENDANCE_CAPTURE_MAX_HEIGHT = 720

function getCurrentTimeLabel() {
  // Centraliza el formato de hora que se muestra cuando una marcacion queda pendiente.
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function AttendanceMarker() {
  const { videoRef, start, stop, stream, error: cameraError } = useCamera()

  const [cameraReady, setCameraReady] = useState(false)
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const offlinePendingCountRef = useRef(0)
  const [status, setStatus] = useState('Camara apagada')
  const [message, setMessage] = useState<string | null>(null)
  const [messageType, setMessageType] = useState<'info' | 'error'>('info')
  const [identified, setIdentified] = useState<IdentifiedPerson | null>(null)
  const [result, setResult] = useState<AttendanceResult | null>(null)
  const [identifying, setIdentifying] = useState(false)
  const [processingFace, setProcessingFace] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [offlinePendingCount, setOfflinePendingCount] = useState(0)
  const [syncingOffline, setSyncingOffline] = useState(false)
  const [passwordFallbackOpen, setPasswordFallbackOpen] = useState(false)
  const [fallbackUsername, setFallbackUsername] = useState('')
  const [fallbackPassword, setFallbackPassword] = useState('')
  const [fallbackLoading, setFallbackLoading] = useState(false)

  const closePasswordFallback = useCallback(() => {
    // Limpia credenciales para que no queden visibles si el modal se vuelve a abrir.
    setPasswordFallbackOpen(false)
    setFallbackUsername('')
    setFallbackPassword('')
  }, [])

  const turnCameraOff = useCallback(() => {
    setCameraEnabled(false)
    setCameraReady(false)
    setIdentified(null)
    setResult(null)
    setMessage(null)
    setIdentifying(false)
    setProcessingFace(false)
    setConfirming(false)
    setCheckingOut(false)
    setStatus('Camara apagada')

    const video = videoRef.current
    if (video) {
      video.srcObject = null
    }

    stop()
  }, [stop, videoRef])

  const sendConfirmedEvidenceInBackground = useCallback((photo: Blob, reason: string, userId?: number | null) => {
    // Envia la evidencia al backend sin bloquear el boton; el backend se encarga de subirla a Firebase.
    void saveFaceEvidencePhoto(photo, reason, userId).catch(() => {
      setMessageType('error')
      setMessage('La marcacion fue registrada, pero la foto de evidencia no se pudo subir en este momento.')
    })
  }, [])

  const refreshOfflinePendingCount = useCallback(async () => {
    // Mantiene visible cuantas marcaciones quedaron pendientes en este navegador.
    setOfflinePendingCount(await getOfflineAttendanceCount())
  }, [])

  useEffect(() => {
    offlinePendingCountRef.current = offlinePendingCount
  }, [offlinePendingCount])

  const synchronizeOfflineRecords = useCallback(async () => {
    // Reintenta enviar al backend las marcaciones guardadas cuando vuelve la conexion.
    if (!cameraEnabled || !navigator.onLine || syncingOffline || offlinePendingCountRef.current === 0) return

    setSyncingOffline(true)
    try {
      setMessage(null)
      const syncResult = await syncOfflineAttendanceQueue()
      setOfflinePendingCount(syncResult.remaining)
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
        setIsOnline(false)
      }
    } finally {
      setSyncingOffline(false)
    }
  }, [cameraEnabled, syncingOffline])

  useEffect(() => {
    if (!cameraEnabled) {
      setCameraReady(false)
      setStatus('Camara apagada')
      return
    }

    ;(async () => {
      setStatus('Activando camara...')
      await start()
      setCameraReady(true)
      setStatus('Camara encendida')
    })().catch(() => {
      setMessageType('error')
      setStatus('No se pudo iniciar la camara.')
    })
  }, [cameraEnabled, start])

  useEffect(() => {
    void refreshOfflinePendingCount()

    if (cameraEnabled) {
      void synchronizeOfflineRecords()
      if (navigator.onLine) {
        void refreshOfflineFaceDataset().catch(() => undefined)
      }
    }

    const syncWhenVisible = () => {
      if (!cameraEnabled) return
      if (document.visibilityState === 'visible') {
        if (navigator.onLine) {
          setIsOnline(true)
          void refreshOfflineFaceDataset().catch(() => undefined)
        }
        void synchronizeOfflineRecords()
      }
    }

    const handleOnline = () => {
      setIsOnline(true)
      if (!cameraEnabled) return
      void synchronizeOfflineRecords()
    }

    const handleOffline = () => {
      setIsOnline(false)
      setSyncingOffline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('focus', synchronizeOfflineRecords)
    document.addEventListener('visibilitychange', syncWhenVisible)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('focus', synchronizeOfflineRecords)
      document.removeEventListener('visibilitychange', syncWhenVisible)
    }
  }, [cameraEnabled, refreshOfflinePendingCount, synchronizeOfflineRecords])

  const identifyOfflineFace = useCallback(async (photo: Blob): Promise<IdentifiedPerson | null> => {
    // Intenta identificar localmente usando el dataset cifrado y el modelo ONNX exportado desde DJL.
    const dataset = await getOfflineFaceDataset()
    if (!dataset || dataset.faces.length === 0) return null

    const descriptors = await generateLocalFaceDescriptorCandidates(photo)
    if (descriptors.length === 0) return null

    let bestMatch = null as ReturnType<typeof findBestOfflineFaceMatch> | null

    for (const descriptor of descriptors) {
      const match = findBestOfflineFaceMatch(dataset, descriptor)
      if (match && (!bestMatch || match.score > bestMatch.score)) {
        bestMatch = match
      }
    }

    if (!bestMatch) return null

    return {
      user: {
        id: bestMatch.face.userId,
        name: bestMatch.face.userName,
        dni: bestMatch.face.userDni ?? null,
        type: (bestMatch.face.userType as User['type']) ?? null,
      } as User,
      photo,
      nextAction: hasLocalCheckIn(bestMatch.face.userId) ? 'CHECK_OUT' : 'CHECK_IN',
      faceDataId: bestMatch.face.faceDataId,
      score: bestMatch.score,
    }
  }, [])

  useEffect(() => {
    // Reintenta sincronizar cada 2 segundos; asi la cola se procesa rapido cuando vuelve internet.
    const timer = window.setInterval(() => {
      if (offlinePendingCount > 0) {
        void synchronizeOfflineRecords()
      }
    }, 2000)

    return () => window.clearInterval(timer)
  }, [offlinePendingCount, synchronizeOfflineRecords])

  const identifyCurrentFace = useCallback(async () => {
    if (!cameraEnabled || !cameraReady || !stream || identifying || confirming || identified || result) return

    setIdentifying(true)
    let capturedPhoto: Blob | null = null

    try {
      const video = videoRef.current
      if (!video || video.readyState < 2) return

      const faceVisible = await hasVisibleFace(video)
      if (!faceVisible) {
        setMessage(null)
        return
      }

      setProcessingFace(true)
      capturedPhoto = await captureVideoFrameBlob(video, {
        format: ATTENDANCE_CAPTURE_FORMAT,
        quality: 0.9,
        maxWidth: ATTENDANCE_CAPTURE_MAX_WIDTH,
        maxHeight: ATTENDANCE_CAPTURE_MAX_HEIGHT,
        enhanceLowLight: true,
      })

      const res = await identifyFacePhoto(capturedPhoto)
      if (res.requiresReenrollment) {
        setResult({
          title: 'Revalidacion facial requerida',
          description: res.message ?? 'Tu registro facial debe actualizarse antes de marcar asistencia.',
          statusLabel: 'Revalidar',
          variant: 'warning',
        })
        return
      }

      if (!res.matched || !res.user) {
        setMessageType('error')
        setMessage(res.message ?? 'Rostro no reconocido.')
        return
      }

      if (res.nextAction === 'CHECK_OUT') {
        // Si el backend confirma que ya tiene entrada hoy, recordamos ese estado para una posible salida offline.
        rememberLocalCheckIn(res.user)
      } else {
        // Si el backend dice que aun toca entrada, limpiamos cualquier estado local viejo para no mostrar salida por error.
        forgetLocalCheckIn(res.user.id)
      }

      setMessage(null)
      setIdentified({
        user: res.user,
        photo: capturedPhoto,
        nextAction: res.nextAction === 'CHECK_OUT' ? 'CHECK_OUT' : 'CHECK_IN',
      })
    } catch (error) {
      if (isConnectionError(error) && capturedPhoto) {
        setIsOnline(false)
        try {
          const offlineIdentity = await identifyOfflineFace(capturedPhoto)
          if (!offlineIdentity) {
            setMessageType('error')
            setMessage('Sin conexion. No se pudo reconocer el rostro con el dataset offline guardado.')
            return
          }

          setMessage(null)
          setIdentified(offlineIdentity)
          return
        } catch {
          setMessageType('error')
          setMessage('Sin conexion. El modelo facial offline no pudo cargarse correctamente.')
          return
        }
      }

      setMessageType('error')
      setMessage(
        navigator.onLine
          ? 'No se pudo identificar el rostro. Revisa conexion con el backend.'
          : 'Sin conexion. Para identificar un rostro por primera vez se necesita internet.',
      )
    } finally {
      setIdentifying(false)
      setProcessingFace(false)
    }
  }, [cameraEnabled, cameraReady, confirming, identified, identifyOfflineFace, identifying, result, stream, videoRef])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void identifyCurrentFace()
    }, 450)

    return () => window.clearInterval(timer)
  }, [identifyCurrentFace])

  async function confirmAttendance() {
    if (!identified) return

    setConfirming(true)
    try {
      const res = await verifyFacePhoto(identified.photo, 'CHECK_IN')
      if (res.requiresReenrollment) {
        setResult({
          title: 'Revalidacion facial requerida',
          description: res.message ?? 'Tu registro facial debe actualizarse antes de marcar asistencia.',
          statusLabel: 'Revalidar',
          variant: 'warning',
        })
        setIdentified(null)
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
      setIdentified(null)
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
        setIsOnline(false)
        await refreshOfflinePendingCount()
        setResult({
          title: 'Asistencia guardada',
          description: 'No hay conexion. La asistencia quedo guardada y se sincronizara automaticamente cuando vuelva internet.',
          statusLabel: 'Pendiente',
          checkInTime: getCurrentTimeLabel(),
          variant: 'warning',
        })
        setMessage(null)
        setIdentified(null)
        return
      }

      setMessageType('error')
      setMessage('Error al registrar asistencia. Revisa el backend.')
    } finally {
      setConfirming(false)
    }
  }

  async function markCheckOut() {
    setCheckingOut(true)
    let photo = identified?.photo

    try {
      const video = videoRef.current

      if (!photo) {
        if (!video || video.readyState < 2) {
          setMessageType('error')
          setMessage('No se detecto rostro para marcar salida.')
          return
        }
        photo = await captureVideoFrameBlob(video, {
          format: ATTENDANCE_CAPTURE_FORMAT,
          quality: 0.9,
          maxWidth: ATTENDANCE_CAPTURE_MAX_WIDTH,
          maxHeight: ATTENDANCE_CAPTURE_MAX_HEIGHT,
          enhanceLowLight: true,
        })
      }

      if (!photo) {
        setMessageType('error')
        setMessage('No se detecto rostro para marcar salida.')
        return
      }

      const res = await verifyFacePhoto(photo, 'CHECK_OUT')
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
        setIsOnline(false)
        await refreshOfflinePendingCount()
        setResult({
          title: 'Salida guardada',
          description: 'No hay conexion. La salida quedo guardada y se sincronizara automaticamente cuando vuelva internet.',
          statusLabel: 'Pendiente',
          checkInTime: getCurrentTimeLabel(),
          variant: 'warning',
        })
        setMessage(null)
        setIdentified(null)
        return
      }

      setMessageType('error')
      setMessage('Error al registrar salida. Revisa el backend.')
    } finally {
      setCheckingOut(false)
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
      setIdentified(null)
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
      setIdentified(null)
      return
    }

    await confirmAttendance()
  }

  const showCameraOffMessage = !cameraEnabled
  const showOfflineMessage = cameraEnabled && !isOnline
  const showSyncMessage = cameraEnabled && isOnline && syncingOffline && offlinePendingCount > 0 && !identifying
  const showProcessingFaceMessage = cameraEnabled && cameraReady && processingFace && !showSyncMessage
  const showWaitingFaceMessage = cameraEnabled && cameraReady && !processingFace && !showOfflineMessage && !showSyncMessage

  const overlayMessage =
    showCameraOffMessage
      ? 'Camara apagada'
      : showProcessingFaceMessage
        ? 'Identificando rostro...'
      : showOfflineMessage
        ? offlinePendingCount > 0
          ? 'Sin conexion a internet. Tu marcacion se guardara y se sincronizara cuando vuelva internet.'
          : 'Sin conexion a internet.'
        : showSyncMessage
          ? 'Sincronizando marcaciones pendientes...'
          : showWaitingFaceMessage
              ? 'Coloca tu rostro frente a la camara'
              : status

  return (
    <div className="space-y-4">
      {identified && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="h-2 bg-brand-blue" />
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-lg font-black text-brand-blue">
                  ID
                </div>
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
                  onClick={() => setIdentified(null)}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
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
        <video ref={videoRef} className="aspect-video w-full object-cover" playsInline muted autoPlay />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <div className="relative h-[72%] w-[54%] max-w-sm rounded-[2rem] border border-sky-300/55 shadow-[0_0_24px_rgba(56,189,248,0.18)]">
            <div className="absolute left-4 right-4 top-1/2 h-px bg-sky-200/80 shadow-[0_0_14px_rgba(125,211,252,0.45)] animate-pulse" />
            <div className="absolute left-3 top-3 h-8 w-8 rounded-tl-2xl border-l-2 border-t-2 border-sky-200/80" />
            <div className="absolute right-3 top-3 h-8 w-8 rounded-tr-2xl border-r-2 border-t-2 border-sky-200/80" />
            <div className="absolute bottom-3 left-3 h-8 w-8 rounded-bl-2xl border-b-2 border-l-2 border-sky-200/80" />
            <div className="absolute bottom-3 right-3 h-8 w-8 rounded-br-2xl border-b-2 border-r-2 border-sky-200/80" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
        {showSyncMessage || showProcessingFaceMessage ? (
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
