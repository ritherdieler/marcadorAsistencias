import { FACE_CONFIG_SECTIONS, type FaceConfigSectionId } from './faceConfigSections'

type FaceConfigSectionNavProps = {
  activeSection: FaceConfigSectionId
  onSectionChange: (section: FaceConfigSectionId) => void
  pendingBySection: Partial<Record<FaceConfigSectionId, boolean>>
}

export function FaceConfigSectionNav({
  activeSection,
  onSectionChange,
  pendingBySection,
}: FaceConfigSectionNavProps) {
  return (
    <nav aria-label="Secciones de configuracion facial">
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
      >
        {FACE_CONFIG_SECTIONS.map((section) => {
          const selected = activeSection === section.id
          const hasPending = pendingBySection[section.id] === true
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              id={`face-config-tab-${section.id}`}
              aria-selected={selected}
              aria-controls={section.panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSectionChange(section.id)}
              className={[
                'flex min-w-[11rem] shrink-0 items-start gap-2 rounded-xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 lg:min-w-0 lg:w-full',
                selected
                  ? 'border-brand-blue bg-brand-blue/10 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
              ].join(' ')}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-900">{section.label}</span>
                <span className="mt-0.5 block text-xs text-slate-600">{section.hint}</span>
              </span>
              {hasPending && (
                <span
                  className="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full bg-amber-500"
                  aria-label="Cambios pendientes en esta seccion"
                />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
