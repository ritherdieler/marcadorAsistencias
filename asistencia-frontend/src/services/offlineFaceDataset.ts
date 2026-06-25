import { fetchOfflineFaceDataset, type OfflineFaceDataset, type OfflineFaceItem } from './recognitionService'

const DB_NAME = 'giga-face-offline'
const DB_VERSION = 1
const STORE_NAME = 'face_dataset'
const DATASET_KEY = 'current'
const LOCAL_SECRET_KEY = 'giga-face-offline-secret'
const REFRESH_COOLDOWN_MS = 60_000
const FAILED_REFRESH_COOLDOWN_MS = 10_000

export type OfflineFaceMatch = {
  face: OfflineFaceItem
  score: number
}

type EncryptedPayload = {
  iv: number[]
  data: number[]
}

let databasePromise: Promise<IDBDatabase> | null = null
let refreshPromise: Promise<OfflineFaceDataset> | null = null
let lastRefreshAt = 0
let lastRefreshFailedAt = 0

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

  return databasePromise
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDatabase().then(
    db =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode)
        const store = transaction.objectStore(STORE_NAME)
        const request = operation(store)

        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
  )
}

function getOrCreateLocalSecret(): string {
  const current = localStorage.getItem(LOCAL_SECRET_KEY)
  if (current) return current

  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const secret = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  localStorage.setItem(LOCAL_SECRET_KEY, secret)
  return secret
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const secret = encoder.encode(getOrCreateLocalSecret())
  const digest = await crypto.subtle.digest('SHA-256', secret)

  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

async function encryptDataset(dataset: OfflineFaceDataset): Promise<EncryptedPayload> {
  const key = await getEncryptionKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(JSON.stringify(dataset))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)

  return {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted)),
  }
}

async function decryptDataset(payload: EncryptedPayload): Promise<OfflineFaceDataset> {
  const key = await getEncryptionKey()
  const iv = new Uint8Array(payload.iv)
  const encrypted = new Uint8Array(payload.data)
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted)
  const json = new TextDecoder().decode(decrypted)

  return JSON.parse(json) as OfflineFaceDataset
}

export async function refreshOfflineFaceDataset(): Promise<OfflineFaceDataset> {
  // Evita saturar el navegador: si ya hay una descarga activa, reutiliza esa misma promesa.
  if (refreshPromise) return refreshPromise

  const now = Date.now()
  const cachedDataset = await getOfflineFaceDataset().catch(() => null)

  // Si ya se descargo recientemente, usa el dataset local para no golpear el backend en cada render/focus.
  if (cachedDataset && now - lastRefreshAt < REFRESH_COOLDOWN_MS) {
    return cachedDataset
  }

  // Si el backend acaba de fallar, no reintenta en bucle; conserva el modo offline con lo que ya existe localmente.
  if (lastRefreshFailedAt && now - lastRefreshFailedAt < FAILED_REFRESH_COOLDOWN_MS) {
    if (cachedDataset) return cachedDataset
    throw new Error('Dataset facial offline no disponible temporalmente.')
  }

  refreshPromise = (async () => {
    try {
      // Descarga el dataset actualizado y lo guarda cifrado en IndexedDB para uso offline.
      const dataset = await fetchOfflineFaceDataset()
      const encrypted = await encryptDataset(dataset)
      await runTransaction('readwrite', store => store.put(encrypted, DATASET_KEY))
      lastRefreshAt = Date.now()
      lastRefreshFailedAt = 0
      return dataset
    } catch (error) {
      lastRefreshFailedAt = Date.now()
      if (cachedDataset) return cachedDataset
      throw error
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

export async function getOfflineFaceDataset(): Promise<OfflineFaceDataset | null> {
  const payload = await runTransaction<EncryptedPayload | undefined>('readonly', store => store.get(DATASET_KEY))
  if (!payload) return null

  return decryptDataset(payload)
}

export async function clearOfflineFaceDataset(): Promise<void> {
  await runTransaction('readwrite', store => store.delete(DATASET_KEY))
  localStorage.removeItem(LOCAL_SECRET_KEY)
}

export function resetOfflineFaceDatasetState() {
  databasePromise = null
  refreshPromise = null
  lastRefreshAt = 0
  lastRefreshFailedAt = 0
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  if (!normA || !normB) return 0
  // El backend normaliza la similitud coseno de [-1, 1] a [0, 1].
  return ((dot / Math.sqrt(normA) / Math.sqrt(normB)) + 1) / 2
}

export function findBestOfflineFaceMatch(dataset: OfflineFaceDataset, descriptor: number[]): OfflineFaceMatch | null {
  const userScores = new Map<number, OfflineFaceMatch>()

  for (const face of dataset.faces) {
    if (face.faceEmbedding.length !== descriptor.length) continue

    const score = cosineSimilarity(face.faceEmbedding, descriptor)
    const currentBest = userScores.get(face.userId)
    if (!currentBest || score > currentBest.score) {
      userScores.set(face.userId, { face, score })
    }
  }

  if (userScores.size === 0) return null

  const rankedUsers = Array.from(userScores.values()).sort((left, right) => right.score - left.score)
  const best = rankedUsers[0]
  const secondBestScore = rankedUsers[1]?.score ?? -1

  if (best.score < dataset.threshold) return null
  if (secondBestScore !== -1 && best.score - secondBestScore < dataset.minMargin) return null

  return best
}

