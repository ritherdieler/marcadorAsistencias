export type EnrollmentStep = {
  key: string
  label: string
}

type EnrollmentStepsProps = {
  steps: EnrollmentStep[]
  currentKey: string
}

export function EnrollmentSteps({ steps, currentKey }: EnrollmentStepsProps) {
  const currentIndex = steps.findIndex((step) => step.key === currentKey)

  return (
    <ol className="grid gap-2 sm:grid-cols-4">
      {steps.map((step, index) => {
        const isCurrent = step.key === currentKey
        const isDone = index < currentIndex

        return (
          <li
            key={step.key}
            aria-current={isCurrent ? 'step' : undefined}
            className={[
              'rounded-lg border px-3 py-2 text-xs font-semibold',
              isCurrent
                ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                : isDone
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-slate-50 text-slate-500',
            ].join(' ')}
          >
            {index + 1}. {step.label}
          </li>
        )
      })}
    </ol>
  )
}
