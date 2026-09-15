import { useState } from 'react'

import { LoadingButton } from '../../../components/ui/LoadingButton'
import { useAttendanceHolidaysConfig } from '../hooks/useAttendanceHolidaysConfig'
import { isValidHolidayDateKey } from '../services/attendanceHolidaysConfig'

function formatHolidayDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (Number.isNaN(date.getTime())) return dateKey
  return date.toLocaleDateString('es-PE', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function AttendanceHolidaysManager() {
  const { holidays, add, remove } = useAttendanceHolidaysConfig()
  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleAdd() {
    setError(null)
    if (!isValidHolidayDateKey(date)) {
      setError('Selecciona una fecha valida.')
      return
    }

    if (holidays.some((item) => item.date === date)) {
      setError('Esa fecha ya esta registrada como feriado.')
      return
    }

    add({ date, name: name.trim() || undefined })
    setDate('')
    setName('')
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Feriados (sector privado)</h2>
        <p className="mt-1 text-sm text-slate-600">
          Los dias laborables configurados como feriado no cuentan como FALTO en el reporte de asistencias.
          La lista se guarda en este navegador.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_1.2fr_auto]">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Fecha</span>
          <input
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value)
              setError(null)
            }}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-blue/20"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Nombre (opcional)</span>
          <input
            type="text"
            value={name}
            placeholder="Ej. Fiestas Patrias"
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-blue/20"
          />
        </label>

        <div className="flex items-end">
          <LoadingButton type="button" className="w-full sm:w-auto" onClick={handleAdd}>
            Agregar
          </LoadingButton>
        </div>
      </div>

      {error && <p className="text-sm font-medium text-rose-700">{error}</p>}

      {holidays.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          Aun no hay feriados configurados.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
          {holidays.map((holiday) => (
            <li key={holiday.date} className="flex items-center justify-between gap-3 bg-white px-4 py-3">
              <div className="min-w-0">
                <div className="font-semibold text-slate-900">{formatHolidayDate(holiday.date)}</div>
                <div className="text-sm text-slate-500">{holiday.name?.trim() || 'Sin nombre'}</div>
              </div>
              <button
                type="button"
                onClick={() => remove(holiday.date)}
                className="shrink-0 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
