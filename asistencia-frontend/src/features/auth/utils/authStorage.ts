import type { User } from '../../../types/user' // Tipo de usuario (UserDto)

// Lee el usuario logueado desde localStorage. // Persistencia
export function getAuthUser(): User | null {
  try {
    const raw = localStorage.getItem('auth_user') // Obtiene JSON guardado
    return raw ? (JSON.parse(raw) as User) : null // Parse o null si no existe
  } catch {
    return null // Si el JSON está corrupto, no rompe la app
  }
}

// Guarda el usuario logueado en localStorage. // Persistencia
export function setAuthUser(user: User) {
  localStorage.setItem('auth_user', JSON.stringify(user)) // Serializa user
}

export function setAuthTokens(accessToken?: string | null, refreshToken?: string | null) {
  if (accessToken) localStorage.setItem('auth_token', accessToken)
  if (refreshToken) localStorage.setItem('refresh_token', refreshToken)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem('refresh_token')
}

// Limpia sesión local. // Seguridad
export function clearAuth() {
  localStorage.removeItem('auth_user') // Quita usuario
  localStorage.removeItem('auth_token') // Quita access token
  localStorage.removeItem('refresh_token') // Quita refresh token
  // Nota: el navegador puede autofill de todos modos, por eso el LoginPage limpia campos al montar. // UX
}
