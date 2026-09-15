export type Holiday = {
  /** YYYY-MM-DD en fecha local */
  date: string
  name?: string
}

export type AttendanceHolidaysConfig = Holiday[]

export const ATTENDANCE_HOLIDAYS_STORAGE_KEY = 'giga-attendance-holidays-config'
export const ATTENDANCE_HOLIDAYS_CONFIG_EVENT = 'giga-attendance-holidays-config-changed'

export const DEFAULT_ATTENDANCE_HOLIDAYS_CONFIG: AttendanceHolidaysConfig = []

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function isValidHolidayDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_KEY_PATTERN.test(value)) return false
  const [yearText, monthText, dayText] = value.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
  )
}

function normalizeHolidayName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

export function normalizeHoliday(raw: unknown): Holiday | null {
  if (typeof raw !== 'object' || raw === null) return null
  const source = raw as Partial<Holiday>
  if (!isValidHolidayDateKey(source.date)) return null
  const name = normalizeHolidayName(source.name)
  return name ? { date: source.date, name } : { date: source.date }
}

export function normalizeAttendanceHolidaysConfig(raw: unknown): AttendanceHolidaysConfig {
  const list = Array.isArray(raw) ? raw : []
  const byDate = new Map<string, Holiday>()

  for (const item of list) {
    const holiday = normalizeHoliday(item)
    if (!holiday) continue
    if (byDate.has(holiday.date)) continue
    byDate.set(holiday.date, holiday)
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function loadAttendanceHolidaysConfig(): AttendanceHolidaysConfig {
  try {
    const raw = localStorage.getItem(ATTENDANCE_HOLIDAYS_STORAGE_KEY)
    if (!raw) return [...DEFAULT_ATTENDANCE_HOLIDAYS_CONFIG]
    return normalizeAttendanceHolidaysConfig(JSON.parse(raw))
  } catch {
    return [...DEFAULT_ATTENDANCE_HOLIDAYS_CONFIG]
  }
}

export function saveAttendanceHolidaysConfig(config: AttendanceHolidaysConfig): AttendanceHolidaysConfig {
  const normalized = normalizeAttendanceHolidaysConfig(config)
  localStorage.setItem(ATTENDANCE_HOLIDAYS_STORAGE_KEY, JSON.stringify(normalized))
  window.dispatchEvent(new Event(ATTENDANCE_HOLIDAYS_CONFIG_EVENT))
  return normalized
}

export function resetAttendanceHolidaysConfig(): AttendanceHolidaysConfig {
  localStorage.removeItem(ATTENDANCE_HOLIDAYS_STORAGE_KEY)
  window.dispatchEvent(new Event(ATTENDANCE_HOLIDAYS_CONFIG_EVENT))
  return [...DEFAULT_ATTENDANCE_HOLIDAYS_CONFIG]
}

export function addHoliday(
  config: AttendanceHolidaysConfig,
  holiday: Holiday,
): AttendanceHolidaysConfig {
  return normalizeAttendanceHolidaysConfig([...config, holiday])
}

export function removeHoliday(config: AttendanceHolidaysConfig, date: string): AttendanceHolidaysConfig {
  return normalizeAttendanceHolidaysConfig(config.filter((item) => item.date !== date))
}

export function isHoliday(config: AttendanceHolidaysConfig, dateKey: string): boolean {
  return config.some((item) => item.date === dateKey)
}

export function getHolidayName(config: AttendanceHolidaysConfig, dateKey: string): string | null {
  const found = config.find((item) => item.date === dateKey)
  return found?.name?.trim() || null
}

export function toHolidaySet(config: AttendanceHolidaysConfig): Set<string> {
  return new Set(config.map((item) => item.date))
}

export function toHolidayNameMap(config: AttendanceHolidaysConfig): Map<string, string | null> {
  return new Map(config.map((item) => [item.date, item.name?.trim() || null]))
}
