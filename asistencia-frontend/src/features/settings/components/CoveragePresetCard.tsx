type CoveragePresetCardProps = {
  label: string
  percent: number
  description: string
  selected: boolean
  onSelect: () => void
  badge?: string
}

export function CoveragePresetCard({ label, percent, description, selected, onSelect, badge }: CoveragePresetCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={[
        'rounded-xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40',
        selected
          ? 'border-brand-blue bg-brand-blue/10 shadow-sm'
          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-slate-900">{label}</span>
        <span className={['rounded-full px-2 py-0.5 text-xs font-black', selected ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-600'].join(' ')}>
          {badge ?? `${percent}%`}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-600">{description}</p>
    </button>
  )
}
