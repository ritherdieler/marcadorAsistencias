import type { ObsConfig, ObsEvent } from './types'
import { sendEvents, sendEventsBeacon } from './transport'

const DEFAULT_FLUSH_INTERVAL_MS = 5000
const DEFAULT_BATCH_SIZE = 30
const DEFAULT_QUEUE_LIMIT = 200

export class EventQueue {
  private queue: ObsEvent[] = []

  private timer: number | null = null

  private sending = false

  private readonly config: ObsConfig

  constructor(config: ObsConfig) {
    this.config = config
  }

  enqueue(event: ObsEvent): void {
    const limit = this.config.maxQueueSize ?? DEFAULT_QUEUE_LIMIT
    this.queue.push(event)
    if (this.queue.length > limit) {
      this.queue.splice(0, this.queue.length - limit)
    }
    this.scheduleFlush()
  }

  private scheduleFlush(): void {
    if (this.timer !== null) return
    const interval = this.config.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS
    this.timer = window.setTimeout(() => {
      this.timer = null
      void this.flush()
    }, interval)
  }

  async flush(): Promise<void> {
    if (this.sending || this.queue.length === 0) return
    this.sending = true
    const batchSize = this.config.maxBatchSize ?? DEFAULT_BATCH_SIZE
    try {
      while (this.queue.length > 0) {
        const batch = this.queue.slice(0, batchSize)
        const ok = await sendEvents(this.config, batch, false)
        if (!ok) break
        this.queue.splice(0, batch.length)
      }
    } finally {
      this.sending = false
    }
  }

  flushOnUnload(): void {
    if (this.queue.length === 0) return
    const batchSize = this.config.maxBatchSize ?? DEFAULT_BATCH_SIZE
    const batch = this.queue.slice(0, batchSize)
    if (typeof fetch === 'function') {
      void sendEvents(this.config, batch, true)
    } else {
      sendEventsBeacon(this.config, batch)
    }
    this.queue.splice(0, batch.length)
  }
}
