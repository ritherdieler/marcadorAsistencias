import { ObservabilityClient } from './client'
import { installGlobalHandlers } from './globalHandlers'
import { initWebVitals } from './webVitals'
import { readObsEnv } from './env'
import type { ObsAxiosInstance } from './axiosIntegration'
import type { ObsCaptureOptions, ObsConfig, ObsSeverity } from './types'

let client: ObservabilityClient | null = null

export function initObservability(config: ObsConfig): ObservabilityClient | null {
  if (client) return client
  if (config.enabled === false) return null
  if (!config.baseUrl || !config.apiKey) {
    if (config.debug) {
      console.debug('[observability] deshabilitado: falta baseUrl o apiKey')
    }
    return null
  }
  if (typeof window === 'undefined') return null
  try {
    const instance = new ObservabilityClient(config)
    installGlobalHandlers(instance)
    instance.start()
    client = instance
    return instance
  } catch {
    return null
  }
}

export function getObservability(): ObservabilityClient | null {
  return client
}

export function installAxiosObservability(instance: ObsAxiosInstance): void {
  client?.installAxios(instance)
}

export function captureException(error: unknown, options?: ObsCaptureOptions): void {
  client?.captureException(error, options)
}

export function captureMessage(message: string, severity?: ObsSeverity, options?: ObsCaptureOptions): void {
  client?.captureMessage(message, severity, options)
}

export function addBreadcrumb(
  category: 'navigation' | 'click' | 'http' | 'log' | 'custom',
  message: string,
  data?: Record<string, unknown>,
): void {
  client?.addBreadcrumb(category, message, data)
}

export { readObsEnv }
export { initWebVitals }
export { REPLAY_BLOCK_CLASS, REPLAY_MASK_CLASS } from './replay'
export type { ObsAxiosInstance } from './axiosIntegration'
export type { ObsConfig, ObsCaptureOptions, ObsSeverity } from './types'
export type { ObsEnvConfig } from './env'
