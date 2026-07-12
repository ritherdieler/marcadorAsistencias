import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals'
import type { Metric } from 'web-vitals'
import type { ObsConfig } from './types'

const RUM_PATH = '/observability/rum'

interface RumVital {
  metricName: Metric['name']
  value: number
  rating: Metric['rating']
  page: string
  navigationType: Metric['navigationType']
  timestamp: number
}

function rumUrl(config: ObsConfig): string {
  return `${config.baseUrl}${RUM_PATH}`
}

function sendRumBeacon(config: ObsConfig, vitals: RumVital[]): boolean {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return false
    const blob = new Blob([JSON.stringify({ vitals })], { type: 'application/json' })
    return navigator.sendBeacon(rumUrl(config), blob)
  } catch {
    return false
  }
}

function sendRumFetch(config: ObsConfig, vitals: RumVital[]): void {
  try {
    if (typeof fetch !== 'function') return
    void fetch(rumUrl(config), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Obs-Api-Key': config.apiKey,
      },
      body: JSON.stringify({ vitals }),
      keepalive: true,
      credentials: 'omit',
    }).catch(() => undefined)
  } catch {
    /* noop */
  }
}

export function initWebVitals(config: ObsConfig): void {
  if (config.enabled === false) return
  if (!config.baseUrl || !config.apiKey) return
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const queue: RumVital[] = []

  const report = (metric: Metric): void => {
    queue.push({
      metricName: metric.name,
      value: metric.value,
      rating: metric.rating,
      page: window.location.pathname,
      navigationType: metric.navigationType,
      timestamp: Date.now(),
    })
  }

  try {
    onLCP(report)
    onINP(report)
    onCLS(report)
    onFCP(report)
    onTTFB(report)
  } catch {
    return
  }

  const flush = (): void => {
    if (queue.length === 0) return
    const batch = queue.splice(0, queue.length)
    if (typeof fetch === 'function') {
      sendRumFetch(config, batch)
    } else {
      sendRumBeacon(config, batch)
    }
  }

  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') flush()
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', flush)
}
