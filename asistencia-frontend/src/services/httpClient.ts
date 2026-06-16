import axios from 'axios' // Librería HTTP

import { env } from '../utils/env' // Variables de entorno (VITE_*)

const http = axios.create({
  baseURL: env.apiBaseUrl ?? 'http://localhost:8080/ispadmin', // Por defecto: puerto 8080 + context-path /ispadmin (según tu application.properties)
  timeout: 20000, // Timeout de red (ms)
  withCredentials: true, // Soporta autenticación por cookies/sesión si tu backend la usa
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token') // Token JWT (si tu backend entrega Bearer)
  if (token) config.headers.Authorization = `Bearer ${token}` // Inyecta Authorization automáticamente
  return config // Devuelve la config para continuar con la petición
})

export { http } // Exporta cliente HTTP reutilizable
