import { clearAuth } from '../features/auth/utils/authStorage'
import { clearLocalAttendanceState } from './localAttendanceState'
import { resetOfflineFaceDatasetState } from './offlineFaceDataset'

const LOCAL_STORAGE_KEYS = [
  'auth_user',
  'auth_token',
  'giga-attendance-checked-in-users',
  'giga-face-offline-secret',
] as const

const INDEXED_DB_NAMES = ['giga-face-offline', 'giga-attendance-offline'] as const

export const LOCAL_DATA_RESET_VERSION = 'face-recognition-config-v1'
const LOCAL_DATA_RESET_KEY = 'giga-local-data-reset-version'

function deleteIndexedDb(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error(`No se pudo eliminar IndexedDB: ${name}`))
    request.onblocked = () => resolve()
  })
}

export async function clearAllLocalAppData(): Promise<void> {
  resetOfflineFaceDatasetState()
  clearLocalAttendanceState()
  clearAuth()

  for (const key of LOCAL_STORAGE_KEYS) {
    localStorage.removeItem(key)
  }

  await Promise.all(INDEXED_DB_NAMES.map(name => deleteIndexedDb(name).catch(() => undefined)))
}

export async function ensureLocalDataReset(): Promise<void> {
  if (localStorage.getItem(LOCAL_DATA_RESET_KEY) === LOCAL_DATA_RESET_VERSION) return

  await clearAllLocalAppData()
  localStorage.setItem(LOCAL_DATA_RESET_KEY, LOCAL_DATA_RESET_VERSION)
}
