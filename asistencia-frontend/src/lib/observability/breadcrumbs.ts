import type { Breadcrumb, BreadcrumbCategory, ObsSeverity } from './types'

export const BREADCRUMB_MAX_MESSAGE_CHARS = 300

export const BREADCRUMB_MAX_DATA_CHARS = 1000

export class BreadcrumbBuffer {
  private items: Breadcrumb[] = []

  private readonly max: number

  constructor(max: number) {
    this.max = Math.max(1, max)
  }

  add(
    category: BreadcrumbCategory,
    message: string,
    data?: Record<string, unknown>,
    level?: ObsSeverity,
  ): void {
    this.items.push({
      category,
      message: message.slice(0, BREADCRUMB_MAX_MESSAGE_CHARS),
      data: boundData(data),
      level,
      timestamp: Date.now(),
    })
    if (this.items.length > this.max) {
      this.items.splice(0, this.items.length - this.max)
    }
  }

  snapshot(): Breadcrumb[] {
    return this.items.slice()
  }

  clear(): void {
    this.items = []
  }
}

function boundData(data?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!data) return undefined
  let serialized: string
  try {
    serialized = JSON.stringify(data)
  } catch {
    return undefined
  }
  if (!serialized) return undefined
  return serialized.length > BREADCRUMB_MAX_DATA_CHARS ? { truncated: true } : data
}
