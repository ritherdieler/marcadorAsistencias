import { saveFaceDataPhoto } from '../../../services/recognitionService'
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
