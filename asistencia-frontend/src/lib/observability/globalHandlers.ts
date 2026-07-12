import type { ObservabilityClient } from './client'

function describeElement(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null
  const tag = target.tagName.toLowerCase()
  const id = target.id ? `#${target.id}` : ''
  const cls =
    typeof target.className === 'string' && target.className
      ? `.${target.className.trim().split(/\s+/).slice(0, 2).join('.')}`
      : ''
  const label = target.getAttribute('aria-label') ?? undefined
  const text = target instanceof HTMLElement ? target.innerText?.trim().slice(0, 40) : undefined
  const descriptor = label || text || ''
  return `${tag}${id}${cls}${descriptor ? ` "${descriptor}"` : ''}`
}

export function installGlobalHandlers(client: ObservabilityClient): void {
  if (typeof window === 'undefined') return

  window.addEventListener('error', (event) => {
    if (event.error instanceof Error) {
      client.captureException(event.error, { severity: 'error' })
    } else if (typeof event.message === 'string' && event.target === window) {
      client.captureException(event.message, { severity: 'error' })
    }
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    client.captureException(reason instanceof Error ? reason : String(reason), {
      severity: 'error',
      eventType: 'error',
    })
  })

  document.addEventListener(
    'click',
    (event) => {
      const descriptor = describeElement(event.target)
      if (descriptor) {
        client.addBreadcrumb('click', descriptor)
      }
    },
    { capture: true },
  )

  const emitNavigation = (to: string) => client.addBreadcrumb('navigation', to)
  const history = window.history
  const originalPush = history.pushState.bind(history)
  const originalReplace = history.replaceState.bind(history)
  history.pushState = function pushState(...args) {
    const result = originalPush(...(args as Parameters<History['pushState']>))
    try {
      emitNavigation(String(args[2] ?? location.pathname))
    } catch {
      /* noop */
    }
    return result
  }
  history.replaceState = function replaceState(...args) {
    const result = originalReplace(...(args as Parameters<History['replaceState']>))
    try {
      emitNavigation(String(args[2] ?? location.pathname))
    } catch {
      /* noop */
    }
    return result
  }
  window.addEventListener('popstate', () => emitNavigation(location.pathname))

  const flushUnload = () => client.flushOnUnload()
  window.addEventListener('pagehide', flushUnload)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushUnload()
    }
  })
}
