export type AttendanceMarkingConfig = {
  /** Personal que no marca en kiosko ni entra al reporte de faltas. */
  exemptUserIds: number[]
}

export const ATTENDANCE_MARKING_STORAGE_KEY = 'giga-attendance-marking-config'
export const ATTENDANCE_MARKING_CONFIG_EVENT = 'giga-attendance-marking-config-changed'

export const DEFAULT_ATTENDANCE_MARKING_CONFIG: AttendanceMarkingConfig = {
  exemptUserIds: [],
}

export const ATTENDANCE_MARKING_BLOCKED_MESSAGE =
  'No estas habilitado para marcar asistencia en el kiosko. Consulta con administracion.'

function normalizeUserId(value: unknown): number | null {
  const numeric = Number(value)
  if (!Number.isInteger(numeric) || numeric <= 0) return null
  return numeric
}

export function normalizeAttendanceMarkingConfig(raw: unknown): AttendanceMarkingConfig {
  const source = typeof raw === 'object' && raw !== null ? (raw as Partial<AttendanceMarkingConfig>) : {}
  const list = Array.isArray(source.exemptUserIds) ? source.exemptUserIds : []
  const ids = new Set<number>()

  for (const item of list) {
    const id = normalizeUserId(item)
    if (id !== null) ids.add(id)
  }

  return { exemptUserIds: [...ids].sort((a, b) => a - b) }
}

export function loadAttendanceMarkingConfig(): AttendanceMarkingConfig {
  try {
    const raw = localStorage.getItem(ATTENDANCE_MARKING_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_ATTENDANCE_MARKING_CONFIG, exemptUserIds: [] }
    return normalizeAttendanceMarkingConfig(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_ATTENDANCE_MARKING_CONFIG, exemptUserIds: [] }
  }
}

export function saveAttendanceMarkingConfig(config: AttendanceMarkingConfig): AttendanceMarkingConfig {
  const normalized = normalizeAttendanceMarkingConfig(config)
  localStorage.setItem(ATTENDANCE_MARKING_STORAGE_KEY, JSON.stringify(normalized))
  window.dispatchEvent(new Event(ATTENDANCE_MARKING_CONFIG_EVENT))
  return normalized
}

export function resetAttendanceMarkingConfig(): AttendanceMarkingConfig {
  localStorage.removeItem(ATTENDANCE_MARKING_STORAGE_KEY)
  window.dispatchEvent(new Event(ATTENDANCE_MARKING_CONFIG_EVENT))
  return { ...DEFAULT_ATTENDANCE_MARKING_CONFIG, exemptUserIds: [] }
}

export function isUserRequiredToMark(config: AttendanceMarkingConfig, userId: number): boolean {
  return !config.exemptUserIds.includes(userId)
}

export function toExemptUserIdSet(config: AttendanceMarkingConfig): Set<number> {
  return new Set(config.exemptUserIds)
}

export function setUserMustMark(
  config: AttendanceMarkingConfig,
  userId: number,
  mustMark: boolean,
): AttendanceMarkingConfig {
  const ids = new Set(config.exemptUserIds)
  if (mustMark) ids.delete(userId)
  else ids.add(userId)
  return normalizeAttendanceMarkingConfig({ exemptUserIds: [...ids] })
}
