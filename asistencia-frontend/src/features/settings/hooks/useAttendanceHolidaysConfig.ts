import { useCallback, useEffect, useState } from 'react'

import {
  ATTENDANCE_HOLIDAYS_CONFIG_EVENT,
  addHoliday as addHolidayToConfig,
  loadAttendanceHolidaysConfig,
  removeHoliday as removeHolidayFromConfig,
  resetAttendanceHolidaysConfig,
  saveAttendanceHolidaysConfig,
  type AttendanceHolidaysConfig,
  type Holiday,
} from '../services/attendanceHolidaysConfig'

export function useAttendanceHolidaysConfig() {
  const [holidays, setHolidays] = useState<AttendanceHolidaysConfig>(() => loadAttendanceHolidaysConfig())

  useEffect(() => {
    const sync = () => setHolidays(loadAttendanceHolidaysConfig())

    window.addEventListener(ATTENDANCE_HOLIDAYS_CONFIG_EVENT, sync)
    window.addEventListener('storage', sync)

    return () => {
      window.removeEventListener(ATTENDANCE_HOLIDAYS_CONFIG_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const save = useCallback((next: AttendanceHolidaysConfig) => {
    const normalized = saveAttendanceHolidaysConfig(next)
    setHolidays(normalized)
    return normalized
  }, [])

  const reset = useCallback(() => {
    const defaults = resetAttendanceHolidaysConfig()
    setHolidays(defaults)
    return defaults
  }, [])

  const add = useCallback((holiday: Holiday) => {
    const next = saveAttendanceHolidaysConfig(addHolidayToConfig(loadAttendanceHolidaysConfig(), holiday))
    setHolidays(next)
    return next
  }, [])

  const remove = useCallback((date: string) => {
    const next = saveAttendanceHolidaysConfig(removeHolidayFromConfig(loadAttendanceHolidaysConfig(), date))
    setHolidays(next)
    return next
  }, [])

  return {
    holidays,
    save,
    reset,
    add,
    remove,
  }
}
