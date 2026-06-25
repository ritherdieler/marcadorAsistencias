import type { User } from '../types/user'
import { forgetLocalCheckIn, hasLocalCheckIn, rememberLocalCheckIn } from './localAttendanceState'
import { findBestOfflineFaceMatch, getOfflineFaceDataset } from './offlineFaceDataset'
import { generateLocalFaceDescriptorCandidates } from './localFaceDescriptor'
import { identifyFacePhoto, type VerifyFaceResponse } from './recognitionService'

export type IdentifiedFaceResult = {
  matched: boolean
  source: 'online' | 'offline'
  photo: Blob
  user?: User
  nextAction?: 'CHECK_IN' | 'CHECK_OUT'
  faceDataId?: number | null
  score?: number | null
  requiresReenrollment?: boolean
  message?: string
}

export type IdentifyCapturedFaceOptions = {
  challengeToken?: string | null
  isOnline: boolean
}

function mapOnlineResponse(photo: Blob, res: VerifyFaceResponse): IdentifiedFaceResult {
  if (res.requiresReenrollment) {
    return {
      matched: false,
      source: 'online',
      photo,
      requiresReenrollment: true,
      message: res.message ?? 'Tu registro facial debe actualizarse antes de marcar asistencia.',
    }
  }

  if (!res.matched || !res.user) {
    return {
      matched: false,
      source: 'online',
      photo,
      message: res.message ?? 'No pudimos identificar este rostro.',
    }
  }

  if (res.nextAction === 'CHECK_OUT') {
    rememberLocalCheckIn(res.user)
  } else {
    forgetLocalCheckIn(res.user.id)
  }

  return {
    matched: true,
    source: 'online',
    photo,
    user: res.user,
    nextAction: res.nextAction === 'CHECK_OUT' ? 'CHECK_OUT' : 'CHECK_IN',
  }
}

async function identifyCapturedFaceOffline(photo: Blob): Promise<IdentifiedFaceResult> {
  const unrecognizedMessage =
    'Sin conexion. No pudimos reconocer el rostro con el dataset offline guardado.'

  const dataset = await getOfflineFaceDataset()
  if (!dataset || dataset.faces.length === 0) {
    return { matched: false, source: 'offline', photo, message: unrecognizedMessage }
  }

  const descriptors = await generateLocalFaceDescriptorCandidates(photo)
  if (descriptors.length === 0) {
    return { matched: false, source: 'offline', photo, message: unrecognizedMessage }
  }

  let bestMatch: ReturnType<typeof findBestOfflineFaceMatch> | null = null

  for (const descriptor of descriptors) {
    const match = findBestOfflineFaceMatch(dataset, descriptor)
    if (match && (!bestMatch || match.score > bestMatch.score)) {
      bestMatch = match
    }
  }

  if (!bestMatch) {
    return { matched: false, source: 'offline', photo, message: unrecognizedMessage }
  }

  return {
    matched: true,
    source: 'offline',
    photo,
    user: {
      id: bestMatch.face.userId,
      name: bestMatch.face.userName,
      dni: bestMatch.face.userDni ?? null,
      type: (bestMatch.face.userType as User['type']) ?? null,
    } as User,
    nextAction: hasLocalCheckIn(bestMatch.face.userId) ? 'CHECK_OUT' : 'CHECK_IN',
    faceDataId: bestMatch.face.faceDataId,
    score: bestMatch.score,
  }
}

export async function identifyCapturedFace(
  photo: Blob,
  options: IdentifyCapturedFaceOptions,
): Promise<IdentifiedFaceResult> {
  if (options.isOnline) {
    const res = await identifyFacePhoto(photo, options.challengeToken)
    return mapOnlineResponse(photo, res)
  }

  return identifyCapturedFaceOffline(photo)
}
