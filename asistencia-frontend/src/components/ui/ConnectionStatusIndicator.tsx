import { useEffect, useRef, useState } from 'react'

import type { ConnectionStatus } from '../../hooks/useNetworkStatus'

type ConnectionStatusIndicatorProps = {
  status: ConnectionStatus
  pendingSyncCount: number
  compact?: boolean
  className?: string
}

function statusLabel(status: ConnectionStatus, pendingSyncCount: number, compact: boolean): string {
  if (status === 'initializing') {
    return compact ? 'Preparando' : 'Preparando sistema...'
  }

  if (status === 'syncing') {
    if (pendingSyncCount > 0) {
      return compact
        ? `Sync ${pendingSyncCount}`
        : `Sincronizando ${pendingSyncCount} marcacion${pendingSyncCount === 1 ? '' : 'es'}`
    }
    return compact ? 'Sincronizando' : 'Sincronizando datos...'
  }

  if (status === 'offline') {
    if (pendingSyncCount > 0) {
      return compact ? `Offline · ${pendingSyncCount}` : `Sin conexion · ${pendingSyncCount} pendiente${pendingSyncCount === 1 ? '' : 's'}`
    }
    return compact ? 'Offline' : 'Sin conexion'
  }

  return compact ? 'En linea' : 'En linea'
}

function statusStyles(status: ConnectionStatus, emphasized: boolean): string {
  if (status === 'initializing') {
    return [
      'border-brand-blue/25 bg-gradient-to-r from-sky-50 via-white to-sky-50 text-brand-blue',
      'bg-[length:220%_100%] motion-safe:animate-shimmer',
      emphasized ? 'motion-safe:animate-sync-pulse shadow-md ring-2 ring-brand-blue/15' : 'shadow-sm',
    ].join(' ')
  }

  if (status === 'syncing') {
    return [
      'border-sky-200 bg-sky-50 text-sky-900',
      emphasized ? 'motion-safe:animate-sync-pulse shadow-md ring-2 ring-sky-200/80' : 'shadow-sm',
    ].join(' ')
  }

  if (status === 'offline') return 'border-amber-200 bg-amber-50 text-amber-900 shadow-sm'
  return 'border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm'
}

export function ConnectionStatusIndicator({
  status,
  pendingSyncCount,
  compact = false,
  className = '',
}: ConnectionStatusIndicatorProps) {
  const previousStatusRef = useRef<ConnectionStatus>(status)
  const [emphasized, setEmphasized] = useState(status === 'initializing' || status === 'syncing')

  useEffect(() => {
    const previousStatus = previousStatusRef.current
    previousStatusRef.current = status

    const enteredActiveState =
      (status === 'initializing' || status === 'syncing')
      && previousStatus !== status

    if (enteredActiveState || status === 'initializing' || status === 'syncing') {
      setEmphasized(true)
      return undefined
    }

    const timer = window.setTimeout(() => setEmphasized(false), 500)
    return () => window.clearTimeout(timer)
  }, [status])

  const label = statusLabel(status, pendingSyncCount, compact)
  const subtitle = status === 'offline' && pendingSyncCount === 0 && !compact ? 'Modo offline' : null
  const showProgress = status === 'initializing' || status === 'syncing'

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={status === 'initializing' || status === 'syncing'}
      aria-label={subtitle ? `${label}. ${subtitle}` : label}
      className={[
        'relative inline-flex items-center gap-2 overflow-hidden rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-300 motion-safe:animate-badge-enter',
        statusStyles(status, emphasized),
        className,
      ].join(' ')}
    >
      {status === 'initializing' ? (
        <span
          className="relative flex h-2.5 w-2.5 items-center justify-center motion-safe:animate-dot-pulse"
          aria-hidden="true"
        >
          <span className="absolute inset-0 rounded-full bg-brand-blue/25" />
          <span className="h-1.5 w-1.5 rounded-full bg-brand-blue" />
        </span>
      ) : status === 'syncing' ? (
        <span
          className="h-2.5 w-2.5 motion-safe:animate-spin rounded-full border-2 border-sky-300 border-t-sky-700"
          aria-hidden="true"
        />
      ) : (
        <span
          className={[
            'h-2.5 w-2.5 rounded-full',
            status === 'offline' ? 'bg-amber-500' : 'bg-emerald-500',
          ].join(' ')}
          aria-hidden="true"
        />
      )}
      <span className="leading-none">
        {label}
        {subtitle ? <span className="ml-1 font-medium opacity-80">· {subtitle}</span> : null}
      </span>
      {showProgress ? (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-black/5" aria-hidden="true">
          <span className="block h-full w-1/3 rounded-full bg-sky-500/70 motion-safe:animate-progress-slide" />
        </span>
      ) : null}
    </div>
  )
}
