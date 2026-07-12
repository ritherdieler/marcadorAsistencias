interface ObsRequestConfig {
  method?: string
  url?: string
  baseURL?: string
  headers?: Record<string, unknown>
}

interface ObsAxiosError {
  config?: ObsRequestConfig
  code?: string
  message?: string
  response?: { status?: number }
}

interface InterceptorRegistrar {
  use(onFulfilled: (value: any) => any, onRejected?: (error: any) => any): number
}

export interface ObsAxiosInstance {
  interceptors: {
    request: InterceptorRegistrar
    response: InterceptorRegistrar
  }
}

interface RequestMeta {
  start: number
  correlationId: string
}

export interface AxiosRequestInfo {
  method: string
  url: string
  correlationId: string
}

export interface AxiosErrorInfo {
  method: string
  url: string
  status?: number
  code?: string
  message: string
  correlationId?: string
  durationMs?: number
  offline: boolean
}

export interface AxiosHooks {
  newCorrelationId: () => string
  onRequest: (info: AxiosRequestInfo) => void
  onResponseError: (info: AxiosErrorInfo) => void
}

function safePath(config: ObsRequestConfig | undefined): string {
  if (!config) return ''
  const raw = config.url ?? ''
  const withoutQuery = raw.split('?')[0]
  if (withoutQuery.startsWith('http')) return withoutQuery
  const base = config.baseURL ?? ''
  return `${base}${withoutQuery}`.split('?')[0]
}

export function installAxiosInterceptors(instance: ObsAxiosInstance, hooks: AxiosHooks): void {
  const meta = new WeakMap<object, RequestMeta>()

  instance.interceptors.request.use((config: ObsRequestConfig) => {
    try {
      const correlationId = hooks.newCorrelationId()
      meta.set(config, { start: Date.now(), correlationId })
      if (config.headers) {
        config.headers['X-Correlation-Id'] = correlationId
      }
      hooks.onRequest({
        method: (config.method ?? 'get').toUpperCase(),
        url: safePath(config),
        correlationId,
      })
    } catch {
      /* noop */
    }
    return config
  })

  instance.interceptors.response.use(
    (response: unknown) => response,
    (error: ObsAxiosError) => {
      try {
        const config = error.config
        const stored = config ? meta.get(config) : undefined
        const status = error.response?.status
        hooks.onResponseError({
          method: (config?.method ?? 'get').toUpperCase(),
          url: safePath(config),
          status,
          code: error.code,
          message: error.message ?? 'request error',
          correlationId: stored?.correlationId,
          durationMs: stored ? Date.now() - stored.start : undefined,
          offline: typeof navigator !== 'undefined' && !navigator.onLine,
        })
      } catch {
        /* noop */
      }
      return Promise.reject(error)
    },
  )
}
