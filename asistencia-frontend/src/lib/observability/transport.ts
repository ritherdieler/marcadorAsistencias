import type { ObsConfig, ObsEvent } from './types'

const EVENTS_PATH = '/observability/events'
const REPLAYS_PATH = '/observability/replays'

function eventsUrl(config: ObsConfig): string {
  return `${config.baseUrl}${EVENTS_PATH}`
}

function replaysUrl(config: ObsConfig, query: string): string {
  return `${config.baseUrl}${REPLAYS_PATH}?${query}`
}

export async function sendEvents(
  config: ObsConfig,
  events: ObsEvent[],
  keepalive: boolean,
): Promise<boolean> {
  if (!config.baseUrl || !config.apiKey || events.length === 0) return false
  try {
    const response = await fetch(eventsUrl(config), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Obs-Api-Key': config.apiKey,
      },
      body: JSON.stringify({ events }),
      keepalive,
      credentials: 'omit',
    })
    return response.ok
  } catch {
    return false
  }
}

export function sendEventsBeacon(config: ObsConfig, events: ObsEvent[]): boolean {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return false
    const blob = new Blob([JSON.stringify({ events })], { type: 'application/json' })
    return navigator.sendBeacon(eventsUrl(config), blob)
  } catch {
    return false
  }
}

export interface ReplayUploadParams {
  sessionId: string
  eventId?: string
  issueId?: string
  durationMs?: number
}

export async function uploadReplay(
  config: ObsConfig,
  gzipBlob: Blob,
  params: ReplayUploadParams,
): Promise<string | null> {
  if (!config.baseUrl || !config.apiKey) return null
  try {
    const query = new URLSearchParams()
    query.set('sessionId', params.sessionId)
    query.set('platform', config.platform)
    if (params.eventId) query.set('eventId', params.eventId)
    if (params.issueId) query.set('issueId', params.issueId)
    if (typeof params.durationMs === 'number') {
      query.set('durationMs', String(Math.round(params.durationMs)))
    }
    const form = new FormData()
    form.append('file', gzipBlob, `replay-${params.sessionId}.json.gz`)
    const response = await fetch(replaysUrl(config, query.toString()), {
      method: 'POST',
      headers: {
        'X-Obs-Api-Key': config.apiKey,
      },
      body: form,
      credentials: 'omit',
    })
    if (!response.ok) return null
    const data = (await response.json().catch(() => null)) as { id?: string } | null
    return data && typeof data.id === 'string' ? data.id : null
  } catch {
    return null
  }
}
