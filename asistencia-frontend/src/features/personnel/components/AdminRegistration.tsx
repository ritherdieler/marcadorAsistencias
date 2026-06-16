import { useEffect, useMemo, useRef, useState } from 'react'

import { Alert } from '../../../components/ui/Alert'
import { LoadingButton } from '../../../components/ui/LoadingButton'
import { ModalAlert } from '../../../components/ui/ModalAlert'
import { useCamera } from '../../../hooks/useCamera'
import { getAllUsers } from '../../../services/userService'
import type { User, UserType } from '../../../types/user'
import { formatUserRole, userRoleOptions } from '../../../utils/userRole'
import { sanitizePersonName, sanitizePhone } from '../../../utils/validators'
import { captureVideoFrameBlob } from '../../recognition/services/cameraEvidence'
import { hasVisibleFace } from '../../recognition/services/facePresenceDetector'
import { createUserAndRegisterFace, registerFaceForExistingUser } from '../services/registrationService'
import { checkFaceDataPhoto } from '../../../services/recognitionService'

type Mode = 'EXISTENTE' | 'NUEVO'

const FACE_CHECK_INTERVAL_MS = 1300
const FACE_CAPTURE_FORMAT = 'jpeg'

function fullName(user: User): string {
  return `${user.name ?? ''} ${user.lastName ?? ''}`.trim() || user.username || `ID ${user.id}`
}

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

export function AdminRegistration() {
  const newUserFormKey = useMemo(() => `new-user-${Date.now()}`, [])
  const checkingFaceRef = useRef(false)
  const [mode, setMode] = useState<Mode>('EXISTENTE')
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  const [newName, setNewName] = useState('')
  const [newLastName, setNewLastName] = useState('')
  const [newDni, setNewDni] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('')
  const [newType, setNewType] = useState<UserType>('TECHNICIAN')

  const { videoRef, stream, error: cameraError, start } = useCamera()

  const [busy, setBusy] = useState(false)
  const [faceDetected, setFaceDetected] = useState(false)
  const [cameraMessage, setCameraMessage] = useState('Camara lista. Coloca tu rostro frente a la camara y registra.')
  const [alert, setAlert] = useState<{ variant: 'info' | 'success' | 'warning' | 'error'; message: string } | null>(
    null,
  )

  useEffect(() => {
    ;(async () => {
      try {
        setUsers(await getAllUsers())
      } catch {
        setAlert({ variant: 'error', message: 'No se pudo listar usuarios. Revisa el backend.' })
      }
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        await start()
      } catch {
        // useCamera exposes the error message.
      }
    })()
  }, [start])

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
        // Primero valida localmente que exista un rostro visible para no saturar el backend con fondos o frames vacios.
        const hasLocalFace = await hasVisibleFace(video)
        if (!hasLocalFace) {
          if (!cancelled) {
            setFaceDetected(false)
            setCameraMessage('Coloca tu rostro frente a la camara.')
          }
          return
        }

        const photo = await captureVideoFrameBlob(video, {
          format: FACE_CAPTURE_FORMAT,
          quality: 0.95,
          enhanceLowLight: true,
        })
        const valid = await checkFaceDataPhoto(photo)
        if (!cancelled) {
          setFaceDetected(valid)
          setCameraMessage(
            valid
              ? 'Rostro detectado. Ya puedes registrar.'
              : 'Coloca tu rostro frente a la camara.',
          )
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
  }, [busy, stream, videoRef])

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return users

    return users.filter((user) => {
      return [fullName(user), user.username, user.dni]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })
  }, [search, users])

  async function registerExistingFace() {
    setAlert(null)

    if (!selectedUser?.id) {
      setAlert({ variant: 'warning', message: 'Selecciona un usuario existente primero.' })
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
    setCameraMessage('Capturando rostro y validando con el backend...')
    try {
      const video = videoRef.current
      if (!video || video.readyState < 2) throw new Error('video_not_ready')

      const photo = await captureVideoFrameBlob(video, {
        format: FACE_CAPTURE_FORMAT,
        quality: 0.95,
        enhanceLowLight: true,
      })
      await registerFaceForExistingUser(selectedUser.id, photo)
      setCameraMessage('Rostro registrado correctamente.')
      setAlert({ variant: 'success', message: `Rostro registrado para: ${fullName(selectedUser)}` })
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'No se pudo registrar rostro.'
      const message = normalizeFaceRegistrationError(reason)
      setCameraMessage('No se pudo validar el rostro. Ajusta posicion y vuelve a intentar.')
      setAlert({
        variant: message === reason ? 'error' : 'warning',
        message,
      })
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
        quality: 0.95,
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

  return (
    <div className="space-y-6">
      <style>
        {`
          @keyframes registrationScan {
            0% { top: 18%; opacity: 0.38; }
            100% { top: 82%; opacity: 0.86; }
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
          <div className="relative mt-3 overflow-hidden rounded-xl bg-black ring-1 ring-black/10">
            <video ref={videoRef} className="aspect-[4/3] w-full object-cover" playsInline muted autoPlay />
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
            {busy && (
              <div className="absolute bottom-3 left-3 right-3 rounded-lg bg-slate-950/70 px-3 py-2 text-center text-xs font-semibold text-white backdrop-blur-sm">
                Validando rostro...
              </div>
            )}
          </div>

          <div className="mt-3">
            {cameraError ? (
              <Alert variant="error" message={cameraError} />
            ) : stream ? (
              <Alert variant="info" message={cameraMessage} />
            ) : (
              <Alert variant="info" message="Activando camara..." />
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-7">
          {mode === 'EXISTENTE' ? (
            <div className="space-y-4">
              <div className="text-[11px] font-bold tracking-widest text-brand-blue/80">USUARIO EXISTENTE</div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nombre, usuario o DNI"
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-blue/20"
              />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="max-h-64 overflow-auto rounded-xl border border-slate-200">
                  {filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setSelectedUser(user)}
                      className={[
                        'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50',
                        selectedUser?.id === user.id ? 'bg-slate-100' : '',
                      ].join(' ')}
                    >
                      <span className="font-medium">{fullName(user)}</span>
                      <span className="text-xs text-slate-500">{formatUserRole(user.type)}</span>
                    </button>
                  ))}
                  {filteredUsers.length === 0 && <div className="px-3 py-3 text-sm text-slate-500">Sin resultados</div>}
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  {selectedUser ? (
                    <div className="space-y-1">
                      <div><span className="font-semibold">ID:</span> {selectedUser.id}</div>
                      <div><span className="font-semibold">Nombre:</span> {fullName(selectedUser)}</div>
                      <div><span className="font-semibold">Usuario:</span> {selectedUser.username ?? '-'}</div>
                      <div><span className="font-semibold">DNI:</span> {selectedUser.dni ?? '-'}</div>
                      <div><span className="font-semibold">Correo:</span> {selectedUser.email ?? '-'}</div>
                      <div><span className="font-semibold">Telefono:</span> {selectedUser.phone ?? '-'}</div>
                      <div><span className="font-semibold">Rol:</span> {formatUserRole(selectedUser.type)}</div>
                    </div>
                  ) : (
                    <div className="text-slate-600">Selecciona un usuario para ver sus datos.</div>
                  )}
                </div>
              </div>

              <LoadingButton
                type="button"
                loading={busy}
                loadingText="Registrando..."
                disabled={!faceDetected}
                onClick={() => void registerExistingFace()}
                className="w-full"
              >
                {faceDetected ? 'Registrar rostro' : 'Esperando rostro'}
              </LoadingButton>
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
