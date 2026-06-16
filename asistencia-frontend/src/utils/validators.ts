export function validateUsername(username: string): string | null {
  if (!username.trim()) return 'El usuario es obligatorio.'
  if (/\s/.test(username)) return 'El usuario no debe contener espacios.'
  if (username.trim().length < 3) return 'El usuario debe tener minimo 3 caracteres.'
  return null
}

export function validatePassword(password: string): string | null {
  if (!password.trim()) return 'La contrasena es obligatoria.'
  if (password.length < 6) return 'La contrasena debe tener minimo 6 caracteres.'
  return null
}

export function validatePasswordConfirmation(password: string, confirmation: string): string | null {
  if (!confirmation.trim()) return 'Confirma la contrasena.'
  if (password !== confirmation) return 'Las contrasenas no coinciden.'
  return null
}

export function validateDniOptional(dni: string): string | null {
  const value = dni.trim()
  if (!value) return null
  if (!/^\d+$/.test(value)) return 'El DNI solo acepta numeros.'
  return null
}

export function validatePersonName(value: string, fieldName: string): string | null {
  const clean = value.trim()
  if (!clean) return `${fieldName} es obligatorio.`
  if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+$/.test(clean)) return `${fieldName} solo acepta letras.`
  return null
}

export function validatePersonLastNameOptional(value: string): string | null {
  const clean = value.trim()
  if (!clean) return null
  if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+$/.test(clean)) return 'Apellido solo acepta letras.'
  return null
}

export function sanitizePersonName(value: string): string {
  return value.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]/g, '')
}

export function sanitizePhone(value: string): string {
  return value.replace(/\D/g, '').slice(0, 9)
}

export function validateEmailRequired(email: string): string | null {
  const value = email.trim()
  if (!value) return 'El correo es obligatorio.'
  if (!value.includes('@')) return 'El correo debe incluir arroba (@).'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Ingresa un correo valido.'
  return null
}

export function validatePhoneRequired(phone: string): string | null {
  const value = phone.trim()
  if (!value) return 'El telefono es obligatorio.'
  if (!/^\d{9}$/.test(value)) return 'El telefono debe tener exactamente 9 digitos.'
  return null
}
