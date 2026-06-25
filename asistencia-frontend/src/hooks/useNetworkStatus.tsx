import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { ConnectionStatusIndicator } from '../components/ui/ConnectionStatusIndicator'
import { ConnectionStatusToast } from '../components/ui/ConnectionStatusToast'
import { getOfflineAttendanceCount } from '../services/offlineAttendanceQueue'
import { refreshOfflineFaceDataset } from '../services/offlineFaceDataset'
import { registerConnectionReporter } from '../services/httpClient'

export type ConnectionStatus = 'initializing' | 'online' | 'offline' | 'syncing'

const INITIAL_INDICATOR_MIN_MS = 900
const INITIAL_INDICATOR_MAX_MS = 4000

export type ConnectionToastVariant = 'offline' | 'online'

export type ConnectionToast = {
  id: string
  variant: ConnectionToastVariant
  title: string
  message: string
}

type NetworkStatusContextValue = {
  status: ConnectionStatus
  isOnline: boolean
  isInitializing: boolean
  isSyncing: boolean
  pendingSyncCount: number
  refreshPendingSyncCount: () => Promise<void>
  setSyncing: (value: boolean) => void
  reportConnectionError: () => void
  reportConnectionSuccess: () => void
}

const NetworkStatusContext = createContext<NetworkStatusContextValue | null>(null)

const TRANSITION_DEBOUNCE_MS = 300

function resolveIsOnline(browserOnline: boolean, backendUnreachable: boolean): boolean {
  return browserOnline && !backendUnreachable
}

function buildOnlineToast(pendingSyncCount: number): ConnectionToast {
  if (pendingSyncCount > 0) {
    return {
      id: crypto.randomUUID(),
      variant: 'online',
      title: 'Conexion restaurada',
      message: `Sincronizando ${pendingSyncCount} marcacion${pendingSyncCount === 1 ? '' : 'es'} pendiente${pendingSyncCount === 1 ? '' : 's'}.`,
    }
  }

  return {
    id: crypto.randomUUID(),
    variant: 'online',
    title: 'Conexion restaurada',
    message: 'El sistema volvio a estar en linea.',
  }
}

function buildOfflineToast(): ConnectionToast {
  return {
    id: crypto.randomUUID(),
    variant: 'offline',
    title: 'Conexion perdida',
    message: 'Se perdio la conexion. Puedes seguir marcando en modo offline.',
  }
}

export function NetworkStatusProvider({ children }: { children: ReactNode }) {
  const [browserOnline, setBrowserOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  const [backendUnreachable, setBackendUnreachable] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const [toast, setToast] = useState<ConnectionToast | null>(null)

  const transitionsEnabledRef = useRef(false)
  const previousOnlineRef = useRef(resolveIsOnline(browserOnline, backendUnreachable))
  const transitionTimerRef = useRef<number | null>(null)
  const pendingSyncCountRef = useRef(0)
  const backendUnreachableRef = useRef(backendUnreachable)

  backendUnreachableRef.current = backendUnreachable

  const isOnline = resolveIsOnline(browserOnline, backendUnreachable)
  const status: ConnectionStatus = isInitializing
    ? 'initializing'
    : isSyncing
      ? 'syncing'
      : isOnline
        ? 'online'
        : 'offline'

  const refreshPendingSyncCount = useCallback(async () => {
    const count = await getOfflineAttendanceCount()
    pendingSyncCountRef.current = count
    setPendingSyncCount(count)
  }, [])

  const dismissToast = useCallback(() => {
    setToast(null)
  }, [])

  const queueTransitionToast = useCallback((nextOnline: boolean) => {
    if (transitionTimerRef.current) {
      window.clearTimeout(transitionTimerRef.current)
    }

    transitionTimerRef.current = window.setTimeout(() => {
      if (!transitionsEnabledRef.current) {
        previousOnlineRef.current = nextOnline
        return
      }

      if (previousOnlineRef.current === nextOnline) return

      previousOnlineRef.current = nextOnline
      setToast(nextOnline ? buildOnlineToast(pendingSyncCountRef.current) : buildOfflineToast())
    }, TRANSITION_DEBOUNCE_MS)
  }, [])

  const applyOnlineState = useCallback(
    (nextBrowserOnline: boolean, nextBackendUnreachable: boolean) => {
      backendUnreachableRef.current = nextBackendUnreachable
      setBrowserOnline(nextBrowserOnline)
      setBackendUnreachable(nextBackendUnreachable)

      const nextOnline = resolveIsOnline(nextBrowserOnline, nextBackendUnreachable)
      queueTransitionToast(nextOnline)
    },
    [queueTransitionToast],
  )

  const reportConnectionError = useCallback(() => {
    applyOnlineState(typeof navigator !== 'undefined' ? navigator.onLine : true, true)
  }, [applyOnlineState])

  const reportConnectionSuccess = useCallback(() => {
    applyOnlineState(typeof navigator !== 'undefined' ? navigator.onLine : true, false)
  }, [applyOnlineState])

  const setSyncing = useCallback((value: boolean) => {
    setIsSyncing(value)
  }, [])

  useEffect(() => {
    pendingSyncCountRef.current = pendingSyncCount
  }, [pendingSyncCount])

  useEffect(() => {
    let cancelled = false

    const wait = (ms: number) => new Promise<void>((resolve) => {
      window.setTimeout(resolve, ms)
    })

    const initializeAppStatus = async () => {
      const startedAt = Date.now()

      try {
        await refreshPendingSyncCount()

        if (navigator.onLine) {
          await Promise.race([
            refreshOfflineFaceDataset().then(() => {
              reportConnectionSuccess()
            }),
            wait(INITIAL_INDICATOR_MAX_MS),
          ]).catch(() => undefined)
        }
      } finally {
        const elapsed = Date.now() - startedAt
        const remaining = INITIAL_INDICATOR_MIN_MS - elapsed
        if (remaining > 0) {
          await wait(remaining)
        }
        if (!cancelled) {
          setIsInitializing(false)
        }
      }
    }

    void initializeAppStatus()

    return () => {
      cancelled = true
    }
  }, [refreshPendingSyncCount, reportConnectionSuccess])

  useEffect(() => {
    void refreshPendingSyncCount()

    const handleBrowserOnline = () => {
      applyOnlineState(true, false)
      void refreshPendingSyncCount()
    }

    const handleBrowserOffline = () => {
      applyOnlineState(false, true)
      setIsSyncing(false)
    }

    const handleFocus = () => {
      void refreshPendingSyncCount()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      if (navigator.onLine) {
        applyOnlineState(true, backendUnreachableRef.current)
      }
      void refreshPendingSyncCount()
    }

    registerConnectionReporter({
      onError: reportConnectionError,
      onSuccess: reportConnectionSuccess,
    })

    window.addEventListener('online', handleBrowserOnline)
    window.addEventListener('offline', handleBrowserOffline)
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const enableTransitionsTimer = window.setTimeout(() => {
      transitionsEnabledRef.current = true
      previousOnlineRef.current = resolveIsOnline(navigator.onLine, backendUnreachableRef.current)
    }, 0)

    return () => {
      transitionsEnabledRef.current = false
      registerConnectionReporter(null)
      window.removeEventListener('online', handleBrowserOnline)
      window.removeEventListener('offline', handleBrowserOffline)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.clearTimeout(enableTransitionsTimer)
      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current)
      }
    }
  }, [applyOnlineState, refreshPendingSyncCount, reportConnectionError, reportConnectionSuccess])

  useEffect(() => {
    if (pendingSyncCount <= 0) return undefined

    const timer = window.setInterval(() => {
      void refreshPendingSyncCount()
    }, 5000)

    return () => window.clearInterval(timer)
  }, [pendingSyncCount, refreshPendingSyncCount])

  const value = useMemo<NetworkStatusContextValue>(
    () => ({
      status,
      isOnline,
      isInitializing,
      isSyncing,
      pendingSyncCount,
      refreshPendingSyncCount,
      setSyncing,
      reportConnectionError,
      reportConnectionSuccess,
    }),
    [
      status,
      isOnline,
      isInitializing,
      isSyncing,
      pendingSyncCount,
      refreshPendingSyncCount,
      setSyncing,
      reportConnectionError,
      reportConnectionSuccess,
    ],
  )

  return (
    <NetworkStatusContext.Provider value={value}>
      <div className="pointer-events-none fixed right-4 top-4 z-[85]">
        <ConnectionStatusIndicator
          status={status}
          pendingSyncCount={pendingSyncCount}
          className="pointer-events-auto"
        />
      </div>
      <ConnectionStatusToast toast={toast} onDismiss={dismissToast} />
      {children}
    </NetworkStatusContext.Provider>
  )
}

export function useNetworkStatus(): NetworkStatusContextValue {
  const context = useContext(NetworkStatusContext)
  if (!context) {
    throw new Error('useNetworkStatus must be used within NetworkStatusProvider')
  }
  return context
}
