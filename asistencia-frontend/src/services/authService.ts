import { http } from './httpClient' // Cliente HTTP configurado (baseURL, interceptores)
import type { User } from '../types/user' // Tipos del dominio (tabla user)

export interface LoginRequest {
  username: string // Usuario/login
  password: string // Contraseña
}

// Tu backend retorna un UserDto directamente (no token) en: POST /users/login. // Backend
export type LoginResponse = User

export async function login(req: LoginRequest): Promise<LoginResponse> {
  // Endpoint real según tu UserController.kt:
  // @RequestMapping("users") + @PostMapping("/login") => POST /users/login. // Backend
  const { data } = await http.post<LoginResponse>('/users/login', req) // Envía credenciales
  return data // Retorna el usuario (UserDto)
}
