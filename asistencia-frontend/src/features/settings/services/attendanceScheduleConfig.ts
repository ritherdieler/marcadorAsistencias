export type AttendanceStatus = 'OK' | 'TARDANZA'

export type AttendanceScheduleConfig = {
  checkInHour: number
  checkInMinute: number
  toleranceMinutes: number
}

export const ATTENDANCE_SCHEDULE_STORAGE_KEY = 'giga-attendance-schedule-config'
export const ATTENDANCE_SCHEDULE_CONFIG_EVENT = 'giga-attendance-schedule-config-changed'

export const DEFAULT_ATTENDANCE_SCHEDULE_CONFIG: AttendanceScheduleConfig = {
  checkInHour: 8,
  checkInMinute: 30,
  toleranceMinutes: 20,
}

function clampHour(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return DEFAULT_ATTENDANCE_SCHEDULE_CONFIG.checkInHour
  return Math.min(23, Math.max(0, Math.round(numeric)))
}

function clampMinute(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return DEFAULT_ATTENDANCE_SCHEDULE_CONFIG.checkInMinute
  return Math.min(59, Math.max(0, Math.round(numeric)))
}

function clampTolerance(value: unknown): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return DEFAULT_ATTENDANCE_SCHEDULE_CONFIG.toleranceMinutes
  return Math.min(180, Math.max(0, Math.round(numeric)))
}

export function normalizeAttendanceScheduleConfig(raw: unknown): AttendanceScheduleConfig {
  const source = typeof raw === 'object' && raw !== null ? (raw as Partial<AttendanceScheduleConfig>) : {}

  return {
    checkInHour: clampHour(source.checkInHour),
    checkInMinute: clampMinute(source.checkInMinute),
    toleranceMinutes: clampTolerance(source.toleranceMinutes),
  }
}

export function loadAttendanceScheduleConfig(): AttendanceScheduleConfig {
  try {
    const raw = localStorage.getItem(ATTENDANCE_SCHEDULE_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_ATTENDANCE_SCHEDULE_CONFIG }
    return normalizeAttendanceScheduleConfig(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_ATTENDANCE_SCHEDULE_CONFIG }
  }
}

export function saveAttendanceScheduleConfig(config: AttendanceScheduleConfig): AttendanceScheduleConfig {
  const normalized = normalizeAttendanceScheduleConfig(config)
  localStorage.setItem(ATTENDANCE_SCHEDULE_STORAGE_KEY, JSON.stringify(normalized))
  window.dispatchEvent(new Event(ATTENDANCE_SCHEDULE_CONFIG_EVENT))
  return normalized
}

export function resetAttendanceScheduleConfig(): AttendanceScheduleConfig {
  localStorage.removeItem(ATTENDANCE_SCHEDULE_STORAGE_KEY)
  window.dispatchEvent(new Event(ATTENDANCE_SCHEDULE_CONFIG_EVENT))
  return { ...DEFAULT_ATTENDANCE_SCHEDULE_CONFIG }
}

export function attendanceScheduleConfigsEqual(
  a: AttendanceScheduleConfig,
  b: AttendanceScheduleConfig,
): boolean {
  return (
    a.checkInHour === b.checkInHour
    && a.checkInMinute === b.checkInMinute
    && a.toleranceMinutes === b.toleranceMinutes
  )
}

export function formatScheduleTime(hour: number, minute: number): string {
  const date = new Date(2000, 0, 1, hour, minute, 0, 0)
  return date.toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' })
}

export function toTimeInputValue(config: AttendanceScheduleConfig): string {
  return `${String(config.checkInHour).padStart(2, '0')}:${String(config.checkInMinute).padStart(2, '0')}`
}

export function updateScheduleTime(config: AttendanceScheduleConfig, timeValue: string): AttendanceScheduleConfig {
  const [hourText = '0', minuteText = '0'] = timeValue.split(':')
  return normalizeAttendanceScheduleConfig({
    ...config,
    checkInHour: Number(hourText),
    checkInMinute: Number(minuteText),
  })
}

export function getLateThreshold(config: AttendanceScheduleConfig): { hour: number; minute: number } {
  const totalMinutes = config.checkInHour * 60 + config.checkInMinute + config.toleranceMinutes
  return {
    hour: Math.floor((totalMinutes % (24 * 60)) / 60),
    minute: totalMinutes % 60,
  }
}

export function getCheckInLabel(config: AttendanceScheduleConfig): string {
  return formatScheduleTime(config.checkInHour, config.checkInMinute)
}

export function getLateAfterLabel(config: AttendanceScheduleConfig): string {
  const lateThreshold = getLateThreshold(config)
  return formatScheduleTime(lateThreshold.hour, lateThreshold.minute)
}

export function resolveAttendanceStatus(
  occurredAtMillis: number,
  config: AttendanceScheduleConfig,
): AttendanceStatus {
  const occurredAt = new Date(occurredAtMillis)
  const limit = new Date(occurredAtMillis)
  limit.setHours(config.checkInHour, config.checkInMinute, 0, 0)
  limit.setMinutes(limit.getMinutes() + config.toleranceMinutes)
  return occurredAt.getTime() > limit.getTime() ? 'TARDANZA' : 'OK'
}

export const TOLERANCE_PRESETS = [10, 15, 20, 30, 45, 60] as const

export type ScheduleStatusExample = {
  label: string
  time: string
  status: AttendanceStatus
}

export function buildScheduleStatusExamples(config: AttendanceScheduleConfig): ScheduleStatusExample[] {
  const base = new Date()
  base.setHours(config.checkInHour, config.checkInMinute, 0, 0)

  const scenarios = [
    { label: '15 min antes del ingreso', offsetMinutes: -15 },
    { label: 'Exactamente a la hora de ingreso', offsetMinutes: 0 },
    { label: 'Mitad de la tolerancia', offsetMinutes: Math.max(1, Math.floor(config.toleranceMinutes / 2)) },
    { label: 'Ultimo minuto permitido', offsetMinutes: config.toleranceMinutes },
    { label: '1 minuto despues del limite', offsetMinutes: config.toleranceMinutes + 1 },
  ]

  return scenarios.map(({ label, offsetMinutes }) => {
    const at = new Date(base.getTime() + offsetMinutes * 60_000)
    return {
      label,
      time: formatScheduleTime(at.getHours(), at.getMinutes()),
      status: resolveAttendanceStatus(at.getTime(), config),
    }
  })
}
