type AlertVariant = 'info' | 'success' | 'warning' | 'error' // Tipos de alerta soportados

// Componente de alerta simple (para notificaciones y validaciones). // UI
export function Alert({ variant, message }: { variant: AlertVariant; message: string }) {
  const styles: Record<AlertVariant, string> = {
    info: 'border-slate-200 bg-slate-50 text-slate-700', // Informativo
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800', // Éxito
    warning: 'border-amber-200 bg-amber-50 text-amber-900', // Advertencia
    error: 'border-red-200 bg-red-50 text-red-700', // Error
  }

  return <div className={`rounded-md border p-3 text-sm ${styles[variant]}`}>{message}</div>
}

