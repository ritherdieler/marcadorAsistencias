import { useEffect, useMemo, useState } from 'react'

import { LoadingButton } from '../../../components/ui/LoadingButton'
import { ModalAlert } from '../../../components/ui/ModalAlert'
import type { UserType } from '../../../types/user'
import { userRoleOptions } from '../../../utils/userRole'
import {
  sanitizePersonName,
  sanitizePhone,
  validateDniOptional,
  validateEmailRequired,
  validatePassword,
  validatePasswordConfirmation,
  validatePersonLastNameOptional,
  validatePersonName,
  validatePhoneRequired,
  validateUsername,
} from '../../../utils/validators'
import {
  createUserAndRegisterMultiAngleFace,
  registerMultiAngleFaceForExistingUser,
} from '../services/registrationService'
import { ENROLLMENT_ANGLES, useFaceEnrollment, type CaptureAngle } from '../hooks/useFaceEnrollment'
import { CameraStage } from './registration/CameraStage'
import { CapturedThumbnails } from './registration/CapturedThumbnails'
import { CaptureProgressRing } from './registration/CaptureProgressRing'
import { EnrollmentSteps, type EnrollmentStep } from './registration/EnrollmentSteps'
import { EnrollmentTips } from './registration/EnrollmentTips'
import { ModeTabs, type RegistrationMode } from './registration/ModeTabs'
import { PasswordField } from './registration/PasswordField'

type Step = 'data' | 'guide' | 'capture' | 'review'

type AlertState = {
  variant: 'info' | 'success' | 'warning' | 'error'
  message: string
}

const EXISTING_STEPS: EnrollmentStep[] = [
  { key: 'data', label: 'Identidad' },
  { key: 'guide', label: 'Guia' },
  { key: 'capture', label: 'Captura' },
  { key: 'review', label: 'Revision' },
]

const NEW_STEPS: EnrollmentStep[] = [
  { key: 'data', label: 'Datos' },
  { key: 'guide', label: 'Guia' },
  { key: 'capture', label: 'Captura' },
  { key: 'review', label: 'Revision' },
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

function captureActionText(angle: CaptureAngle): string {
  if (angle === 'front') return 'Mira al frente'
  if (angle === 'left') return 'Gira a tu izquierda'
  return 'Gira a tu derecha'
}

function CheckBadge() {
  return (
    <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-600">
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

export function AdminRegistration() {
  const newUserFormKey = useMemo(() => `new-user-${Date.now()}`, [])

  const [mode, setMode] = useState<RegistrationMode>('EXISTENTE')
  const [step, setStep] = useState<Step>('data')
  const [busy, setBusy] = useState(false)
  const [alert, setAlert] = useState<AlertState | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [existingUsername, setExistingUsername] = useState('')
  const [existingPassword, setExistingPassword] = useState('')

  const [newName, setNewName] = useState('')
  const [newLastName, setNewLastName] = useState('')
  const [newDni, setNewDni] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('')
  const [newType, setNewType] = useState<UserType>('TECHNICIAN')

  const enroll = useFaceEnrollment({
    active: step === 'guide' || step === 'capture',
    autoCapture: step === 'capture',
  })

  useEffect(() => {
    if (step === 'capture' && enroll.isComplete) {
      setStep('review')
    }
  }, [step, enroll.isComplete])

  const steps = mode === 'EXISTENTE' ? EXISTING_STEPS : NEW_STEPS
  const progress = Math.round((enroll.capturedCount / ENROLLMENT_ANGLES.length) * 100)

  const resetAll = () => {
    enroll.reset()
    setStep('data')
    setAlert(null)
  }

  const changeMode = (nextMode: RegistrationMode) => {
    if (nextMode === mode) return
    setMode(nextMode)
    setSuccess(null)
    resetAll()
  }

  const clearNewUserForm = () => {
    setNewName('')
    setNewLastName('')
    setNewDni('')
    setNewEmail('')
    setNewPhone('')
    setNewUsername('')
    setNewPassword('')
    setNewPasswordConfirmation('')
    setNewType('TECHNICIAN')
  }

  const validateNewUserForm = (): string | null =>
    validatePersonName(newName, 'Nombre') ??
    validatePersonLastNameOptional(newLastName) ??
    validateUsername(newUsername) ??
    validatePassword(newPassword) ??
    validatePasswordConfirmation(newPassword, newPasswordConfirmation) ??
    validateDniOptional(newDni) ??
    validateEmailRequired(newEmail) ??
    validatePhoneRequired(newPhone)

  const continueToGuide = () => {
    setAlert(null)
    if (mode === 'EXISTENTE') {
      if (!existingUsername.trim() || !existingPassword) {
        setAlert({ variant: 'warning', message: 'Ingresa usuario y contrasena para continuar.' })
        return
      }
    } else {
      const error = validateNewUserForm()
      if (error) {
        setAlert({ variant: 'warning', message: error })
        return
      }
    }
    setStep('guide')
  }

  const beginCapture = () => {
    setAlert(null)
    enroll.reset()
    setStep('capture')
  }

  const cancelCapture = () => {
    enroll.reset()
    setStep('guide')
  }

  const recaptureAngle = (angle: CaptureAngle) => {
    enroll.recapture(angle)
    setStep('capture')
  }

  const restartCaptures = () => {
    enroll.reset()
    setStep('capture')
  }

  const finishSuccess = (message: string) => {
    enroll.reset()
    setStep('data')
    setSuccess(message)
    if (mode === 'EXISTENTE') {
      setExistingUsername('')
      setExistingPassword('')
    } else {
      clearNewUserForm()
    }
  }

  const handleRegister = async () => {
    setAlert(null)
    const blobs = enroll.collectBlobs()
    if (!blobs) {
      setAlert({ variant: 'warning', message: 'Completa las capturas frontal, izquierda y derecha.' })
      return
    }

    setBusy(true)
    try {
      if (mode === 'EXISTENTE') {
        await registerMultiAngleFaceForExistingUser(existingUsername.trim(), existingPassword, blobs)
        finishSuccess('Rostro registrado correctamente en tres angulos.')
      } else {
        const created = await createUserAndRegisterMultiAngleFace(
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
          blobs,
        )
        finishSuccess(`Usuario creado y rostro registrado: ${created.username ?? created.id}`)
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'No se pudo completar el registro facial.'
      const message = normalizeFaceRegistrationError(reason)
      setAlert({ variant: message === reason ? 'error' : 'warning', message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Registro de colaboradores</h2>
        <p className="mt-1 text-sm text-slate-600">Selecciona un usuario existente o crea uno nuevo y registra su rostro.</p>
      </div>

      {success ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-8 text-center">
          <CheckBadge />
          <div>
            <h3 className="text-lg font-bold text-slate-950">Registro completado</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{success}</p>
          </div>
          <LoadingButton type="button" onClick={() => setSuccess(null)} className="w-full sm:w-auto">
            Registrar otro
          </LoadingButton>
        </div>
      ) : (
        <>
          <ModeTabs mode={mode} onChange={changeMode} />
          <EnrollmentSteps steps={steps} currentKey={step} />

          <div className="grid gap-6 lg:grid-cols-12">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-5">
              {step === 'data' && (
                <div className="space-y-4">
                  <div className="text-[11px] font-bold tracking-widest text-brand-blue/80">VALIDACION BIOMETRICA</div>
                  <div className="flex aspect-video items-center justify-center rounded-xl bg-slate-950 px-6 text-center text-sm font-semibold text-white/80 ring-1 ring-black/10">
                    La camara se activara al iniciar la captura.
                  </div>
                  <EnrollmentTips />
                </div>
              )}

              {(step === 'guide' || step === 'capture') && (
                <CameraStage
                  videoRef={enroll.videoRef}
                  active
                  mirror
                  faceBox={enroll.faceBox}
                  alignment={enroll.alignment}
                  countdown={enroll.countdown}
                  capturing={enroll.capturing}
                  statusMessage={enroll.statusMessage}
                  cameraError={enroll.cameraError}
                  permissionDenied={enroll.permissionDenied}
                  onRetry={enroll.retryCamera}
                  devices={enroll.devices}
                  deviceId={enroll.deviceId}
                  onSelectDevice={enroll.selectDevice}
                />
              )}

              {step === 'review' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <CheckBadge />
                    <div>
                      <h3 className="text-base font-bold text-slate-950">Capturas completas</h3>
                      <p className="text-sm text-slate-600">Revisa cada angulo y recaptura si es necesario.</p>
                    </div>
                  </div>
                  <CapturedThumbnails
                    captures={enroll.captures}
                    currentAngle={enroll.currentAngle}
                    onRecapture={recaptureAngle}
                    disabled={busy}
                  />
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-7">
              {step === 'data' && mode === 'EXISTENTE' && (
                <div className="space-y-4">
                  <div className="text-[11px] font-bold tracking-widest text-brand-blue/80">USUARIO EXISTENTE</div>
                  <h3 className="text-lg font-bold text-slate-950">Registro facial guiado</h3>
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
                    <PasswordField
                      label="Contrasena"
                      value={existingPassword}
                      onChange={setExistingPassword}
                      autoComplete="current-password"
                    />
                  </div>
                  <LoadingButton type="button" onClick={continueToGuide} className="w-full">
                    Continuar
                  </LoadingButton>
                </div>
              )}

              {step === 'data' && mode === 'NUEVO' && (
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
                    <PasswordField label="Contrasena" value={newPassword} onChange={setNewPassword} name={`collaborator-pass-${newUserFormKey}`} autoComplete="new-password" accent="orange" />
                    <PasswordField label="Confirmar contrasena" value={newPasswordConfirmation} onChange={setNewPasswordConfirmation} name={`collaborator-pass-confirm-${newUserFormKey}`} autoComplete="new-password" accent="orange" />
                  </div>

                  <LoadingButton type="button" variant="secondary" onClick={continueToGuide} className="w-full">
                    Continuar
                  </LoadingButton>
                </form>
              )}

              {step === 'guide' && (
                <div className="space-y-4">
                  <div className="text-[11px] font-bold tracking-widest text-brand-blue/80">PASO PREVIO</div>
                  <h3 className="text-lg font-bold text-slate-950">Vas a capturar 3 angulos</h3>
                  <p className="text-sm leading-6 text-slate-600">
                    Ubicate frente a la camara. La captura es automatica cuando el rostro esta bien posicionado.
                  </p>
                  <ul className="grid gap-2 sm:grid-cols-3">
                    {ENROLLMENT_ANGLES.map((angle) => (
                      <li key={angle.key} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                        {angle.label}
                      </li>
                    ))}
                  </ul>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <LoadingButton type="button" variant="dark" onClick={() => setStep('data')}>
                      Volver
                    </LoadingButton>
                    <LoadingButton type="button" onClick={beginCapture}>
                      Iniciar registro
                    </LoadingButton>
                  </div>
                </div>
              )}

              {step === 'capture' && (
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
                    <CaptureProgressRing value={progress} />
                    <div>
                      <div className="text-base font-bold text-slate-950">{captureActionText(enroll.currentAngle)}</div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{enroll.statusMessage}</p>
                    </div>
                    <CapturedThumbnails
                      captures={enroll.captures}
                      currentAngle={enroll.currentAngle}
                      onRecapture={recaptureAngle}
                      disabled={busy}
                      showRecapture={false}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <LoadingButton type="button" variant="dark" onClick={cancelCapture} disabled={busy}>
                      Cancelar
                    </LoadingButton>
                    <LoadingButton type="button" onClick={enroll.manualCapture} disabled={!enroll.canManualCapture}>
                      Capturar ahora
                    </LoadingButton>
                  </div>
                </div>
              )}

              {step === 'review' && (
                <div className="space-y-4">
                  <div className="text-[11px] font-bold tracking-widest text-brand-blue/80">CONFIRMAR REGISTRO</div>
                  <h3 className="text-lg font-bold text-slate-950">Todo listo para registrar</h3>
                  <p className="text-sm leading-6 text-slate-600">
                    {mode === 'EXISTENTE'
                      ? 'Se registrara el rostro del colaborador en tres angulos.'
                      : 'Se creara el usuario y se registrara su rostro en tres angulos.'}
                  </p>

                  <LoadingButton
                    type="button"
                    variant={mode === 'EXISTENTE' ? 'primary' : 'secondary'}
                    loading={busy}
                    loadingText="Registrando..."
                    onClick={() => void handleRegister()}
                    className="w-full"
                  >
                    {mode === 'EXISTENTE' ? 'Registrar rostro' : 'Crear usuario + registrar rostro'}
                  </LoadingButton>
                  <LoadingButton type="button" variant="dark" onClick={restartCaptures} disabled={busy} className="w-full">
                    Reiniciar capturas
                  </LoadingButton>
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {alert && <ModalAlert variant={alert.variant} message={alert.message} onClose={() => setAlert(null)} />}
    </div>
  )
}
