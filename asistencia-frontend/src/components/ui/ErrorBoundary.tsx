import { Component, type ErrorInfo, type ReactNode } from 'react'

import { captureException } from '../../lib/observability'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error capturado por ErrorBoundary:', error, errorInfo)
    captureException(error, {
      severity: 'fatal',
      eventType: 'crash',
      extra: { componentStack: errorInfo.componentStack },
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
            <div className="h-2 bg-red-500" />
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-950">Algo salio mal</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Ocurrio un error inesperado. Recarga la pagina e intenta nuevamente.
              </p>
              {import.meta.env.DEV && this.state.error && (
                <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-slate-100 p-3 text-xs text-slate-600">
                  {this.state.error.toString()}
                </pre>
              )}
              <button
                type="button"
                onClick={this.handleReload}
                className="mt-6 w-full rounded-xl bg-brand-blue px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Recargar pagina
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
