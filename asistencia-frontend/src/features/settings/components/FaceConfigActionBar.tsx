import { LoadingButton } from '../../../components/ui/LoadingButton'

type FaceConfigActionBarProps = {
  hasPendingChanges: boolean
  saving: boolean
  onSave: () => void
  onReset: () => void
}

export function FaceConfigActionBar({ hasPendingChanges, saving, onSave, onReset }: FaceConfigActionBarProps) {
  return (
    <div
      className={[
        'sticky bottom-0 z-10 -mx-4 border-t bg-white/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border lg:rounded-2xl lg:px-5 lg:py-4 lg:shadow-none',
        hasPendingChanges ? 'border-amber-200 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]' : 'border-slate-200',
      ].join(' ')}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-h-6">
          {hasPendingChanges ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              <span className="inline-flex h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
              Cambios pendientes
            </span>
          ) : (
            <span className="text-xs text-slate-500">Sin cambios pendientes</span>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
          <LoadingButton type="button" variant="dark" onClick={onReset} disabled={saving}>
            Restablecer recomendados
          </LoadingButton>
          <LoadingButton
            type="button"
            onClick={onSave}
            loading={saving}
            loadingText="Guardando..."
            disabled={!hasPendingChanges}
          >
            Guardar configuracion
          </LoadingButton>
        </div>
      </div>
    </div>
  )
}
