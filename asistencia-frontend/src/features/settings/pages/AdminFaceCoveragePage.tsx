import { useEffect, useMemo, useState } from 'react'

import { ModalAlert } from '../../../components/ui/ModalAlert'
import { useFaceCoverageConfig } from '../../recognition/hooks/useFaceCoverageConfig'
import {
  clampTargetPercent,
  DEFAULT_FACE_COVERAGE_CONFIG,
  faceCoverageConfigsEqual,
  type FaceCoverageConfig,
  type FaceCoverageFlow,
} from '../../recognition/services/faceAlignmentConfig'
import { FaceCoverageControls } from '../components/FaceCoverageControls'
import { FaceCoveragePreview } from '../components/FaceCoveragePreview'

export function AdminFaceCoveragePage() {
  const { config, save, reset } = useFaceCoverageConfig()
  const [draft, setDraft] = useState<FaceCoverageConfig>(() => ({ ...config, attendance: { ...config.attendance }, registration: { ...config.registration } }))
  const [activeFlow, setActiveFlow] = useState<FaceCoverageFlow>('attendance')
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState<{ variant: 'success' | 'info'; message: string } | null>(null)

  const hasPendingChanges = useMemo(() => !faceCoverageConfigsEqual(draft, config), [config, draft])

  useEffect(() => {
    setDraft({
      attendance: { ...config.attendance },
      registration: { ...config.registration },
    })
  }, [config])

  const updateTarget = (flow: FaceCoverageFlow, percent: number) => {
    setDraft((current) => ({
      ...current,
      [flow]: { targetWidthPercent: clampTargetPercent(percent) },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      save(draft)
      setAlert({ variant: 'success', message: 'Configuracion facial guardada. Se aplicara en marcacion y registro.' })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    const defaults = reset()
    setDraft({
      attendance: { ...defaults.attendance },
      registration: { ...defaults.registration },
    })
    setAlert({
      variant: 'info',
      message: `Valores recomendados restaurados: marcacion ${DEFAULT_FACE_COVERAGE_CONFIG.attendance.targetWidthPercent}%, registro ${DEFAULT_FACE_COVERAGE_CONFIG.registration.targetWidthPercent}%.`,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configuracion facial</h1>
        <p className="mt-1 text-sm text-slate-600">
          Ajusta de forma interactiva la cobertura minima del rostro para marcacion y registro. Los cambios se guardan en este navegador.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="order-2 xl:order-1">
          <FaceCoverageControls
            activeFlow={activeFlow}
            draft={draft}
            hasPendingChanges={hasPendingChanges}
            saving={saving}
            onFlowChange={setActiveFlow}
            onTargetChange={updateTarget}
            onSave={() => void handleSave()}
            onReset={handleReset}
          />
        </section>

        <section className="order-1 xl:order-2">
          <FaceCoveragePreview activeFlow={activeFlow} targetWidthPercent={draft[activeFlow].targetWidthPercent} />
        </section>
      </div>

      {alert && <ModalAlert variant={alert.variant} message={alert.message} onClose={() => setAlert(null)} />}
    </div>
  )
}
