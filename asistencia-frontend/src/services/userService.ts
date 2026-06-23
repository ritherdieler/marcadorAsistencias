import { http } from './httpClient'
import type { User, UserType } from '../types/user'
import { encryptWithSHA384 } from '../utils/sha384'

export async function getAllUsers(): Promise<User[]> {
  const { data } = await http.get<User[]>('/users')
  return data
}

export interface CreateUserRequest {
  name: string
  lastName?: string
  dni?: string
  email?: string
  phone?: string
  username: string
  password: string
  type: UserType
  verified?: boolean
}

export async function createUser(req: CreateUserRequest): Promise<User> {
  if (req.dni && !/^\d+$/.test(req.dni)) {
    throw new Error('El DNI solo acepta numeros.')
  }

  const payload = {
    name: req.name,
    lastName: req.lastName ?? null,
    dni: req.dni ?? null,
    email: req.email ?? null,
    phone: req.phone ?? null,
    username: req.username,
    password: await encryptWithSHA384(req.password),
    type: req.type,
    verified: req.verified ?? true,
  }

  const { data } = await http.post<User>('/users', payload)
  return data
}
