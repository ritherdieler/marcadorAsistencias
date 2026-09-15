import type { AttendanceDto } from '../../../types/attendance'
import type { User } from '../../../types/user'

/** Estado calculado solo para presentacion del reporte (no viene del backend). */
export type AttendanceReportStatus = 'MARCO' | 'TARDANZA' | 'FALTO' | 'FERIADO'

export type AttendanceReportRow = {
  key: string
  dateKey: string
  userId: number
  user?: User
  userFullName: string
  userDni: string
  checkIn: string | number | null
  checkOut: string | number | null
  method: string | null
  /** Status persistido de la marcacion principal, si existe. */
  attendanceStatus: string | null
  /** Estado derivado para la UI / exportacion. */
  reportStatus: AttendanceReportStatus
  sourceAttendanceIds: number[]
  /** Nombre del feriado cuando reportStatus es FERIADO. */
  holidayName?: string | null
}

export type AttendanceReportSummary = {
  totalPersonal: number
  marcaron: number
  faltaron: number
  feriados: number
  tardanzas: number
}

export const ATTENDANCE_REPORT_STATUS_LABEL: Record<AttendanceReportStatus, string> = {
  MARCO: 'MARCÓ',
  TARDANZA: 'TARDANZA',
  FALTO: 'FALTÓ',
  FERIADO: 'FERIADO',
}

/** Personal de asistencia en esta fase: todo usuario que no sea CLIENT. */
export function isAttendanceWorker(user: User): boolean {
  return user.type !== 'CLIENT'
}

/** Trabajadores incluidos en reporte y control de marcacion (excluye exentos). */
export function filterAttendanceWorkers(
  users: User[],
  exemptUserIds: ReadonlySet<number> = new Set(),
): User[] {
  return users.filter((user) => isAttendanceWorker(user) && !exemptUserIds.has(user.id))
}

export function toDate(value: string | number | null | undefined): Date | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return new Date(value)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** YYYY-MM-DD en zona horaria local del navegador (no UTC via toISOString). */
export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseLocalDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** Lunes–sábado. getDay(): 0 domingo … 6 sábado. */
export function isWorkday(date: Date): boolean {
  const day = date.getDay()
  return day >= 1 && day <= 6
}

export function buildFullName(user?: User): string {
  if (!user) return '-'
  return [user.name, user.lastName].filter(Boolean).join(' ') || user.username || `Usuario ${user.id}`
}

export function getDni(user?: User): string {
  return user?.dni?.trim() || ''
}

function compareDateKeys(a: string, b: string): number {
  return a.localeCompare(b)
}

export function eachDateKeyInclusive(from: string, to: string): string[] {
  const start = parseLocalDateKey(from)
  const end = parseLocalDateKey(to)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return []

  const keys: string[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate())

  while (cursor.getTime() <= last.getTime()) {
    keys.push(toLocalDateKey(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return keys
}

function resolveRangeBounds(from: string, to: string): { start: string; end: string } | null {
  const start = from || to
  const end = to || from
  if (!start || !end) return null
  return compareDateKeys(start, end) <= 0 ? { start, end } : { start: end, end: start }
}

/** Sin fechas en el filtro se asume el dia local actual (reporte del dia). */
export function resolveReportRangeBounds(from: string, to: string): { start: string; end: string } | null {
  const trimmedFrom = from.trim()
  const trimmedTo = to.trim()
  if (!trimmedFrom && !trimmedTo) {
    const today = toLocalDateKey(new Date())
    return { start: today, end: today }
  }
  return resolveRangeBounds(trimmedFrom, trimmedTo)
}

function mergeDayAttendances(group: AttendanceDto[]): {
  checkIn: string | number
  checkOut: string | number | null
  method: string
  attendanceStatus: string | null
  reportStatus: Exclude<AttendanceReportStatus, 'FALTO' | 'FERIADO'>
  sourceAttendanceIds: number[]
} {
  let earliest = group[0]
  let earliestTime = toDate(group[0].checkIn)?.getTime() ?? Number.POSITIVE_INFINITY
  let latestCheckOut: string | number | null = null
  let latestCheckOutTime = Number.NEGATIVE_INFINITY
  let hasTardanza = false

  for (const attendance of group) {
    const checkInDate = toDate(attendance.checkIn)
    if (checkInDate && checkInDate.getTime() < earliestTime) {
      earliest = attendance
      earliestTime = checkInDate.getTime()
    }

    const checkOutDate = toDate(attendance.checkOut ?? null)
    if (checkOutDate && checkOutDate.getTime() > latestCheckOutTime) {
      latestCheckOut = attendance.checkOut ?? null
      latestCheckOutTime = checkOutDate.getTime()
    }

    if (attendance.status === 'TARDANZA') hasTardanza = true
  }

  const checkOut = latestCheckOut
  let reportStatus: Exclude<AttendanceReportStatus, 'FALTO' | 'FERIADO'>
  if (hasTardanza) {
    reportStatus = 'TARDANZA'
  } else {
    reportStatus = 'MARCO'
  }

  return {
    checkIn: earliest.checkIn,
    checkOut,
    method: earliest.method,
    attendanceStatus: earliest.status ?? null,
    reportStatus,
    sourceAttendanceIds: group.map((item) => item.id),
  }
}

function toReportRow(params: {
  dateKey: string
  user: User | undefined
  userId: number
  checkIn: string | number | null
  checkOut: string | number | null
  method: string | null
  attendanceStatus: string | null
  reportStatus: AttendanceReportStatus
  sourceAttendanceIds: number[]
  holidayName?: string | null
}): AttendanceReportRow {
  const { dateKey, user, userId, reportStatus } = params
  return {
    key: `${userId}-${dateKey}-${reportStatus}`,
    dateKey,
    userId,
    user,
    userFullName: buildFullName(user),
    userDni: getDni(user),
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    method: params.method,
    attendanceStatus: params.attendanceStatus,
    reportStatus,
    sourceAttendanceIds: params.sourceAttendanceIds,
    holidayName: params.holidayName ?? null,
  }
}

/**
 * Construye filas del reporte a partir del personal (no CLIENT) cruzado con asistencias.
 * - Con rango de fechas (o sin fechas = hoy): genera FALTO en dias laborables sin marcacion (no feriado).
 * - Dias laborables feriados sin marcacion: FERIADO.
 * - Domingo: solo aparece si hay marcacion real; nunca se inventa FALTO/FERIADO.
 */
export function buildAttendanceReportRows(
  users: User[],
  attendances: AttendanceDto[],
  from = '',
  to = '',
  holidays: ReadonlySet<string> = new Set(),
  holidayNames: ReadonlyMap<string, string | null> = new Map(),
  exemptUserIds: ReadonlySet<number> = new Set(),
): AttendanceReportRow[] {
  const workers = filterAttendanceWorkers(users, exemptUserIds)
  const usersById = new Map(users.map((user) => [user.id, user]))
  const workersById = new Map(workers.map((user) => [user.id, user]))

  const groups = new Map<string, AttendanceDto[]>()
  for (const attendance of attendances) {
    const checkInDate = toDate(attendance.checkIn)
    if (!checkInDate) continue

    const user = usersById.get(attendance.userId)
    if (user && !isAttendanceWorker(user)) continue
    if (exemptUserIds.has(attendance.userId)) continue

    const dateKey = toLocalDateKey(checkInDate)
    const groupKey = `${attendance.userId}|${dateKey}`
    const current = groups.get(groupKey)
    if (current) current.push(attendance)
    else groups.set(groupKey, [attendance])
  }

  const rows: AttendanceReportRow[] = []
  const covered = new Set<string>()

  for (const [groupKey, group] of groups) {
    const [userIdRaw, dateKey] = groupKey.split('|')
    const userId = Number(userIdRaw)
    const user = workersById.get(userId) ?? usersById.get(userId)
    const merged = mergeDayAttendances(group)

    rows.push(
      toReportRow({
        dateKey,
        user,
        userId,
        checkIn: merged.checkIn,
        checkOut: merged.checkOut,
        method: merged.method,
        attendanceStatus: merged.attendanceStatus,
        reportStatus: merged.reportStatus,
        sourceAttendanceIds: merged.sourceAttendanceIds,
      }),
    )
    covered.add(groupKey)
  }

  const bounds = resolveReportRangeBounds(from, to)
  if (bounds) {
    for (const dateKey of eachDateKeyInclusive(bounds.start, bounds.end)) {
      if (!isWorkday(parseLocalDateKey(dateKey))) continue

      const isHolidayDate = holidays.has(dateKey)
      const reportStatus: AttendanceReportStatus = isHolidayDate ? 'FERIADO' : 'FALTO'
      const holidayName = isHolidayDate ? (holidayNames.get(dateKey) ?? null) : null

      for (const worker of workers) {
        const groupKey = `${worker.id}|${dateKey}`
        if (covered.has(groupKey)) continue

        rows.push(
          toReportRow({
            dateKey,
            user: worker,
            userId: worker.id,
            checkIn: null,
            checkOut: null,
            method: null,
            attendanceStatus: null,
            reportStatus,
            sourceAttendanceIds: [],
            holidayName,
          }),
        )
        covered.add(groupKey)
      }
    }

    return rows.filter((row) => row.dateKey >= bounds.start && row.dateKey <= bounds.end)
  }

  return rows
}

export function filterAttendanceReportRows(
  rows: AttendanceReportRow[],
  from: string,
  to: string,
  dni: string,
): AttendanceReportRow[] {
  const bounds = resolveReportRangeBounds(from, to)
  const dniQuery = dni.trim()

  return rows.filter((row) => {
    if (dniQuery && !row.userDni.includes(dniQuery)) return false
    if (bounds && (row.dateKey < bounds.start || row.dateKey > bounds.end)) return false
    return true
  })
}

const MARKED_STATUSES: ReadonlySet<AttendanceReportStatus> = new Set(['MARCO', 'TARDANZA'])

export function summarizeAttendanceReport(rows: AttendanceReportRow[]): AttendanceReportSummary {
  const totalPersonal = new Set(rows.map((row) => row.userId)).size
  const marcaron = new Set(
    rows.filter((row) => MARKED_STATUSES.has(row.reportStatus)).map((row) => row.userId),
  ).size
  const faltaron = new Set(
    rows.filter((row) => row.reportStatus === 'FALTO').map((row) => row.userId),
  ).size
  const feriados = new Set(
    rows.filter((row) => row.reportStatus === 'FERIADO').map((row) => row.userId),
  ).size
  const tardanzas = new Set(
    rows.filter((row) => row.reportStatus === 'TARDANZA').map((row) => row.userId),
  ).size

  return { totalPersonal, marcaron, faltaron, feriados, tardanzas }
}

export function formatReportDate(dateKey: string): string {
  const date = parseLocalDateKey(dateKey)
  if (Number.isNaN(date.getTime())) return dateKey
  return date.toLocaleDateString('es-PE')
}

export function formatReportDateTime(value: string | number | null | undefined): string {
  const date = toDate(value)
  if (!date) return '-'

  const datePart = new Intl.DateTimeFormat('es-PE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)

  const timePart = new Intl.DateTimeFormat('es-PE', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)

  return `${datePart}, ${timePart}`
}

export function formatExportCell(
  value: string | number | null | undefined,
  empty = '-',
): string {
  if (value === null || value === undefined || value === '') return empty
  return String(value)
}
