export type ObsEventType = 'error' | 'crash' | 'http_error' | 'log' | 'custom'

export type ObsPlatform = 'web-backoffice' | 'web-asistencias'

export type ObsSeverity = 'fatal' | 'error' | 'warning' | 'info'

export type ObsEnvironment = 'prod' | 'dev' | 'local'

export type BreadcrumbCategory = 'navigation' | 'click' | 'http' | 'log' | 'custom'

export interface ObsUser {
  id?: string | number
  username?: string
  name?: string
  email?: string
  type?: string
}

export interface ObsDevice {
  screen?: string
  viewport?: string
  language?: string
  platform?: string
  online?: boolean
}

export interface Breadcrumb {
  category: BreadcrumbCategory
  message: string
  level?: ObsSeverity
  data?: Record<string, unknown>
  timestamp: number
}

export interface ObsEvent {
  eventType: ObsEventType
  platform: ObsPlatform
  severity: ObsSeverity
  message: string
  errorType?: string
  stacktrace?: string
  environment: ObsEnvironment
  release?: string
  correlationId?: string
  sessionId: string
  url?: string
  httpMethod?: string
  httpStatus?: number
  durationMs?: number
  userAgent?: string
  user?: ObsUser
  device?: ObsDevice
  breadcrumbs?: Breadcrumb[]
  tags?: Record<string, string>
  context?: Record<string, unknown>
  replayId?: string
  timestamp: number
}

export interface ObsCaptureOptions {
  severity?: ObsSeverity
  eventType?: ObsEventType
  extra?: Record<string, unknown>
  tags?: Record<string, string>
  withReplay?: boolean
}

export interface ObsConfig {
  platform: ObsPlatform
  baseUrl: string
  apiKey: string
  wsUrl?: string
  release?: string
  environment?: ObsEnvironment
  enabled?: boolean
  getUser?: () => unknown
  enableReplay?: boolean
  replayWindowMs?: number
  flushIntervalMs?: number
  maxBatchSize?: number
  maxBreadcrumbs?: number
  maxQueueSize?: number
  maxReplaysPerSession?: number
  debug?: boolean
}
