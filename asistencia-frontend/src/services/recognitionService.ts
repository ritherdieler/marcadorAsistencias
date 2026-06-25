import type { User } from '../types/user'
import { encryptWithSHA384 } from '../utils/sha384'
import { http } from './httpClient'

type FaceAction = 'CHECK_IN' | 'CHECK_OUT'

export interface VerifyFaceResponse {
  matched: boolean
  user?: User
  userDni?: string | null
  userType?: string | null
  action?: FaceAction
  message?: string
  checkInTime?: string
  attendanceStatus?: 'OK' | 'TARDANZA' | string
  nextAction?: FaceAction | 'NONE' | string | null
  alreadyRegistered?: boolean
  requiresReenrollment?: boolean
  challengeRequired?: boolean
}

export interface FaceChallenge {
  challengeId: string
  expiresInMs: number
  enabled: boolean
}

export interface OfflineFaceItem {
  faceDataId: number
  userId: number
  userName: string
  userDni?: string | null
  userType?: string | null
  faceEmbedding: number[]
  registeredAt: string
}

export interface OfflineFaceDataset {
  datasetVersion: number
  generatedAt: string
  metric: 'COSINE_SIMILARITY'
  threshold: number
  minMargin: number
  descriptorSize: number
  faces: OfflineFaceItem[]
}

export interface OfflineAttendanceSyncRequest {
  offlineId: string
  userId: number
  action: FaceAction
  occurredAtMillis: number
  score?: number | null
  faceDataId?: number | null
}

type RawVerifyFaceResponse = {
  matched: boolean
  user?: User
  userId?: number
  userName?: string
  userDni?: string | null
  userType?: string | null
  action?: FaceAction
  message?: string
  checkInTime?: string
  attendanceStatus?: 'OK' | 'TARDANZA' | string
  nextAction?: FaceAction | 'NONE' | string | null
  alreadyRegistered?: boolean
  requiresReenrollment?: boolean
  challengeRequired?: boolean
}

export interface PasswordAttendanceRequest {
  username: string
  password: string
  action?: FaceAction
}

export interface FaceEvidenceRequest {
  imageBase64: string
  reason: string
  userId?: number | null
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { status?: number; data?: unknown } }).response
    const data = response?.data
    const serverMessage =
      typeof data === 'string'
        ? data
        : typeof data === 'object' && data !== null && 'message' in data
          ? String((data as { message?: unknown }).message)
          : ''

    return `${fallback}${response?.status ? ` (HTTP ${response.status})` : ''}${serverMessage ? `: ${serverMessage}` : ''}`
  }

  return error instanceof Error ? `${fallback}: ${error.message}` : fallback
}

function normalizeVerifyFaceResponse(data: RawVerifyFaceResponse): VerifyFaceResponse {
  const normalizedUser: User | undefined = data.user ?? (data.userId
    ? ({
        id: data.userId,
        name: data.userName ?? null,
        dni: data.userDni ?? null,
        type: (data.userType as User['type']) ?? null,
      } as User)
    : undefined)

  return {
    matched: data.matched,
    user: normalizedUser,
    action: data.action,
    message: data.message,
    checkInTime: data.checkInTime,
    attendanceStatus: data.attendanceStatus,
    nextAction: data.nextAction,
    alreadyRegistered: data.alreadyRegistered,
    requiresReenrollment: data.requiresReenrollment,
    challengeRequired: data.challengeRequired,
  }
}

function facePhotoFileName(prefix: string, photo: Blob): string {
  // Mantiene la extension coherente con el formato enviado al backend.
  return `${prefix}.${photo.type === 'image/png' ? 'png' : 'jpg'}`
}

export async function saveFaceDataPhoto(userId: number, photo: Blob): Promise<void> {
  // Registra el rostro enviando solo la foto; el backend genera y guarda el embedding con DJL.
  const formData = new FormData()
  formData.append('userId', String(userId))
  formData.append('photo', photo, facePhotoFileName(`face-user-${userId}`, photo))

  try {
    await http.post('/api/face-data/photo', formData)
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'No se pudo guardar el rostro con DJL en /api/face-data/photo'))
  }
}

export async function checkFaceDataPhoto(photo: Blob): Promise<boolean> {
  // Valida con DJL si la foto actual contiene un rostro usable, sin guardar face_data.
  const formData = new FormData()
  formData.append('photo', photo, facePhotoFileName('face-check', photo))

  try {
    const { data } = await http.post<{ valid?: boolean }>('/api/face-data/photo/check', formData)
    return data.valid === true
  } catch {
    return false
  }
}

export async function fetchOfflineFaceDataset(): Promise<OfflineFaceDataset> {
  // Descarga solo los datos necesarios para preparar el reconocimiento offline.
  const { data } = await http.get<OfflineFaceDataset>('/api/face-data/offline-dataset')
  return data
}

export async function startFaceChallenge(): Promise<FaceChallenge> {
  // Pide al backend un reto de un solo uso (Nivel B) que se valida al marcar asistencia.
  const { data } = await http.post<FaceChallenge>('/api/face/challenge/start')
  return data
}

export async function identifyFacePhoto(photo: Blob, challengeToken?: string | null): Promise<VerifyFaceResponse> {
  // Identifica el rostro enviando la foto; el backend genera el descriptor y compara contra face_data.
  const formData = new FormData()
  formData.append('photo', photo, facePhotoFileName('identify-face', photo))
  if (challengeToken) {
    formData.append('challengeToken', challengeToken)
  }

  const { data } = await http.post<RawVerifyFaceResponse>('/api/face/identify/photo', formData)
  return normalizeVerifyFaceResponse(data)
}

export async function verifyFacePhoto(
  photo: Blob,
  action: FaceAction,
  occurredAtMillis?: number,
  challengeToken?: string | null,
): Promise<VerifyFaceResponse> {
  // Marca asistencia/salida enviando la foto; el backend valida el rostro y registra la accion.
  const formData = new FormData()
  formData.append('photo', photo, facePhotoFileName('attendance-face', photo))
  formData.append('action', action)
  if (occurredAtMillis) {
    // Para marcaciones offline se envia la hora real de captura, no la hora de sincronizacion.
    formData.append('occurredAtMillis', String(occurredAtMillis))
  }
  if (challengeToken) {
    formData.append('challengeToken', challengeToken)
  }

  const { data } = await http.post<RawVerifyFaceResponse>('/api/face/verify/photo', formData)
  return normalizeVerifyFaceResponse(data)
}

export async function verifyAttendanceWithPassword(req: PasswordAttendanceRequest): Promise<VerifyFaceResponse> {
  const { data } = await http.post<RawVerifyFaceResponse>('/api/face/verify/password', {
    ...req,
    password: await encryptWithSHA384(req.password),
  })
  return normalizeVerifyFaceResponse(data)
}

export async function saveFaceEvidence(req: FaceEvidenceRequest): Promise<void> {
  await http.post('/api/face/evidence', req)
}

export async function saveFaceEvidencePhoto(photo: Blob, reason: string, userId?: number | null): Promise<void> {
  // Convierte la foto confirmada a Base64 y la envia al backend para guardarla en Firebase/attendance.
  const imageBase64 = await blobToDataUrl(photo)
  await saveFaceEvidence({ imageBase64, reason, userId: userId ?? null })
}

export async function syncOfflineFaceAttendance(req: OfflineAttendanceSyncRequest): Promise<VerifyFaceResponse> {
  // Sincroniza una marcacion que fue guardada localmente durante una caida de conexion/backend.
  const { data } = await http.post<RawVerifyFaceResponse>('/api/face/attendance/offline-sync', req)
  return normalizeVerifyFaceResponse(data)
}
