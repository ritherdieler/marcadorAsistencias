import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { clearAuth, getRefreshToken } from '../features/auth/utils/authStorage'

type ConnectionReporter = {
  onError: () => void
  onSuccess: () => void
}

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

const LOGIN_ROUTE = '/login'
const PUBLIC_PATHS = ['/users/login', '/users/token/refresh']

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

function isPublicPath(url?: string): boolean {
  if (!url) return false
  return PUBLIC_PATHS.some((path) => url.includes(path))
}

const http = axios.create({
  baseURL: 'https://api.gigafiberperu.cloud/ispadmin',
  timeout: 20000,
  withCredentials: true,
})

http.interceptors.request.use((config) => {
  if (isPublicPath(config.url)) return config
  const token = localStorage.getItem('auth_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let refreshPromise: Promise<string> | null = null

async function requestNewAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) throw new Error('No refresh token available')

  const { data } = await axios.post<{ accessToken: string; refreshToken: string }>(
    `${http.defaults.baseURL}/users/token/refresh`,
    { refreshToken },
    { withCredentials: true, timeout: http.defaults.timeout },
  )

  localStorage.setItem('auth_token', data.accessToken)
  localStorage.setItem('refresh_token', data.refreshToken)
  return data.accessToken
}

function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = requestNewAccessToken().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

function redirectToLogin() {
  if (typeof window !== 'undefined' && window.location.pathname !== LOGIN_ROUTE) {
    window.location.assign(LOGIN_ROUTE)
  }
}

http.interceptors.response.use(
  (response) => {
    connectionReporter?.onSuccess()
    return response
  },
  async (error: AxiosError) => {
    if (isNetworkFailure(error)) {
      connectionReporter?.onError()
    }

    const config = error.config as RetryableConfig | undefined
    const status = error.response?.status

    if (status === 401 && config && !config._retry && !isPublicPath(config.url)) {
      config._retry = true
      try {
        const newToken = await refreshAccessToken()
        config.headers = config.headers ?? {}
        config.headers.Authorization = `Bearer ${newToken}`
        return http(config)
      } catch (refreshError) {
        clearAuth()
        redirectToLogin()
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  },
)

export { http }
