import { useEffect, useMemo, useState } from 'react'

import { ModalAlert } from '../../../components/ui/ModalAlert'
import { AttendanceHolidaysManager } from '../components/AttendanceHolidaysManager'
import { AttendanceMarkingManager } from '../components/AttendanceMarkingManager'
import { AttendanceScheduleInfo } from '../components/AttendanceScheduleInfo'
import { FaceConfigActionBar } from '../components/FaceConfigActionBar'
import { useAttendanceScheduleConfig } from '../hooks/useAttendanceScheduleConfig'
import {
  attendanceScheduleConfigsEqual,
  getCheckInLabel,
  type AttendanceScheduleConfig,
} from '../services/attendanceScheduleConfig'

export function AdminSchedulePage() {
  const { config, save, reset } = useAttendanceScheduleConfig()
  const [draft, setDraft] = useState<AttendanceScheduleConfig>(() => ({ ...config }))
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState<{ variant: 'success' | 'info'; message: string } | null>(null)

  const hasPendingChanges = useMemo(
    () => !attendanceScheduleConfigsEqual(draft, config),
    [config, draft],
  )

  useEffect(() => {
    setDraft({ ...config })
  }, [config])

  const handleSave = async () => {
    setSaving(true)
    try {
      save(draft)
      setAlert({
        variant: 'success',
        message: `Horario guardado: ingreso ${getCheckInLabel(draft)} con ${draft.toleranceMinutes} min de tolerancia. Se aplicara en este navegador al marcar asistencia.`,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    const defaults = reset()
    setDraft({ ...defaults })
    setAlert({
      variant: 'info',
      message: `Horario restaurado: ingreso ${getCheckInLabel(defaults)} con ${defaults.toleranceMinutes} min de tolerancia.`,
    })
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configuracion</h1>
        <p className="mt-1 text-sm text-slate-600">
          Horario de ingreso, tolerancia de tardanzas, quien debe marcar en el kiosko y feriados del sector privado
          usados por el reporte de asistencias en este navegador.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <AttendanceScheduleInfo draft={draft} onDraftChange={setDraft} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <AttendanceMarkingManager />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <AttendanceHolidaysManager />
      </section>

      <FaceConfigActionBar
        hasPendingChanges={hasPendingChanges}
        saving={saving}
        onSave={() => void handleSave()}
        onReset={handleReset}
      />

      {alert && <ModalAlert variant={alert.variant} message={alert.message} onClose={() => setAlert(null)} />}
    </div>
  )
}
