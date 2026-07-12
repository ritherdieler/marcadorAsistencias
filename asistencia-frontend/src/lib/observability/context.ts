import type { ObsDevice, ObsUser } from './types'

export function collectDevice(): ObsDevice {
  const device: ObsDevice = {}
  try {
    if (typeof screen !== 'undefined') {
      device.screen = `${screen.width}x${screen.height}`
    }
    if (typeof window !== 'undefined') {
      device.viewport = `${window.innerWidth}x${window.innerHeight}`
    }
    if (typeof navigator !== 'undefined') {
      device.language = navigator.language
      device.platform = navigator.platform
      device.online = navigator.onLine
    }
  } catch {
    return device
  }
  return device
}

export function normalizeUser(raw: unknown): ObsUser | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const source = raw as Record<string, unknown>
  const user: ObsUser = {}
  const id = source.id
  if (typeof id === 'string' || typeof id === 'number') user.id = id
  if (typeof source.username === 'string') user.username = source.username
  if (typeof source.name === 'string') user.name = source.name
  if (typeof source.email === 'string') user.email = source.email
  if (typeof source.type === 'string') user.type = source.type
  return Object.keys(user).length > 0 ? user : undefined
}

export function currentUrl(): string {
  try {
    return typeof location !== 'undefined' ? location.href : ''
  } catch {
    return ''
  }
}
