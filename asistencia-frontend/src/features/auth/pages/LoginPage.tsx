import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { LoadingButton } from '../../../components/ui/LoadingButton'
import { ModalAlert } from '../../../components/ui/ModalAlert'
import { login } from '../../../services/authService'
import { isAdminUser } from '../../../utils/userRole'
import { validateUsername } from '../../../utils/validators'
import { getAuthUser, setAuthUser } from '../utils/authStorage'

export function LoginPage() {
  const navigate = useNavigate()
  const formKey = useMemo(() => `login-${Date.now()}`, [])

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [inputsReady, setInputsReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState<{ variant: 'info' | 'success' | 'warning' | 'error'; message: string } | null>(
    null,
  )

  useEffect(() => {
    setUsername('')
    setPassword('')
    const timeout = window.setTimeout(() => {
      setUsername('')
      setPassword('')
      setInputsReady(true)
    }, 150)
    return () => window.clearTimeout(timeout)
  }, [])

  useEffect(() => {
    const user = getAuthUser()
    if (isAdminUser(user)) navigate('/admin', { replace: true })
  }, [navigate])

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setAlert(null)

    try {
      const cleanUsername = username.trim()
      const usernameError = validateUsername(username)
      if (usernameError) {
        setAlert({ variant: 'warning', message: usernameError })
        return
      }

      if (!password.trim()) {
        setAlert({ variant: 'warning', message: 'La contrasena es obligatoria.' })
        return
      }

      const user = await login({ username: cleanUsername, password })
      if (!isAdminUser(user)) {
        setAlert({ variant: 'error', message: 'Acceso denegado: el usuario no tiene rol ADMIN.' })
        return
      }

      setAuthUser({ ...user, type: 'ADMIN' })
      setUsername('')
      setPassword('')
      navigate('/admin', { replace: true })
    } catch {
      setAlert({ variant: 'error', message: 'No se pudo iniciar sesion. Verifica usuario y contrasena.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-center text-2xl font-bold text-slate-900">Acceso al Sistema</h1>
      <p className="mt-2 text-center text-sm text-slate-600">Ingresa con tu usuario administrador.</p>

      <form key={formKey} onSubmit={onSubmit} autoComplete="off" className="mt-6 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Usuario</span>
          <input
            name={`user-${formKey}`}
            readOnly={!inputsReady}
            onFocus={() => setInputsReady(true)}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-blue/30"
            autoComplete="new-password"
            autoCorrect="off"
            spellCheck={false}
            required
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Contrasena</span>
          <input
            name={`pass-${formKey}`}
            type="password"
            readOnly={!inputsReady}
            onFocus={() => setInputsReady(true)}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-blue/30"
            autoComplete="new-password"
            required
          />
        </label>

        <LoadingButton type="submit" loading={loading} loadingText="Ingresando..." className="w-full">
          Ingresar
        </LoadingButton>
      </form>

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
