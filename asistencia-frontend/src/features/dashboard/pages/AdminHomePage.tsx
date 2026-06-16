import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { Alert } from '../../../components/ui/Alert'
import { getAllAttendance } from '../../../services/attendanceService'
import { getAllUsers } from '../../../services/userService'
import type { AttendanceDto } from '../../../types/attendance'

function StatCard({
  title,
  value,
  tone,
}: {
  title: string
  value: number
  tone: 'blue' | 'orange' | 'slate'
}) {
  const toneClass =
    tone === 'blue'
      ? 'bg-brand-soft/60 text-brand-blue'
      : tone === 'orange'
        ? 'bg-orange-50 text-brand-orange'
        : 'bg-slate-100 text-slate-700'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`grid h-11 w-11 place-items-center rounded-xl ${toneClass}`}>
          <div className="h-2.5 w-2.5 rounded-full bg-current/70" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-500">{title}</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
        </div>
      </div>
    </div>
  )
}

function toDate(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return new Date(value)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function isToday(date: Date): boolean {
  const now = new Date()
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
}

function todayRows(rows: AttendanceDto[]): AttendanceDto[] {
  return rows.filter((row) => {
    const checkIn = toDate(row.checkIn)
    return checkIn ? isToday(checkIn) : false
  })
}

export function AdminHomePage() {
  const usersQuery = useQuery({ queryKey: ['users', 'all'], queryFn: getAllUsers })
  const attendanceQuery = useQuery({ queryKey: ['attendance', 'all'], queryFn: getAllAttendance })

  const attendanceTodayRows = useMemo(() => todayRows(attendanceQuery.data ?? []), [attendanceQuery.data])
  const totalUsers = usersQuery.data?.length ?? 0
  const attendanceToday = attendanceTodayRows.length
  const tardinessToday = attendanceTodayRows.filter((row) => row.status === 'TARDANZA').length
  const punctualToday = attendanceTodayRows.filter((row) => row.status !== 'TARDANZA').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Resumen de Operaciones</h1>
          <p className="mt-1 text-sm text-slate-600">Bienvenido al panel de control administrativo.</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          {new Date().toLocaleDateString()}
        </div>
      </div>

      {(usersQuery.isError || attendanceQuery.isError) && (
        <Alert
          variant="warning"
          message="Algunos datos no se pudieron cargar. Verifica backend: /users y /api/attendance/getAll."
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Personal Activo" value={totalUsers} tone="slate" />
        <StatCard title="Asistencias Hoy" value={attendanceToday} tone="blue" />
        <StatCard title="Tardanzas Hoy" value={tardinessToday} tone="orange" />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">Estado de Puntualidad Hoy</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="text-xs font-semibold uppercase text-emerald-700">Puntuales</div>
            <div className="mt-2 text-3xl font-bold text-emerald-800">{punctualToday}</div>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
            <div className="text-xs font-semibold uppercase text-amber-700">Tardanzas</div>
            <div className="mt-2 text-3xl font-bold text-amber-800">{tardinessToday}</div>
          </div>
        </div>
      </section>
    </div>
  )
}
