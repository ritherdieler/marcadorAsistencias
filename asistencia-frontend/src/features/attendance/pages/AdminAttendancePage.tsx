import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { Alert } from '../../../components/ui/Alert'
import { LoadingButton } from '../../../components/ui/LoadingButton'
import { ModalAlert } from '../../../components/ui/ModalAlert'
import { getAllAttendance } from '../../../services/attendanceService'
import { getAllUsers } from '../../../services/userService'
import type { AttendanceDto } from '../../../types/attendance'
import type { User } from '../../../types/user'

type AttendanceRow = AttendanceDto & {
  user?: User
  userFullName: string
  userDni: string
}

type SortKey = 'userDni' | 'userFullName' | 'checkIn' | 'checkOut' | 'method' | 'status'
type SortDirection = 'asc' | 'desc'
type SortState = {
  key: SortKey
  direction: SortDirection
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const
const DEFAULT_PAGE_SIZE = 10

const DATE_WORDS_FORMATTER = new Intl.DateTimeFormat('es-PE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const TIME_FORMATTER = new Intl.DateTimeFormat('es-PE', {
  hour: 'numeric',
  minute: '2-digit',
})

function toDate(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return new Date(value)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function fmt(value: string | number | null | undefined): string {
  const date = toDate(value)
  return date ? `${DATE_WORDS_FORMATTER.format(date)}, ${TIME_FORMATTER.format(date)}` : '-'
}

function buildFullName(user?: User): string {
  if (!user) return '-'
  return [user.name, user.lastName].filter(Boolean).join(' ') || user.username || `Usuario ${user.id}`
}

function getDni(user?: User): string {
  return user?.dni?.trim() || ''
}

function filterRows(rows: AttendanceRow[], from: string, to: string, dni: string): AttendanceRow[] {
  const fromDate = from ? new Date(`${from}T00:00:00`) : null
  const toDateValue = to ? new Date(`${to}T23:59:59`) : null
  const dniQuery = dni.trim()

  return rows.filter((row) => {
    if (dniQuery && !row.userDni.includes(dniQuery)) return false

    const checkIn = toDate(row.checkIn)
    if (!checkIn) return false
    if (fromDate && checkIn < fromDate) return false
    if (toDateValue && checkIn > toDateValue) return false
    return true
  })
}

function sortRows(rows: AttendanceRow[], sort: SortState): AttendanceRow[] {
  return [...rows].sort((a, b) => {
    const direction = sort.direction === 'asc' ? 1 : -1
    const result = compareRows(a, b, sort.key)

    if (result !== 0) return result * direction
    return (b.id - a.id) * direction
  })
}

function compareRows(a: AttendanceRow, b: AttendanceRow, key: SortKey): number {
  if (key === 'checkIn' || key === 'checkOut') {
    const aTime = toDate(a[key])?.getTime() ?? 0
    const bTime = toDate(b[key])?.getTime() ?? 0
    return aTime - bTime
  }

  return String(a[key] ?? '').localeCompare(String(b[key] ?? ''), 'es', {
    numeric: true,
    sensitivity: 'base',
  })
}

function escapeHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function toExcelHtml(rows: AttendanceRow[]): string {
  const generatedAt = new Date().toLocaleString()

  return `
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; width: 100%; }
          th { background: #0f376d; color: #ffffff; font-weight: 700; border: 1px solid #0b2850; padding: 8px; text-align: left; }
          td { border: 1px solid #cbd5e1; padding: 7px; vertical-align: middle; }
          tr:nth-child(even) td { background: #f8fafc; }
          .title { font-size: 18px; font-weight: 700; color: #0f172a; padding: 10px 0; }
          .meta { color: #475569; padding: 0 0 12px 0; }
          .ok { color: #047857; font-weight: 700; }
          .late { color: #b45309; font-weight: 700; }
        </style>
      </head>
      <body>
        <div class="title">Reporte de asistencias</div>
        <div class="meta">Generado: ${escapeHtml(generatedAt)}</div>
        <table>
          <thead>
            <tr>
              <th>DNI</th>
              <th>Usuario</th>
              <th>Ingreso</th>
              <th>Salida</th>
              <th>Metodo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) => `
                  <tr>
                    <td>${escapeHtml(row.userDni || '-')}</td>
                    <td>${escapeHtml(row.userFullName)}</td>
                    <td>${escapeHtml(fmt(row.checkIn))}</td>
                    <td>${escapeHtml(fmt(row.checkOut))}</td>
                    <td>${escapeHtml(row.method)}</td>
                    <td class="${row.status === 'TARDANZA' ? 'late' : 'ok'}">${escapeHtml(row.status)}</td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </body>
    </html>
  `
}

function downloadExcel(filename: string, html: string) {
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function AdminAttendancePage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [dni, setDni] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [errorDismissed, setErrorDismissed] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(DEFAULT_PAGE_SIZE)
  const [sort, setSort] = useState<SortState>({ key: 'checkIn', direction: 'desc' })

  const attendanceQuery = useQuery({ queryKey: ['attendance', 'getAll'], queryFn: getAllAttendance })
  const usersQuery = useQuery({ queryKey: ['users', 'getAll'], queryFn: getAllUsers })

  const usersById = useMemo(() => {
    return new Map((usersQuery.data ?? []).map((user) => [user.id, user]))
  }, [usersQuery.data])

  const rows = useMemo<AttendanceRow[]>(() => {
    return (attendanceQuery.data ?? []).map((attendance) => {
      const user = usersById.get(attendance.userId)
      return {
        ...attendance,
        user,
        userFullName: buildFullName(user),
        userDni: getDni(user),
      }
    })
  }, [attendanceQuery.data, usersById])

  const filtered = useMemo(() => sortRows(filterRows(rows, from, to, dni), sort), [rows, from, to, dni, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [currentPage, filtered, pageSize])

  useEffect(() => {
    setCurrentPage(1)
  }, [from, to, dni, pageSize, sort])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const suggestions = useMemo(() => {
    const query = dni.trim()
    if (!query) return []

    return (usersQuery.data ?? [])
      .filter((user) => getDni(user).includes(query))
      .slice(0, 6)
  }, [dni, usersQuery.data])

  const isLoading = attendanceQuery.isLoading || usersQuery.isLoading
  const isFetching = attendanceQuery.isFetching || usersQuery.isFetching
  const hasError = attendanceQuery.isError || usersQuery.isError

  function changeSort(key: SortKey) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  function sortLabel(key: SortKey): string {
    if (sort.key !== key) return 'Ordenar'
    return sort.direction === 'asc' ? 'Orden ascendente' : 'Orden descendente'
  }

  function sortIndicator(key: SortKey): string {
    if (sort.key !== key) return ''
    return sort.direction === 'asc' ? ' ↑' : ' ↓'
  }

  function SortableHeader({ label, sortKey }: { label: string; sortKey: SortKey }) {
    return (
      <th className="px-4 py-3">
        <button
          type="button"
          onClick={() => changeSort(sortKey)}
          aria-label={`${sortLabel(sortKey)} por ${label}`}
          className="inline-flex items-center gap-1 font-bold uppercase tracking-wide text-slate-600 transition hover:text-brand-blue"
        >
          <span>{label}</span>
          <span className="w-3 text-brand-blue">{sortIndicator(sortKey)}</span>
        </button>
      </th>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Asistencias</h1>
        <p className="mt-1 text-sm text-slate-600">Visualiza registros y genera reportes con filtros.</p>
      </div>

      <form
        className="rounded-xl border border-slate-200 bg-white p-4"
        onSubmit={(event) => {
          event.preventDefault()
          setErrorDismissed(false)
          void attendanceQuery.refetch()
          void usersQuery.refetch()
        }}
      >
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1.2fr_auto]">
          <label className="block">
            <span className="text-sm font-medium">Desde</span>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-blue/20"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Hasta</span>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-blue/20"
            />
          </label>

          <div className="relative">
            <label className="block">
              <span className="text-sm font-medium">DNI</span>
              <input
                value={dni}
                inputMode="numeric"
                pattern="\d*"
                placeholder="Buscar por DNI"
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => window.setTimeout(() => setShowSuggestions(false), 120)}
                onChange={(event) => {
                  setDni(event.target.value.replace(/\D/g, ''))
                  setShowSuggestions(true)
                }}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-blue/20"
              />
            </label>

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                {suggestions.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setDni(getDni(user))
                      setShowSuggestions(false)
                    }}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="font-semibold text-slate-900">{buildFullName(user)}</span>
                    <span className="shrink-0 text-slate-500">{getDni(user)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:items-end">
            <LoadingButton type="submit" loading={isFetching} loadingText="Buscando..." className="w-full lg:w-40">
              Buscar
            </LoadingButton>
            <LoadingButton
              type="button"
              variant="secondary"
              disabled={filtered.length === 0}
              className="w-full lg:w-40"
              onClick={() => {
                const excel = toExcelHtml(filtered)
                downloadExcel(`asistencias_${new Date().toISOString().slice(0, 10)}.xls`, excel)
              }}
            >
              Exportar Excel
            </LoadingButton>
          </div>
        </div>
      </form>

      {isLoading && <Alert variant="info" message="Cargando asistencias..." />}
      {hasError && !errorDismissed && (
        <ModalAlert
          variant="error"
          message="No se pudo cargar asistencias o usuarios. Verifica que el backend este encendido."
          onClose={() => setErrorDismissed(true)}
        />
      )}

      <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <SortableHeader label="DNI" sortKey="userDni" />
              <SortableHeader label="Usuario" sortKey="userFullName" />
              <SortableHeader label="Ingreso" sortKey="checkIn" />
              <SortableHeader label="Salida" sortKey="checkOut" />
              <SortableHeader label="Metodo" sortKey="method" />
              <SortableHeader label="Estado" sortKey="status" />
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-4 py-3">{row.userDni || '-'}</td>
                <td className="px-4 py-3">{row.userFullName}</td>
                <td className="px-4 py-3">{fmt(row.checkIn)}</td>
                <td className="px-4 py-3">{fmt(row.checkOut)}</td>
                <td className="px-4 py-3">{row.method}</td>
                <td className="px-4 py-3">
                  <span
                    className={[
                      'rounded-full px-2 py-1 text-xs font-bold',
                      row.status === 'TARDANZA'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800',
                    ].join(' ')}
                  >
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}

            {!isLoading && filtered.length === 0 && (
              <tr className="border-t">
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  {rows.length ? 'Sin resultados para los filtros aplicados' : 'Aun no hay asistencias registradas'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <p className="text-sm text-slate-500">
              Mostrando {(currentPage - 1) * pageSize + 1}-
              {Math.min(currentPage * pageSize, filtered.length)} de {filtered.length} asistencias
            </p>

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <span>Ver</span>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-brand-blue/20"
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <span>por pagina</span>
            </label>
          </div>

          {totalPages > 1 && (
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Anterior
            </button>

            {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={[
                  'h-9 min-w-9 rounded-md border px-3 text-sm font-semibold transition',
                  currentPage === page
                    ? 'border-brand-blue bg-brand-blue text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                ].join(' ')}
              >
                {page}
              </button>
            ))}

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
          )}
        </div>
      )}
    </div>
  )
}
