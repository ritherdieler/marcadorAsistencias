import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { getAllUsers } from '../../../services/userService'
import { buildFullName, filterAttendanceWorkers, getDni, isAttendanceWorker } from '../../attendance/utils/attendanceReport'
import { formatUserRole } from '../../../utils/userRole'
import { useAttendanceMarkingConfig } from '../hooks/useAttendanceMarkingConfig'
import { isUserRequiredToMark } from '../services/attendanceMarkingConfig'

export function AttendanceMarkingManager() {
  const { config, setMustMark } = useAttendanceMarkingConfig()
  const [query, setQuery] = useState('')

  const usersQuery = useQuery({ queryKey: ['users', 'getAll'], queryFn: getAllUsers })

  const workers = useMemo(() => {
    const list = (usersQuery.data ?? []).filter(isAttendanceWorker)
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return list

    return list.filter((user) => {
      const dni = getDni(user)
      const name = buildFullName(user).toLowerCase()
      return dni.includes(normalizedQuery) || name.includes(normalizedQuery)
    })
  }, [query, usersQuery.data])

  const requiredCount = useMemo(() => {
    const all = (usersQuery.data ?? []).filter(isAttendanceWorker)
    return filterAttendanceWorkers(all, new Set(config.exemptUserIds)).length
  }, [config.exemptUserIds, usersQuery.data])

  const exemptCount = config.exemptUserIds.length

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Quien marca asistencia</h2>
        <p className="mt-1 text-sm text-slate-600">
          Desactiva a quien no debe usar el kiosko ni aparecer en faltas del reporte. La lista se guarda en este
          navegador (el mismo PC del kiosko debe tener la config actualizada).
        </p>
        <p className="mt-2 text-xs font-medium text-slate-500">
          Marcan: {requiredCount} · Exentos: {exemptCount}
        </p>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Buscar por nombre o DNI</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filtrar personal..."
          className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-blue/20"
        />
      </label>

      {usersQuery.isLoading ? (
        <p className="text-sm text-slate-500">Cargando personal...</p>
      ) : workers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          No hay personal para mostrar.
        </p>
      ) : (
        <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
          {workers.map((user) => {
            const mustMark = isUserRequiredToMark(config, user.id)
            return (
              <li key={user.id} className="flex items-center justify-between gap-3 bg-white px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-900">{buildFullName(user)}</div>
                  <div className="text-sm text-slate-500">
                    DNI {getDni(user) || '-'} · {formatUserRole(user.type)}
                  </div>
                </div>
                <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
                  <span className="hidden sm:inline">{mustMark ? 'Marca' : 'Exento'}</span>
                  <input
                    type="checkbox"
                    checked={mustMark}
                    onChange={(event) => setMustMark(user.id, event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue/30"
                  />
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
