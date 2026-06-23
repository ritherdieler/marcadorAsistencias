import { useState } from 'react'

type PasswordFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  name?: string
  autoComplete?: string
  accent?: 'blue' | 'orange'
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      {open ? (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M3 3l18 18" strokeLinecap="round" strokeLinejoin="round" />
          <path
            d="M10.6 6.1A9.7 9.7 0 0 1 12 6c6.5 0 10 7 10 7a17.4 17.4 0 0 1-3.2 4M6.6 6.6A17.4 17.4 0 0 0 2 13s3.5 7 10 7a9.7 9.7 0 0 0 4.2-.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  )
}

export function PasswordField({
  label,
  value,
  onChange,
  name,
  autoComplete = 'current-password',
  accent = 'blue',
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  const ringClass = accent === 'orange' ? 'focus:ring-brand-orange/20' : 'focus:ring-brand-blue/20'

  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="relative mt-1">
        <input
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          className={[
            'w-full rounded-md border border-slate-200 bg-white px-3 py-2 pr-10 text-sm outline-none focus:ring-2',
            ringClass,
          ].join(' ')}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-pressed={visible}
          aria-label={visible ? 'Ocultar contrasena' : 'Mostrar contrasena'}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:text-brand-blue"
        >
          <EyeIcon open={visible} />
        </button>
      </div>
    </label>
  )
}
