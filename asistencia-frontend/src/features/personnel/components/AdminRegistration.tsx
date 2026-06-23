import { useEffect, useMemo, useRef, useState } from 'react'

import { Alert } from '../../../components/ui/Alert'
import { LoadingButton } from '../../../components/ui/LoadingButton'
import { ModalAlert } from '../../../components/ui/ModalAlert'
import { useCamera } from '../../../hooks/useCamera'
import type { UserType } from '../../../types/user'
import { userRoleOptions } from '../../../utils/userRole'
import { sanitizePersonName, sanitizePhone } from '../../../utils/validators'
import { captureVideoFrameBlob } from '../../recognition/services/cameraEvidence'
import { detectVisibleFacePose, type FacePose } from '../../recognition/services/facePresenceDetector'
import { createUserAndRegisterFace, registerMultiAngleFaceForExistingUser } from '../services/registrationService'
import { checkFaceDataPhoto } from '../../../services/recognitionService'

type Mode = 'EXISTENTE' | 'NUEVO'
type ExistingRegistrationStep = 'credentials' | 'guide' | 'capture'
type CaptureAngle = 'front' | 'left' | 'right'

type AngleCapture = {
  key: CaptureAngle
  label: string
  instruction: string
}

const FACE_CHECK_INTERVAL_MS = 350
const FACE_CAPTURE_FORMAT = 'jpeg'
const FACE_CAPTURE_QUALITY = 1
const ANGLE_CAPTURES: AngleCapture[] = [
  {
    key: 'front',
    label: 'Frontal',
    instruction: 'Mira directamente a la camara y manten el rostro centrado.',
  },
  {
    key: 'left',
    label: 'Izquierda',
    instruction: 'Gira ligeramente el rostro hacia tu izquierda, sin salir del recuadro.',
  },
  {
    key: 'right',
    label: 'Derecha',
    instruction: 'Gira ligeramente el rostro hacia tu derecha, sin salir del recuadro.',
  },
]
function normalizeFaceRegistrationError(reason: string): string {
  if (/descriptor facial|no se pudo generar|no se detecto|no_face/i.test(reason)) {
    return 'No se detecto un rostro claro. Centra el rostro, mejora la luz e intenta nuevamente.'
  }
  if (/multiple_faces/i.test(reason)) {
    return 'Solo debe haber un rostro frente a la camara.'
  }
  if (/low_quality_face/i.test(reason)) {
    return 'Mejora la luz, centra el rostro y evita accesorios antes de registrar.'
  }
  return reason
}

function isExpectedPose(angle: CaptureAngle, pose: FacePose): boolean {
  return angle === pose
}

function getCaptureGuidanceMessage(angle: CaptureAngle, pose: FacePose): string {
  if (isExpectedPose(angle, pose)) {
    return angle === 'front'
      ? 'Rostro frontal detectado. Puedes capturar.'
      : angle === 'left'
        ? 'Giro izquierdo detectado. Puedes capturar.'
        : 'Giro derecho detectado. Puedes capturar.'
  }

  if (angle === 'front') return 'Mira directamente a la camara para capturar frontal.'
  if (angle === 'left') return 'Gira el rostro hacia tu izquierda para continuar.'
  return 'Gira el rostro hacia tu derecha para continuar.'
}

export function AdminRegistration() {
  const newUserFormKey = useMemo(() => `new-user-${Date.now()}`, [])
  const checkingFaceRef = useRef(false)
  const autoCapturingRef = useRef(false)
  const [mode, setMode] = useState<Mode>('EXISTENTE')
  const [existingStep, setExistingStep] = useState<ExistingRegistrationStep>('credentials')
  const [existingUsername, setExistingUsername] = useState('')
  const [existingPassword, setExistingPassword] = useState('')
  const [currentAngle, setCurrentAngle] = useState<CaptureAngle>('front')
  const [guidePreviewAngle, setGuidePreviewAngle] = useState<CaptureAngle>('front')
  const [angleCaptures, setAngleCaptures] = useState<Record<CaptureAngle, Blob | null>>({
    front: null,
    left: null,
    right: null,
  })

  const [newName, setNewName] = useState('')
  const [newLastName, setNewLastName] = useState('')
  const [newDni, setNewDni] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('')
  const [newType, setNewType] = useState<UserType>('TECHNICIAN')

  const { videoRef, stream, error: cameraError, start, stop } = useCamera()

  const [busy, setBusy] = useState(false)
  const [faceDetected, setFaceDetected] = useState(false)
  const [cameraMessage, setCameraMessage] = useState('Camara lista. Coloca tu rostro frente a la camara y registra.')
  const [alert, setAlert] = useState<{ variant: 'info' | 'success' | 'warning' | 'error'; message: string } | null>(
    null,
  )

  useEffect(() => {
    const shouldUseCamera = mode === 'NUEVO' || (mode === 'EXISTENTE' && existingStep === 'capture')

    if (!shouldUseCamera) {
      stop()
      setFaceDetected(false)
      setCameraMessage('Camara apagada.')
      return
    }

    if (stream) return

    ;(async () => {
      try {
        await start()
      } catch {
        // useCamera exposes the error message.
      }
    })()
  }, [existingStep, mode, start, stop, stream])

  useEffect(() => {
    if (mode !== 'EXISTENTE' || existingStep !== 'guide') return

    setGuidePreviewAngle('front')
    const timer = window.setInterval(() => {
      setGuidePreviewAngle((current) => {
        const currentIndex = ANGLE_CAPTURES.findIndex((angle) => angle.key === current)
        return ANGLE_CAPTURES[(currentIndex + 1) % ANGLE_CAPTURES.length].key
      })
    }, 2400)

    return () => window.clearInterval(timer)
  }, [existingStep, mode])

  useEffect(() => {
    if (!stream || busy) {
      setFaceDetected(false)
      return
    }

    let cancelled = false

    async function checkCurrentFrame() {
      if (cancelled || checkingFaceRef.current) return

      const video = videoRef.current
      if (!video || video.readyState < 2) return

      checkingFaceRef.current = true
      try {
        // Primero valida localmente que exista un rostro visible y estima su orientacion.
        const facePose = await detectVisibleFacePose(video)
        if (!facePose.visible) {
          if (!cancelled) {
            setFaceDetected(false)
            setCameraMessage('Coloca tu rostro frente a la camara.')
          }
          return
        }

        const poseMatches = existingStep === 'capture' && isExpectedPose(currentAngle, facePose.pose)
        const shouldCaptureFrame = existingStep !== 'capture' || poseMatches
        const photo = shouldCaptureFrame
          ? await captureVideoFrameBlob(video, {
              format: FACE_CAPTURE_FORMAT,
              quality: FACE_CAPTURE_QUALITY,
              enhanceLowLight: true,
            })
          : null
        const valid = existingStep === 'capture' ? poseMatches : photo ? await checkFaceDataPhoto(photo) : false
        if (!cancelled) {
          setFaceDetected(valid)
          const angleInstruction = ANGLE_CAPTURES.find((angle) => angle.key === currentAngle)?.instruction
          setCameraMessage(
            existingStep === 'capture' && angleInstruction
              ? valid
                ? getCaptureGuidanceMessage(currentAngle, facePose.pose)
                : angleInstruction
              : valid
                ? 'Rostro detectado. Ya puedes registrar.'
                : 'Coloca tu rostro frente a la camara.',
          )
          if (existingStep === 'capture' && valid && photo && !angleCaptures[currentAngle] && !autoCapturingRef.current) {
            void completeAutoAngleCapture(photo, currentAngle)
          }
        }
      } catch {
        if (!cancelled) {
          setFaceDetected(false)
          setCameraMessage('Coloca tu rostro frente a la camara.')
        }
      } finally {
        checkingFaceRef.current = false
      }
    }

    void checkCurrentFrame()
    const timer = window.setInterval(() => {
      void checkCurrentFrame()
    }, FACE_CHECK_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [angleCaptures, busy, currentAngle, existingStep, stream, videoRef])

  const capturedAnglesCount = ANGLE_CAPTURES.filter((angle) => angleCaptures[angle.key]).length
  const guidePreviewConfig = ANGLE_CAPTURES.find((angle) => angle.key === guidePreviewAngle) ?? ANGLE_CAPTURES[0]
  const autoCaptureProgress = Math.round((capturedAnglesCount / ANGLE_CAPTURES.length) * 100)
  const progressDegrees = Math.round((autoCaptureProgress / 100) * 360)

  function resetExistingRegistration() {
    setExistingStep('credentials')
    setExistingUsername('')
    setExistingPassword('')
    setCurrentAngle('front')
    setGuidePreviewAngle('front')
    setAngleCaptures({ front: null, left: null, right: null })
    stop()
  }

  function continueToGuide() {
    setAlert(null)
    if (!existingUsername.trim() || !existingPassword) {
      setAlert({ variant: 'warning', message: 'Ingresa usuario y contrasena para continuar.' })
      return
    }
    setExistingStep('guide')
  }

  function beginAngleCapture() {
    setAlert(null)
    setExistingStep('capture')
    setCurrentAngle('front')
    setAngleCaptures({ front: null, left: null, right: null })
    autoCapturingRef.current = false
    setCameraMessage('Activando camara...')
  }

  function cancelAutoCapture() {
    autoCapturingRef.current = false
    setAngleCaptures({ front: null, left: null, right: null })
    setCurrentAngle('front')
    setExistingStep('guide')
    stop()
  }

  async function completeAutoAngleCapture(photo: Blob, angle: CaptureAngle) {
    autoCapturingRef.current = true
    setAlert(null)
    setCameraMessage(`Capturando ${ANGLE_CAPTURES.find((item) => item.key === angle)?.label.toLowerCase() ?? 'rostro'}...`)

    const nextCaptures = { ...angleCaptures, [angle]: photo }
    setAngleCaptures(nextCaptures)

    const currentIndex = ANGLE_CAPTURES.findIndex((item) => item.key === angle)
    const nextAngle = ANGLE_CAPTURES[currentIndex + 1]

    if (nextAngle) {
      window.setTimeout(() => {
        setCurrentAngle(nextAngle.key)
        setCameraMessage(nextAngle.instruction)
        autoCapturingRef.current = false
      }, 650)
      return
    }

    try {
      await registerExistingMultiAngleFace(nextCaptures)
    } finally {
      autoCapturingRef.current = false
    }
  }

  async function registerExistingMultiAngleFace(captures: Record<CaptureAngle, Blob | null> = angleCaptures) {
    setAlert(null)
    if (!existingUsername.trim() || !existingPassword) {
      setAlert({ variant: 'warning', message: 'Ingresa usuario y contrasena para registrar.' })
      return
    }
    if (!captures.front || !captures.left || !captures.right) {
      setAlert({ variant: 'warning', message: 'Completa las capturas frontal, izquierda y derecha.' })
      return
    }

    setBusy(true)
    setCameraMessage('Registrando rostro en tres angulos...')
    try {
      await registerMultiAngleFaceForExistingUser(existingUsername.trim(), existingPassword, {
        front: captures.front,
        left: captures.left,
        right: captures.right,
      })
      setAlert({ variant: 'success', message: 'Rostro registrado correctamente en tres angulos.' })
      setCameraMessage('Rostro registrado correctamente.')
      resetExistingRegistration()
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'No se pudo registrar rostro.'
      const message = normalizeFaceRegistrationError(reason)
      setAlert({ variant: message === reason ? 'error' : 'warning', message })
      setCameraMessage('No se pudo completar el registro facial.')
    } finally {
      setBusy(false)
    }
  }

  async function createAndRegister() {
    setAlert(null)

    if (!newName.trim() || !newUsername.trim() || !newPassword.trim() || !newEmail.trim() || !newPhone.trim()) {
      setAlert({ variant: 'warning', message: 'Completa nombre, telefono, correo, usuario y contrasena.' })
      return
    }
    if (!stream) {
      setAlert({ variant: 'error', message: 'La camara no esta activa. Revisa permisos.' })
      return
    }
    if (!faceDetected) {
      setAlert({ variant: 'warning', message: 'Primero ubica un rostro claro frente a la camara.' })
      return
    }

    setBusy(true)
    setCameraMessage('Capturando rostro y creando registro...')
    try {
      const video = videoRef.current
      if (!video || video.readyState < 2) throw new Error('video_not_ready')

      const photo = await captureVideoFrameBlob(video, {
        format: FACE_CAPTURE_FORMAT,
        quality: FACE_CAPTURE_QUALITY,
        enhanceLowLight: true,
      })
      const created = await createUserAndRegisterFace(
        {
          name: newName.trim(),
          lastName: newLastName.trim() || undefined,
          dni: newDni.trim() || undefined,
          email: newEmail.trim() || undefined,
          phone: newPhone.trim() || undefined,
          username: newUsername.trim(),
          password: newPassword,
          passwordConfirmation: newPasswordConfirmation,
          type: newType,
          verified: true,
        },
        photo,
      )

      setCameraMessage('Rostro registrado correctamente.')
      setAlert({ variant: 'success', message: `Usuario creado y rostro registrado: ${created.username ?? created.id}` })
      setNewName('')
      setNewLastName('')
      setNewDni('')
      setNewEmail('')
      setNewPhone('')
      setNewUsername('')
      setNewPassword('')
      setNewPasswordConfirmation('')
      setNewType('TECHNICIAN')
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'No se pudo crear o registrar.'
      const captureMessage = normalizeFaceRegistrationError(reason)
      const isValidation = /nombre|apellido|usuario|contrasena|DNI|correo|telefono|coinciden/i.test(reason)
      const isCaptureValidation = captureMessage !== reason
      if (isCaptureValidation) {
        setCameraMessage('No se pudo validar el rostro. Ajusta posicion y vuelve a intentar.')
      }
      setAlert({ variant: isValidation || isCaptureValidation ? 'warning' : 'error', message: captureMessage })
    } finally {
      setBusy(false)
    }
  }

  const showGuideCameraPanel = mode === 'EXISTENTE' && existingStep === 'guide'
  const showLiveCameraPanel = mode === 'NUEVO' || (mode === 'EXISTENTE' && existingStep === 'capture')
  const guideFaceTransform =
    guidePreviewAngle === 'front'
      ? 'translateX(0) rotateY(0deg)'
      : guidePreviewAngle === 'left'
        ? 'translateX(-24px) rotateY(-36deg)'
        : 'translateX(24px) rotateY(36deg)'
  const guideArrowText =
    guidePreviewAngle === 'front' ? 'Mira al frente' : guidePreviewAngle === 'left' ? 'Gira a tu izquierda' : 'Gira a tu derecha'
  const captureActionText =
    currentAngle === 'front' ? 'Mira al frente' : currentAngle === 'left' ? 'Gira a tu izquierda' : 'Gira a tu derecha'

  return (
    <div className="space-y-6">
      <style>
        {`
          @keyframes registrationScan {
            0% { top: 18%; opacity: 0.38; }
            100% { top: 82%; opacity: 0.86; }
          }
          @keyframes faceGuideArrow {
            0%, 100% { transform: translateX(0); opacity: 0.45; }
            50% { transform: translateX(12px); opacity: 1; }
          }
        `}
      </style>

      <div>
        <h2 className="text-xl font-bold text-slate-900">Registro de colaboradores</h2>
        <p className="mt-1 text-sm text-slate-600">Selecciona usuario existente o crea uno nuevo.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['EXISTENTE', 'NUEVO'] as Mode[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setMode(item)}
            className={[
              'rounded-full px-4 py-2 text-sm font-semibold',
              mode === item ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
            ].join(' ')}
          >
            {item === 'EXISTENTE' ? 'Existente' : 'Nuevo'}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-5">
          <div className="text-[11px] font-bold tracking-widest text-brand-blue/80">VALIDACION BIOMETRICA</div>
          <div className="relative mt-3 aspect-[4/3] overflow-hidden rounded-xl bg-slate-950 ring-1 ring-black/10">
            {showLiveCameraPanel && (
              <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
            )}

            {showGuideCameraPanel && (
              <div className="absolute inset-0 bg-white">
                <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
                  <div className="relative flex h-[72%] w-[72%] max-w-[320px] items-center justify-center">
                    <div className="absolute left-0 top-0 h-12 w-12 rounded-tl-2xl border-l-[6px] border-t-[6px] border-brand-blue" />
                    <div className="absolute right-0 top-0 h-12 w-12 rounded-tr-2xl border-r-[6px] border-t-[6px] border-brand-blue" />
                    <div className="absolute bottom-0 left-0 h-12 w-12 rounded-bl-2xl border-b-[6px] border-l-[6px] border-brand-blue" />
                    <div className="absolute bottom-0 right-0 h-12 w-12 rounded-br-2xl border-b-[6px] border-r-[6px] border-brand-blue" />

                    <div className="relative h-full w-full [perspective:900px]">
                      <img
                        src="/face-registration-guide.png"
                        alt=""
                        className="mx-auto h-full w-full object-contain transition-transform duration-500"
                        style={{ transform: guideFaceTransform }}
                      />
                    </div>
                  </div>

                  <div className="absolute bottom-4 left-4 right-4 rounded-lg bg-slate-950/80 px-3 py-3 text-white shadow-lg">
                    <div className="text-sm font-black">{guideArrowText}</div>
                    <div className="mt-1 text-xs text-white/80">{guidePreviewConfig.instruction}</div>
                    {guidePreviewAngle !== 'front' && (
                      <div
                        className={['mx-auto mt-2 h-1.5 w-14 rounded-full bg-white', guidePreviewAngle === 'left' ? '-scale-x-100' : ''].join(' ')}
                        style={{ animation: 'faceGuideArrow 1.1s ease-in-out infinite' }}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {!showGuideCameraPanel && !showLiveCameraPanel && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-sm font-semibold text-white/80">
                Camara apagada
              </div>
            )}

            {showLiveCameraPanel && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
                <div className={['relative h-[72%] w-[56%] rounded-[2rem] border shadow-[0_0_24px_rgba(56,189,248,0.18)]', faceDetected ? 'border-emerald-300/75' : 'border-sky-300/55'].join(' ')}>
                  <div
                    className={['absolute left-4 right-4 top-1/2 h-px shadow-[0_0_14px_rgba(125,211,252,0.45)]', faceDetected ? 'bg-emerald-200/85' : 'bg-sky-200/80'].join(' ')}
                    style={{ animation: 'registrationScan 1.8s ease-in-out infinite alternate' }}
                  />
                  <div className="absolute left-3 top-3 h-8 w-8 rounded-tl-2xl border-l-2 border-t-2 border-sky-200/80" />
                  <div className="absolute right-3 top-3 h-8 w-8 rounded-tr-2xl border-r-2 border-t-2 border-sky-200/80" />
                  <div className="absolute bottom-3 left-3 h-8 w-8 rounded-bl-2xl border-b-2 border-l-2 border-sky-200/80" />
                  <div className="absolute bottom-3 right-3 h-8 w-8 rounded-br-2xl border-b-2 border-r-2 border-sky-200/80" />
                </div>
              </div>
            )}

            {busy && (
              <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-slate-950/70 px-3 py-2 text-center text-xs font-semibold text-white backdrop-blur-sm">
                Validando rostro...
              </div>
            )}
          </div>

          <div className="mt-3">
            {cameraError ? (
              <Alert variant="error" message={cameraError} />
            ) : showGuideCameraPanel ? (
              <Alert variant="info" message={existingStep === 'guide' ? 'Guia visual. La camara sigue apagada.' : 'Camara apagada. Ingresa credenciales para continuar.'} />
            ) : stream ? (
              <Alert variant="info" message={cameraMessage} />
            ) : (
              <Alert variant="info" message={showLiveCameraPanel ? 'Activando camara...' : 'Camara apagada.'} />
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-7">
          {mode === 'EXISTENTE' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold tracking-widest text-brand-blue/80">USUARIO EXISTENTE</div>
                  <h3 className="mt-1 text-lg font-bold text-slate-950">Registro facial guiado</h3>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {capturedAnglesCount}/3 capturas
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                {(['credentials', 'guide', 'capture'] as ExistingRegistrationStep[]).map((step, index) => (
                  <div
                    key={step}
                    className={[
                      'rounded-lg border px-3 py-2 text-xs font-semibold',
                      existingStep === step
                        ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                        : 'border-slate-200 bg-slate-50 text-slate-500',
                    ].join(' ')}
                  >
                    {index + 1}. {step === 'credentials' ? 'Identidad' : step === 'guide' ? 'Guia' : 'Capturas'}
                  </div>
                ))}
              </div>

              {existingStep === 'credentials' && (
                <div className="space-y-4">
                  <p className="text-sm leading-6 text-slate-600">
                    Ingresa el usuario y contrasena del colaborador antes de iniciar el registro facial.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-medium">Usuario</span>
                      <input
                        value={existingUsername}
                        onChange={(event) => setExistingUsername(event.target.value)}
                        className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-blue/20"
                        autoComplete="username"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium">Contrasena</span>
                      <input
                        value={existingPassword}
                        onChange={(event) => setExistingPassword(event.target.value)}
                        className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-blue/20"
                        type="password"
                        autoComplete="current-password"
                      />
                    </label>
                  </div>
                  <LoadingButton type="button" onClick={continueToGuide} className="w-full">
                    Continuar
                  </LoadingButton>
                </div>
              )}

              {existingStep === 'guide' && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <LoadingButton type="button" variant="dark" onClick={() => setExistingStep('credentials')}>
                      Volver
                    </LoadingButton>
                    <LoadingButton type="button" onClick={beginAngleCapture}>
                      Iniciar registro
                    </LoadingButton>
                  </div>
                </div>
              )}

              {existingStep === 'capture' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex flex-col items-center gap-4 text-center">
                      <div
                        className="flex h-28 w-28 items-center justify-center rounded-full"
                        style={{
                          background: `conic-gradient(#0f3d73 ${progressDegrees}deg, #e2e8f0 ${progressDegrees}deg)`,
                        }}
                      >
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-xl font-black text-brand-blue">
                          {autoCaptureProgress}%
                        </div>
                      </div>

                      <div>
                        <div className="text-base font-bold text-slate-950">{captureActionText}</div>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{cameraMessage}</p>
                      </div>

                      <div className="flex w-full flex-wrap justify-center gap-2">
                        {ANGLE_CAPTURES.map((angle) => (
                          <span
                            key={angle.key}
                            className={[
                              'rounded-full px-3 py-1 text-xs font-semibold',
                              angleCaptures[angle.key]
                                ? 'bg-emerald-100 text-emerald-700'
                                : currentAngle === angle.key
                                  ? 'bg-brand-blue/10 text-brand-blue'
                                  : 'bg-slate-200 text-slate-500',
                            ].join(' ')}
                          >
                            {angleCaptures[angle.key] ? 'Listo ' : ''}{angle.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <LoadingButton type="button" variant="dark" onClick={cancelAutoCapture} disabled={busy}>
                      Cancelar
                    </LoadingButton>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <form className="space-y-4" autoComplete="off" onSubmit={(event) => event.preventDefault()}>
              <input className="hidden" type="text" name="username" autoComplete="username" tabIndex={-1} aria-hidden="true" />
              <input className="hidden" type="password" name="password" autoComplete="current-password" tabIndex={-1} aria-hidden="true" />
              <div className="text-[11px] font-bold tracking-widest text-brand-orange/80">USUARIO NUEVO</div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium">Nombre</span>
                  <input value={newName} onChange={(event) => setNewName(sanitizePersonName(event.target.value))} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange/20" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Apellido</span>
                  <input value={newLastName} onChange={(event) => setNewLastName(sanitizePersonName(event.target.value))} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange/20" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">DNI</span>
                  <input value={newDni} inputMode="numeric" onChange={(event) => setNewDni(event.target.value.replace(/\D/g, ''))} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange/20" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Telefono</span>
                  <input value={newPhone} inputMode="numeric" maxLength={9} onChange={(event) => setNewPhone(sanitizePhone(event.target.value))} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange/20" />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-sm font-medium">Correo</span>
                  <input name={`email-${newUserFormKey}`} autoComplete="off" type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange/20" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Usuario</span>
                  <input name={`collaborator-user-${newUserFormKey}`} autoComplete="new-password" value={newUsername} onChange={(event) => setNewUsername(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange/20" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Rol</span>
                  <select value={newType} onChange={(event) => setNewType(event.target.value as UserType)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange/20">
                    {userRoleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Contrasena</span>
                  <input name={`collaborator-pass-${newUserFormKey}`} autoComplete="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange/20" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium">Confirmar contrasena</span>
                  <input name={`collaborator-pass-confirm-${newUserFormKey}`} autoComplete="new-password" type="password" value={newPasswordConfirmation} onChange={(event) => setNewPasswordConfirmation(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-orange/20" />
                </label>
              </div>

              <LoadingButton
                type="button"
                variant="secondary"
                loading={busy}
                loadingText="Procesando..."
                disabled={!faceDetected}
                onClick={() => void createAndRegister()}
                className="w-full"
              >
                {faceDetected ? 'Crear usuario + registrar rostro' : 'Esperando rostro'}
              </LoadingButton>
            </form>
          )}
        </section>
      </div>

      {alert && (
        <ModalAlert
          variant={alert.variant}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}
    </div>
  )
}
