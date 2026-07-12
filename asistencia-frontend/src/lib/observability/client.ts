import { BreadcrumbBuffer } from './breadcrumbs'
import { collectDevice, currentUrl, normalizeUser } from './context'
import { gzipJson } from './gzip'
import { generateCorrelationId, resolveSessionId } from './ids'
import { EventQueue } from './queue'
import { ReplayRecorder } from './replay'
import { uploadReplay } from './transport'
import { installAxiosInterceptors } from './axiosIntegration'
import type { ObsAxiosInstance } from './axiosIntegration'
import type {
  ObsCaptureOptions,
  ObsConfig,
  ObsEvent,
  ObsSeverity,
} from './types'

const DEFAULT_BREADCRUMBS = 40
const DEFAULT_REPLAY_WINDOW_MS = 90000
const DEFAULT_MAX_REPLAYS = 10
const MAX_REPLAY_BYTES = 15 * 1024 * 1024
const REPLAY_MIN_INTERVAL_MS = 5000

interface NormalizedError {
  name: string
  message: string
  stack?: string
}

function normalizeError(error: unknown): NormalizedError {
  if (error instanceof Error) {
    return { name: error.name || 'Error', message: error.message || String(error), stack: error.stack }
  }
  if (typeof error === 'string') {
    return { name: 'Error', message: error }
  }
  try {
    return { name: 'Error', message: JSON.stringify(error) }
  } catch {
    return { name: 'Error', message: 'Unknown error' }
  }
}

export class ObservabilityClient {
  readonly config: ObsConfig

  private readonly breadcrumbs: BreadcrumbBuffer

  private readonly queue: EventQueue

  private readonly recorder: ReplayRecorder

  private readonly sessionId: string

  private replayCount = 0

  private lastReplayAt = 0

  private started = false

  constructor(config: ObsConfig) {
    this.config = config
    this.sessionId = resolveSessionId()
    this.breadcrumbs = new BreadcrumbBuffer(config.maxBreadcrumbs ?? DEFAULT_BREADCRUMBS)
    this.queue = new EventQueue(config)
    this.recorder = new ReplayRecorder(config.replayWindowMs ?? DEFAULT_REPLAY_WINDOW_MS)
  }

  start(): void {
    if (this.started) return
    this.started = true
    if (this.config.enableReplay) {
      this.recorder.start()
    }
  }

  getSessionId(): string {
    return this.sessionId
  }

  addBreadcrumb(
    category: 'navigation' | 'click' | 'http' | 'log' | 'custom',
    message: string,
    data?: Record<string, unknown>,
    level?: ObsSeverity,
  ): void {
    this.breadcrumbs.add(category, message, data, level)
  }

  installAxios(instance: ObsAxiosInstance): void {
    installAxiosInterceptors(instance, {
      newCorrelationId: () => generateCorrelationId(),
      onRequest: (info) => {
        this.breadcrumbs.add('http', `${info.method} ${info.url}`)
      },
      onResponseError: (info) => {
        const level: ObsSeverity = info.status && info.status >= 500 ? 'error' : 'warning'
        this.breadcrumbs.add(
          'http',
          `${info.method} ${info.url} -> ${info.status ?? info.code ?? 'ERR'}`,
          { status: info.status, durationMs: info.durationMs },
          level,
        )
        if (!info.status && info.offline) return
        const event = this.buildEvent({
          eventType: 'http_error',
          severity: level,
          message: `HTTP ${info.status ?? info.code ?? 'error'} ${info.method} ${info.url}`,
          errorType: info.code,
          httpStatus: info.status,
          httpMethod: info.method,
          url: info.url,
          durationMs: info.durationMs,
          correlationId: info.correlationId,
        })
        this.queue.enqueue(event)
      },
    })
  }

  captureException(error: unknown, options?: ObsCaptureOptions): void {
    const normalized = normalizeError(error)
    const event = this.buildEvent({
      eventType: options?.eventType ?? 'error',
      severity: options?.severity ?? 'error',
      message: normalized.message,
      errorType: normalized.name,
      stacktrace: normalized.stack,
      context: options?.extra,
      tags: options?.tags,
    })
    const withReplay = options?.withReplay ?? true
    if (withReplay) {
      void this.captureWithReplay(event)
    } else {
      this.queue.enqueue(event)
      void this.queue.flush()
    }
  }

  captureMessage(message: string, severity: ObsSeverity = 'info', options?: ObsCaptureOptions): void {
    const event = this.buildEvent({
      eventType: options?.eventType ?? 'log',
      severity,
      message,
      context: options?.extra,
      tags: options?.tags,
    })
    this.queue.enqueue(event)
  }

  flush(): void {
    void this.queue.flush()
  }

  flushOnUnload(): void {
    this.queue.flushOnUnload()
  }

  private buildEvent(
    partial: Partial<ObsEvent> & { eventType: ObsEvent['eventType']; severity: ObsSeverity; message: string },
  ): ObsEvent {
    return {
      platform: this.config.platform,
      environment: this.config.environment ?? 'dev',
      release: this.config.release,
      sessionId: this.sessionId,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: currentUrl(),
      user: this.resolveUser(),
      device: collectDevice(),
      breadcrumbs: this.breadcrumbs.snapshot(),
      tags: {},
      timestamp: Date.now(),
      ...partial,
    }
  }

  private resolveUser() {
    try {
      return normalizeUser(this.config.getUser?.())
    } catch {
      return undefined
    }
  }

  private canUploadReplay(): boolean {
    if (!this.config.enableReplay || !this.recorder.isActive()) return false
    const max = this.config.maxReplaysPerSession ?? DEFAULT_MAX_REPLAYS
    if (this.replayCount >= max) return false
    if (Date.now() - this.lastReplayAt < REPLAY_MIN_INTERVAL_MS) return false
    return true
  }

  private async captureWithReplay(event: ObsEvent): Promise<void> {
    let replayId: string | undefined
    try {
      if (this.canUploadReplay()) {
        const events = this.recorder.getEvents()
        if (events.length > 1) {
          const durationMs = this.recorder.getDurationMs()
          const blob = await gzipJson(events)
          if (blob && blob.size <= MAX_REPLAY_BYTES) {
            this.lastReplayAt = Date.now()
            const id = await uploadReplay(this.config, blob, {
              sessionId: this.sessionId,
              durationMs,
            })
            if (id) {
              replayId = id
              this.replayCount += 1
            }
          }
        }
      }
    } catch {
      /* noop */
    }
    if (replayId) event.replayId = replayId
    this.queue.enqueue(event)
    void this.queue.flush()
  }
}
