import { identifyFacePhoto, saveFaceEvidence, syncOfflineFaceAttendance, verifyFacePhoto } from './recognitionService'
import { forgetLocalCheckIn, rememberLocalCheckIn } from './localAttendanceState'

type OfflineAttendanceAction = 'AUTO' | 'CHECK_IN' | 'CHECK_OUT'
type AttendanceSyncAction = Exclude<OfflineAttendanceAction, 'AUTO'>

export type OfflineAttendanceRecord = {
  id: string
  action: OfflineAttendanceAction
  photo: Blob
  userId?: number | null
  userName?: string | null
  faceDataId?: number | null
  score?: number | null
  createdAt: number
  lastError?: string | null
  lastTriedAt?: number | null
  syncAttempts?: number
}

const DB_NAME = 'giga-attendance-offline'
const DB_VERSION = 1
const STORE_NAME = 'attendance_queue'
let syncInProgress = false

function openAttendanceDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt')
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function runStoreOperation<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  return openAttendanceDb().then((db) => new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode)
    const store = tx.objectStore(STORE_NAME)
    const request = operation(store)

    tx.oncomplete = () => {
      db.close()
      resolve(request ? request.result : undefined)
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error)
    }
    tx.onabort = () => {
      db.close()
      reject(tx.error)
    }
  }))
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export function isConnectionError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true

  if (typeof error === 'object' && error !== null) {
    const possibleAxiosError = error as { code?: string; response?: unknown; request?: unknown }
    return Boolean(possibleAxiosError.request && !possibleAxiosError.response)
      || possibleAxiosError.code === 'ERR_NETWORK'
      || possibleAxiosError.code === 'ECONNABORTED'
  }

  return false
}

export async function enqueueOfflineAttendance(record: Omit<OfflineAttendanceRecord, 'id' | 'createdAt'>): Promise<void> {
  const queuedRecord: OfflineAttendanceRecord = {
    ...record,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  }

  await runStoreOperation('readwrite', (store) => store.add(queuedRecord))
}

export async function getOfflineAttendanceRecords(): Promise<OfflineAttendanceRecord[]> {
  const records = await runStoreOperation<OfflineAttendanceRecord[]>('readonly', (store) => store.getAll())
  return (records ?? []).sort((a, b) => a.createdAt - b.createdAt)
}

export async function getOfflineAttendanceCount(): Promise<number> {
  const records = await getOfflineAttendanceRecords()
  return records.length
}

async function deleteOfflineAttendanceRecord(id: string): Promise<void> {
  await runStoreOperation('readwrite', (store) => store.delete(id))
}

async function keepOfflineAttendanceRecord(record: OfflineAttendanceRecord, error: string): Promise<void> {
  // Conserva la marcacion pendiente si el backend aun no pudo registrarla.
  // Asi evitamos perder asistencias offline por un fallo temporal de rostro, servidor o red.
  await runStoreOperation('readwrite', (store) => store.put({
    ...record,
    lastError: error,
    lastTriedAt: Date.now(),
    syncAttempts: (record.syncAttempts ?? 0) + 1,
  }))
}

function shouldTreatAsRegistered(action: AttendanceSyncAction, response: { matched: boolean; message?: string }): boolean {
  if (!response.matched) return false

  // Para entrada, matched=true significa que el backend registro o confirmo una asistencia existente.
  if (action === 'CHECK_IN') return true

  // Para salida, evitamos marcar como sincronizada una respuesta que no escribio salida en attendance.
  return !response.message?.toLowerCase().includes('no hay un ingreso abierto')
}

function isMissingOpenCheckIn(response: { message?: string }): boolean {
  return response.message?.toLowerCase().includes('no hay un ingreso abierto') === true
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'No se pudo sincronizar la marcacion offline.'
}

async function syncKnownOfflineRecord(record: OfflineAttendanceRecord, action: AttendanceSyncAction) {
  if (!record.userId) {
    throw new Error('La marcacion offline no tiene usuario identificado.')
  }

  return syncOfflineFaceAttendance({
    offlineId: record.id,
    userId: record.userId,
    action,
    occurredAtMillis: record.createdAt,
    score: record.score ?? null,
    faceDataId: record.faceDataId ?? null,
  })
}

export async function syncOfflineAttendanceQueue(): Promise<{ synced: number; remaining: number }> {
  if (syncInProgress) {
    return {
      synced: 0,
      remaining: await getOfflineAttendanceCount(),
    }
  }

  syncInProgress = true
  const records = await getOfflineAttendanceRecords()
  let synced = 0

  try {
    for (const record of records) {
      try {
        // Si la marcacion se guardo sin internet desde cero, primero identifica al usuario
        // y luego usa la accion que el backend determine para ese rostro.
        const action = record.action === 'AUTO'
          ? (await identifyFacePhoto(record.photo)).nextAction
          : record.action

        if (action !== 'CHECK_IN' && action !== 'CHECK_OUT') {
          await keepOfflineAttendanceRecord(record, 'El backend no determino si corresponde entrada o salida.')
          continue
        }

        let finalAction: AttendanceSyncAction = action
        let response = record.userId
          ? await syncKnownOfflineRecord(record, finalAction)
          : await verifyFacePhoto(record.photo, finalAction, record.createdAt)

        // Si una salida offline ya fue sincronizada antes, el backend puede responder que no queda
        // ingreso abierto. En ese caso eliminamos el pendiente para evitar duplicar marcaciones.
        if (finalAction === 'CHECK_OUT' && response.matched && isMissingOpenCheckIn(response)) {
          if (record.userId) {
            forgetLocalCheckIn(record.userId)
            await deleteOfflineAttendanceRecord(record.id)
            synced += 1
            continue
          }

          // Para registros antiguos sin usuario local, conserva el comportamiento previo.
          finalAction = 'CHECK_IN'
          response = record.userId
            ? await syncKnownOfflineRecord(record, finalAction)
            : await verifyFacePhoto(record.photo, finalAction, record.createdAt)
        }

        if (!shouldTreatAsRegistered(finalAction, response)) {
          await keepOfflineAttendanceRecord(record, response.message ?? 'El rostro no fue validado por el backend.')
          continue
        }

        if (finalAction === 'CHECK_OUT') {
          forgetLocalCheckIn(record.userId ?? response.user?.id)
        } else if (response.user) {
          rememberLocalCheckIn(response.user)
        }

        // La asistencia ya quedo registrada en el backend. La evidencia se sube en segundo plano
        // para que Firebase no retrase la sincronizacion visible para el usuario.
        void blobToDataUrl(record.photo)
          .then((imageBase64) => saveFaceEvidence({
            imageBase64,
            reason: finalAction === 'CHECK_OUT' ? 'OFFLINE_CHECK_OUT_SYNCED' : 'OFFLINE_CHECK_IN_SYNCED',
            userId: record.userId ?? response.user?.id ?? null,
          }))
          .catch(() => undefined)

        await deleteOfflineAttendanceRecord(record.id)
        synced += 1
      } catch (error) {
        if (isConnectionError(error)) break
        await keepOfflineAttendanceRecord(record, errorMessage(error))
      }
    }
  } finally {
    syncInProgress = false
  }

  return {
    synced,
    remaining: await getOfflineAttendanceCount(),
  }
}
