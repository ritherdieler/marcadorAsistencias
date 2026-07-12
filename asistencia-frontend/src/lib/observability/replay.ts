import { record } from 'rrweb'
import type { eventWithTime, listenerHandler } from '@rrweb/types'

export const REPLAY_BLOCK_CLASS = 'rr-block'
export const REPLAY_MASK_CLASS = 'rr-mask'

const MIN_CHECKOUT_MS = 20000

export class ReplayRecorder {
  private buffers: eventWithTime[][] = [[]]

  private stopFn: listenerHandler | undefined

  private readonly windowMs: number

  constructor(windowMs: number) {
    this.windowMs = Math.max(30000, windowMs)
  }

  start(): void {
    if (this.stopFn) return
    try {
      const checkout = Math.max(MIN_CHECKOUT_MS, Math.floor(this.windowMs / 2))
      this.stopFn = record({
        emit: (event, isCheckout) => {
          if (isCheckout) {
            this.buffers.push([])
          }
          this.buffers[this.buffers.length - 1].push(event)
          while (this.buffers.length > 2) {
            this.buffers.shift()
          }
        },
        checkoutEveryNms: checkout,
        maskAllInputs: true,
        blockClass: REPLAY_BLOCK_CLASS,
        maskTextClass: REPLAY_MASK_CLASS,
        recordCanvas: false,
        collectFonts: false,
        inlineImages: false,
        sampling: {
          mousemove: 100,
          scroll: 150,
        },
      })
    } catch {
      this.stopFn = undefined
    }
  }

  stop(): void {
    try {
      this.stopFn?.()
    } catch {
      /* noop */
    }
    this.stopFn = undefined
    this.buffers = [[]]
  }

  isActive(): boolean {
    return this.stopFn !== undefined
  }

  getEvents(): eventWithTime[] {
    const flat: eventWithTime[] = []
    for (const buffer of this.buffers) {
      for (const event of buffer) {
        flat.push(event)
      }
    }
    return flat
  }

  getDurationMs(): number {
    const events = this.getEvents()
    if (events.length < 2) return 0
    return events[events.length - 1].timestamp - events[0].timestamp
  }
}
