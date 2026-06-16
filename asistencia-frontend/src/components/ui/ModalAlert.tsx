import { LoadingButton } from './LoadingButton'

export type ModalAlertVariant = 'info' | 'success' | 'warning' | 'error'

type ModalAlertProps = {
  variant: ModalAlertVariant
  message: string
  title?: string
  onClose: () => void
}

const variantStyles: Record<ModalAlertVariant, { bar: string; badge: string; title: string }> = {
  info: {
    bar: 'bg-brand-blue',
    badge: 'bg-brand-blue/10 text-brand-blue',
    title: 'Informacion',
  },
  success: {
    bar: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700',
    title: 'Operacion exitosa',
  },
  warning: {
    bar: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700',
    title: 'Revisa los datos',
  },
  error: {
    bar: 'bg-red-600',
    badge: 'bg-red-50 text-red-700',
    title: 'No se pudo completar',
  },
}

export function ModalAlert({ variant, title, message, onClose }: ModalAlertProps) {
  const styles = variantStyles[variant]

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className={`h-2 ${styles.bar}`} />
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-black ${styles.badge}`}>
              !
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-slate-950">{title ?? styles.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
            </div>
          </div>

          <LoadingButton type="button" variant="dark" className="mt-6 w-full" onClick={onClose}>
            Entendido
          </LoadingButton>
        </div>
      </div>
    </div>
  )
}
