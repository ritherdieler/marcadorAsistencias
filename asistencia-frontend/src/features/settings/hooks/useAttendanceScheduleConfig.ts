import { useCallback, useEffect, useState } from 'react'

import {
  ATTENDANCE_SCHEDULE_CONFIG_EVENT,
  loadAttendanceScheduleConfig,
  resetAttendanceScheduleConfig,
  saveAttendanceScheduleConfig,
  type AttendanceScheduleConfig,
} from '../services/attendanceScheduleConfig'

export function useAttendanceScheduleConfig() {
  const [config, setConfig] = useState<AttendanceScheduleConfig>(() => loadAttendanceScheduleConfig())

  useEffect(() => {
    const sync = () => setConfig(loadAttendanceScheduleConfig())

    window.addEventListener(ATTENDANCE_SCHEDULE_CONFIG_EVENT, sync)
    window.addEventListener('storage', sync)

    return () => {
      window.removeEventListener(ATTENDANCE_SCHEDULE_CONFIG_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const save = useCallback((next: AttendanceScheduleConfig) => {
    const normalized = saveAttendanceScheduleConfig(next)
    setConfig(normalized)
    return normalized
  }, [])

  const reset = useCallback(() => {
    const defaults = resetAttendanceScheduleConfig()
    setConfig(defaults)
    return defaults
  }, [])

  return {
    config,
    save,
    reset,
  }
}
