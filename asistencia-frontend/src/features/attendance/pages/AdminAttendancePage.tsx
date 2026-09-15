import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { Alert } from '../../../components/ui/Alert'
import { LoadingButton } from '../../../components/ui/LoadingButton'
import { ModalAlert } from '../../../components/ui/ModalAlert'
import { getAllAttendance } from '../../../services/attendanceService'
import { getAllUsers } from '../../../services/userService'
import type { User } from '../../../types/user'
import { useAttendanceHolidaysConfig } from '../../settings/hooks/useAttendanceHolidaysConfig'
import { useAttendanceMarkingConfig } from '../../settings/hooks/useAttendanceMarkingConfig'
import { toHolidayNameMap, toHolidaySet } from '../../settings/services/attendanceHolidaysConfig'
import { toExemptUserIdSet } from '../../settings/services/attendanceMarkingConfig'
import {
  ATTENDANCE_REPORT_STATUS_LABEL,
  buildAttendanceReportRows,
  buildFullName,
  filterAttendanceReportRows,
  formatReportDate,
  formatReportDateTime,
  getDni,
  summarizeAttendanceReport,
  toLocalDateKey,
  type AttendanceReportRow,
  type AttendanceReportStatus,
} from '../utils/attendanceReport'

type SortKey = 'dateKey' | 'userDni' | 'userFullName' | 'checkIn' | 'checkOut' | 'method' | 'reportStatus'
type SortDirection = 'asc' | 'desc'
type SortState = {
  key: SortKey
  direction: SortDirection
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const
const DEFAULT_PAGE_SIZE = 10

type PaginationItem = number | 'ellipsis'

function buildPaginationRange(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const items: PaginationItem[] = [1]
  const left = Math.max(2, currentPage - 1)
  const right = Math.min(totalPages - 1, currentPage + 1)

  if (left > 2) items.push('ellipsis')

  for (let page = left; page <= right; page += 1) {
    items.push(page)
  }

  if (right < totalPages - 1) items.push('ellipsis')

  items.push(totalPages)
  return items
}

function isAbsenceLike(status: AttendanceReportStatus): boolean {
  return status === 'FALTO' || status === 'FERIADO'
}

function statusBadgeClass(status: AttendanceReportStatus): string {
  switch (status) {
    case 'TARDANZA':
      return 'bg-amber-100 text-amber-800'
    case 'FALTO':
      return 'bg-rose-100 text-rose-800'
    case 'FERIADO':
      return 'bg-violet-100 text-violet-800'
    case 'MARCO':
    default:
      return 'bg-emerald-100 text-emerald-800'
  }
}

function excelStatusClass(status: AttendanceReportStatus): string {
  switch (status) {
    case 'TARDANZA':
      return 'late'
    case 'FALTO':
      return 'missing'
    case 'FERIADO':
      return 'holiday'
    case 'MARCO':
    default:
      return 'ok'
  }
}

function toDate(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return new Date(value)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function sortRows(rows: AttendanceReportRow[], sort: SortState): AttendanceReportRow[] {
  return [...rows].sort((a, b) => {
    const direction = sort.direction === 'asc' ? 1 : -1
    const result = compareRows(a, b, sort.key)

    if (result !== 0) return result * direction
    const dateCmp = a.dateKey.localeCompare(b.dateKey)
    if (dateCmp !== 0) return dateCmp * direction
    return a.userFullName.localeCompare(b.userFullName, 'es', { sensitivity: 'base' }) * direction
  })
}

function compareRows(a: AttendanceReportRow, b: AttendanceReportRow, key: SortKey): number {
  if (key === 'checkIn' || key === 'checkOut') {
    const aTime = toDate(a[key])?.getTime() ?? 0
    const bTime = toDate(b[key])?.getTime() ?? 0
    return aTime - bTime
  }

  if (key === 'reportStatus') {
    return ATTENDANCE_REPORT_STATUS_LABEL[a.reportStatus].localeCompare(
      ATTENDANCE_REPORT_STATUS_LABEL[b.reportStatus],
      'es',
      { sensitivity: 'base' },
    )
  }

  if (key === 'method') {
    return displayMethodCell(a).localeCompare(displayMethodCell(b), 'es', {
      numeric: true,
      sensitivity: 'base',
    })
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

function displayTime(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  const formatted = formatReportDateTime(value)
  return formatted === '-' ? '-' : formatted
}

function displayMethodCell(row: AttendanceReportRow): string {
  if (row.reportStatus === 'FERIADO') {
    return row.holidayName?.trim() || 'Feriado'
  }
  if (row.reportStatus === 'FALTO') return '-'
  return row.method?.trim() ? row.method : '-'
}

function toExcelHtml(rows: AttendanceReportRow[]): string {
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
          .missing-out { color: #0369a1; font-weight: 700; }
          .missing { color: #be123c; font-weight: 700; }
          .holiday { color: #6d28d9; font-weight: 700; }
        </style>
      </head>
      <body>
        <div class="title">Reporte de asistencias</div>
        <div class="meta">Generado: ${escapeHtml(generatedAt)}</div>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>DNI</th>
              <th>Trabajador</th>
              <th>Ingreso</th>
              <th>Salida</th>
              <th>Metodo</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((row) => {
                const absenceLike = isAbsenceLike(row.reportStatus)
                const ingreso = absenceLike ? '-' : displayTime(row.checkIn)
                const salida = absenceLike ? '-' : displayTime(row.checkOut)
                const metodo = displayMethodCell(row)
                const estado = ATTENDANCE_REPORT_STATUS_LABEL[row.reportStatus]

                return `
                  <tr>
                    <td>${escapeHtml(formatReportDate(row.dateKey))}</td>
                    <td>${escapeHtml(row.userDni || '-')}</td>
                    <td>${escapeHtml(row.userFullName)}</td>
                    <td>${escapeHtml(ingreso)}</td>
                    <td>${escapeHtml(salida)}</td>
                    <td>${escapeHtml(metodo)}</td>
                    <td class="${excelStatusClass(row.reportStatus)}">${escapeHtml(estado)}</td>
                  </tr>
                `
              })
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

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${tone}`}>
      <div className="text-xs font-medium text-slate-600">{label}</div>
      <div className="mt-0.5 text-xl font-bold text-slate-900">{value}</div>
    </div>
  )
}

export function AdminAttendancePage() {
  const [from, setFrom] = useState(() => toLocalDateKey(new Date()))
  const [to, setTo] = useState(() => toLocalDateKey(new Date()))
  const [dni, setDni] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [errorDismissed, setErrorDismissed] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(DEFAULT_PAGE_SIZE)
  const [sort, setSort] = useState<SortState>({ key: 'dateKey', direction: 'desc' })

  const { holidays } = useAttendanceHolidaysConfig()
  const { config: markingConfig } = useAttendanceMarkingConfig()
  const holidaySet = useMemo(() => toHolidaySet(holidays), [holidays])
  const holidayNames = useMemo(() => toHolidayNameMap(holidays), [holidays])
  const exemptUserIds = useMemo(() => toExemptUserIdSet(markingConfig), [markingConfig])

  const attendanceQuery = useQuery({ queryKey: ['attendance', 'getAll'], queryFn: getAllAttendance })
  const usersQuery = useQuery({ queryKey: ['users', 'getAll'], queryFn: getAllUsers })

  const rows = useMemo<AttendanceReportRow[]>(() => {
    return buildAttendanceReportRows(
      usersQuery.data ?? [],
      attendanceQuery.data ?? [],
      from,
      to,
      holidaySet,
      holidayNames,
      exemptUserIds,
    )
  }, [attendanceQuery.data, usersQuery.data, from, to, holidaySet, holidayNames, exemptUserIds])

  const filtered = useMemo(
    () => sortRows(filterAttendanceReportRows(rows, from, to, dni), sort),
    [rows, from, to, dni, sort],
  )

  const summary = useMemo(() => summarizeAttendanceReport(filtered), [filtered])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginationItems = useMemo(
    () => buildPaginationRange(currentPage, totalPages),
    [currentPage, totalPages],
  )
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [currentPage, filtered, pageSize])

  useEffect(() => {
    setCurrentPage(1)
  }, [from, to, dni, pageSize, sort, holidays, markingConfig])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const suggestions = useMemo(() => {
    const query = dni.trim()
    if (!query) return []

    return (usersQuery.data ?? [])
      .filter((user: User) => getDni(user).includes(query))
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
    return sort.direction === 'asc' ? ' ^' : ' v'
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
        <p className="mt-1 text-sm text-slate-600">
          Por defecto muestra el dia de hoy con todo el personal: quien marco y quien no marco (faltas) en la misma
          tabla. Ajusta Desde/Hasta para otro rango.
        </p>
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
                downloadExcel(`asistencias_${toLocalDateKey(new Date())}.xls`, excel)
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

      {!isLoading && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <SummaryCard label="Total personal" value={summary.totalPersonal} tone="border-slate-200 bg-white" />
          <SummaryCard label="Marcaron" value={summary.marcaron} tone="border-emerald-200 bg-emerald-50/60" />
          <SummaryCard label="Faltaron" value={summary.faltaron} tone="border-rose-200 bg-rose-50/60" />
          <SummaryCard label="Feriados" value={summary.feriados} tone="border-violet-200 bg-violet-50/60" />
          <SummaryCard label="Tardanzas" value={summary.tardanzas} tone="border-amber-200 bg-amber-50/60" />
        </div>
      )}

      <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <SortableHeader label="Fecha" sortKey="dateKey" />
              <SortableHeader label="DNI" sortKey="userDni" />
              <SortableHeader label="Trabajador" sortKey="userFullName" />
              <SortableHeader label="Ingreso" sortKey="checkIn" />
              <SortableHeader label="Salida" sortKey="checkOut" />
              <SortableHeader label="Metodo" sortKey="method" />
              <SortableHeader label="Estado" sortKey="reportStatus" />
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row) => (
              <tr key={row.key} className="border-t">
                <td className="px-4 py-3">{formatReportDate(row.dateKey)}</td>
                <td className="px-4 py-3">{row.userDni || '-'}</td>
                <td className="px-4 py-3">{row.userFullName}</td>
                <td className="px-4 py-3">{displayTime(row.checkIn)}</td>
                <td className="px-4 py-3">{displayTime(row.checkOut)}</td>
                <td className="px-4 py-3">{displayMethodCell(row)}</td>
                <td className="px-4 py-3">
                  <span
                    className={[
                      'rounded-full px-2 py-1 text-xs font-bold',
                      statusBadgeClass(row.reportStatus),
                    ].join(' ')}
                  >
                    {ATTENDANCE_REPORT_STATUS_LABEL[row.reportStatus]}
                  </span>
                </td>
              </tr>
            ))}

            {!isLoading && filtered.length === 0 && (
              <tr className="border-t">
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  {rows.length
                    ? 'Sin resultados para los filtros aplicados'
                    : 'Sin personal ni marcaciones para el rango seleccionado'}
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
              Mostrando {(currentPage - 1) * pageSize + 1} al{' '}
              {Math.min(currentPage * pageSize, filtered.length)} de {filtered.length} registros
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

          <nav
            className="inline-flex self-end overflow-hidden rounded-md border border-slate-200 bg-white"
            aria-label="Paginacion de asistencias"
          >
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              className="border-r border-slate-200 px-3 py-2 text-sm font-semibold text-brand-blue transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-white"
            >
              &laquo; Anterior
            </button>

            {paginationItems.map((item, index) =>
              item === 'ellipsis' ? (
                <span
                  key={`ellipsis-${index}`}
                  className="grid min-w-9 place-items-center border-r border-slate-200 px-2 text-sm font-semibold text-slate-400"
                  aria-hidden="true"
                >
                  ...
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCurrentPage(item)}
                  className={[
                    'min-w-9 border-r border-slate-200 px-3 py-2 text-sm font-semibold transition last:border-r-0',
                    currentPage === item
                      ? 'bg-brand-blue text-white'
                      : 'text-brand-blue hover:bg-slate-50',
                  ].join(' ')}
                >
                  {item}
                </button>
              ),
            )}

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              className="px-3 py-2 text-sm font-semibold text-brand-blue transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-white"
            >
              Siguiente &raquo;
            </button>
          </nav>
        </div>
      )}
    </div>
  )
}
