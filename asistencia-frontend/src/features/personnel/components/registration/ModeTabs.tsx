import type { KeyboardEvent } from 'react'

export type RegistrationMode = 'EXISTENTE' | 'NUEVO'

type ModeTabsProps = {
  mode: RegistrationMode
  onChange: (mode: RegistrationMode) => void
}

const TABS: { id: RegistrationMode; label: string }[] = [
  { id: 'EXISTENTE', label: 'Existente' },
  { id: 'NUEVO', label: 'Nuevo' },
]

export function ModeTabs({ mode, onChange }: ModeTabsProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const index = TABS.findIndex((tab) => tab.id === mode)
    const nextIndex =
      event.key === 'ArrowRight' ? (index + 1) % TABS.length : (index - 1 + TABS.length) % TABS.length
    onChange(TABS[nextIndex].id)
  }

  return (
    <div role="tablist" aria-label="Tipo de registro" className="inline-flex gap-2" onKeyDown={handleKeyDown}>
      {TABS.map((tab) => {
        const selected = mode === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={[
              'rounded-full px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40',
              selected ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
            ].join(' ')}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
