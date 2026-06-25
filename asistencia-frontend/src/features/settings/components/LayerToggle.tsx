type LayerToggleProps = {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}

export function LayerToggle({ label, checked, onChange }: LayerToggleProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <span className="text-sm font-medium text-slate-900">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40',
          checked ? 'bg-brand-blue' : 'bg-slate-300',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-5 w-5 transform rounded-full bg-white shadow transition',
            checked ? 'translate-x-5' : 'translate-x-1',
          ].join(' ')}
        />
      </button>
    </div>
  )
}
