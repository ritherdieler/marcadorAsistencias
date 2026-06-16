import type { User, UserType } from '../types/user'

const roleLabels: Record<UserType, string> = {
  ADMIN: 'Administrador',
  TECHNICIAN: 'Tecnico',
  CLIENT: 'Cliente',
  SALES: 'Ventas',
  SECRETARY: 'Secretaria',
  ACCOUNTANT: 'Contador',
}

export function normalizeUserType(type: User['type']): UserType | null {
  const normalized = String(type ?? '').trim().toUpperCase()
  return normalized in roleLabels ? (normalized as UserType) : null
}

export function formatUserRole(type: User['type']): string {
  const normalized = normalizeUserType(type)
  return normalized ? roleLabels[normalized] : '-'
}

export function isAdminUser(user: User | null | undefined): boolean {
  return normalizeUserType(user?.type) === 'ADMIN'
}

export const userRoleOptions = Object.entries(roleLabels).map(([value, label]) => ({
  value: value as UserType,
  label,
}))
