import { useEffect } from 'react'

import type { ConnectionToast } from '../../hooks/useNetworkStatus'

type ConnectionStatusToastProps = {
  toast: ConnectionToast | null
  onDismiss: () => void
}

const AUTO_DISMISS_MS = 6000

function toastStyles(variant: ConnectionToast['variant']): string {
  return variant === 'offline'
    ? 'border-amber-200 bg-amber-50 text-amber-950'
    : 'border-emerald-200 bg-emerald-50 text-emerald-950'
}

function toastAccent(variant: ConnectionToast['variant']): string {
  return variant === 'offline' ? 'bg-amber-500' : 'bg-emerald-500'
}

export function ConnectionStatusToast({ toast, onDismiss }: ConnectionStatusToastProps) {
  useEffect(() => {
    if (!toast) return undefined

    const timer = window.setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [toast, onDismiss])

  if (!toast) return null

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="pointer-events-none fixed inset-x-0 top-4 z-[90] flex justify-center px-4"
    >
      <div
        className={[
          'pointer-events-auto w-full max-w-md overflow-hidden rounded-2xl border shadow-xl ring-1 ring-black/5 transition duration-300',
          toastStyles(toast.variant),
        ].join(' ')}
      >
        <div className={['h-1', toastAccent(toast.variant)].join(' ')} />
        <div className="flex items-start gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{toast.title}</p>
            <p className="mt-1 text-sm leading-6 opacity-90">{toast.message}</p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg px-2 py-1 text-xs font-semibold opacity-70 transition hover:bg-black/5 hover:opacity-100"
            aria-label="Cerrar notificacion"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
