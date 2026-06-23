import { http } from './httpClient'
import type { User } from '../types/user'
import { encryptWithSHA384 } from '../utils/sha384'

export interface LoginRequest {
  username: string // Usuario/login
  password: string // Contraseña
}

// Tu backend retorna un UserDto directamente (no token) en: POST /users/login. // Backend
export type LoginResponse = User

export async function login(req: LoginRequest): Promise<LoginResponse> {
  const { data } = await http.post<LoginResponse>('/users/login', {
    username: req.username,
    password: await encryptWithSHA384(req.password),
  })
  return data
}
