const TIPS = [
  'Busca un lugar bien iluminado y colocate de frente a la luz.',
  'Quitate lentes, gorra o mascarilla antes de capturar.',
  'Manten una expresion neutra y el rostro descubierto.',
  'Coloca el rostro dentro del marco y sigue las indicaciones en pantalla.',
]

function TipIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden="true"
    >
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function EnrollmentTips() {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="text-sm font-bold text-slate-900">Para una mejor captura</h4>
      <ul className="mt-3 space-y-2">
        {TIPS.map((tip) => (
          <li key={tip} className="flex items-start gap-2 text-sm leading-5 text-slate-600">
            <TipIcon />
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
