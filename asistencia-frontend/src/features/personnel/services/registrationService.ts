import { saveFaceDataPhoto } from '../../../services/recognitionService'
import { http } from '../../../services/httpClient'
import { createUser, type CreateUserRequest } from '../../../services/userService'
import type { User } from '../../../types/user'
import {
  validateDniOptional,
  validateEmailRequired,
  validatePassword,
  validatePasswordConfirmation,
  validatePersonLastNameOptional,
  validatePersonName,
  validatePhoneRequired,
  validateUsername,
} from '../../../utils/validators'

export type NewUserRegistrationData = CreateUserRequest & {
  passwordConfirmation: string
}

export async function registerFaceForExistingUser(userId: number, photo: Blob): Promise<void> {
  await saveFaceDataPhoto(userId, photo)
}

function facePhotoFileName(prefix: string, photo: Blob): string {
  return `${prefix}.${photo.type === 'image/png' ? 'png' : 'jpg'}`
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

export async function registerMultiAngleFaceForExistingUser(
  username: string,
  password: string,
  photos: { front: Blob; left: Blob; right: Blob },
): Promise<void> {
  const formData = new FormData()
  formData.append('username', username)
  formData.append('password', password)
  formData.append('frontPhoto', photos.front, facePhotoFileName('face-front', photos.front))
  formData.append('leftPhoto', photos.left, facePhotoFileName('face-left', photos.left))
  formData.append('rightPhoto', photos.right, facePhotoFileName('face-right', photos.right))

  try {
    await http.post('/api/face-data/photo/enroll/multi-angle', formData)
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'No se pudo registrar el rostro multiangulo.'))
  }
}

export async function createUserAndRegisterFace(
  userData: NewUserRegistrationData,
  photo: Blob,
): Promise<User> {
  const nameError = validatePersonName(userData.name, 'Nombre')
  if (nameError) throw new Error(nameError)

  const lastNameError = validatePersonLastNameOptional(userData.lastName ?? '')
  if (lastNameError) throw new Error(lastNameError)

  const usernameError = validateUsername(userData.username)
  if (usernameError) throw new Error(usernameError)

  const passwordError = validatePassword(userData.password)
  if (passwordError) throw new Error(passwordError)

  const passwordConfirmationError = validatePasswordConfirmation(userData.password, userData.passwordConfirmation)
  if (passwordConfirmationError) throw new Error(passwordConfirmationError)

  const dniError = validateDniOptional(userData.dni ?? '')
  if (dniError) throw new Error(dniError)

  const emailError = validateEmailRequired(userData.email ?? '')
  if (emailError) throw new Error(emailError)

  const phoneError = validatePhoneRequired(userData.phone ?? '')
  if (phoneError) throw new Error(phoneError)

  const { passwordConfirmation: _passwordConfirmation, ...payload } = userData
  const created = await createUser(payload)
  await saveFaceDataPhoto(created.id, photo)
  return created
}
