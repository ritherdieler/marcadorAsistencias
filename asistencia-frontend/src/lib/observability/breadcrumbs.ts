import type { Breadcrumb, BreadcrumbCategory, ObsSeverity } from './types'

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
    this.items.push({ category, message, data, level, timestamp: Date.now() })
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
