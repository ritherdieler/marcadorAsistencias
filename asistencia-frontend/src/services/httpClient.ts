import axios from 'axios'

import { env } from '../utils/env'

type ConnectionReporter = {
  onError: () => void
  onSuccess: () => void
}

let connectionReporter: ConnectionReporter | null = null

export function registerConnectionReporter(reporter: ConnectionReporter | null) {
  connectionReporter = reporter
}

function isNetworkFailure(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true

  if (typeof error === 'object' && error !== null) {
    const axiosError = error as { code?: string; response?: unknown; request?: unknown }
    return Boolean(axiosError.request && !axiosError.response)
      || axiosError.code === 'ERR_NETWORK'
      || axiosError.code === 'ECONNABORTED'
  }

  return false
}

const http = axios.create({
  baseURL: env.apiBaseUrl ?? 'http://localhost:8080/ispadmin',
  timeout: 20000,
  withCredentials: true,
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use(
  (response) => {
    connectionReporter?.onSuccess()
    return response
  },
  (error) => {
    if (isNetworkFailure(error)) {
      connectionReporter?.onError()
    }
    return Promise.reject(error)
  },
)

export { http }
