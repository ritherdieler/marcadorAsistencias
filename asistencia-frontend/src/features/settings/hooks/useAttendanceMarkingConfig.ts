import { useCallback, useEffect, useState } from 'react'

import {
  ATTENDANCE_MARKING_CONFIG_EVENT,
  loadAttendanceMarkingConfig,
  resetAttendanceMarkingConfig,
  saveAttendanceMarkingConfig,
  setUserMustMark,
  type AttendanceMarkingConfig,
} from '../services/attendanceMarkingConfig'

export function useAttendanceMarkingConfig() {
  const [config, setConfig] = useState<AttendanceMarkingConfig>(() => loadAttendanceMarkingConfig())

  useEffect(() => {
    const sync = () => setConfig(loadAttendanceMarkingConfig())

    window.addEventListener(ATTENDANCE_MARKING_CONFIG_EVENT, sync)
    window.addEventListener('storage', sync)

    return () => {
      window.removeEventListener(ATTENDANCE_MARKING_CONFIG_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const save = useCallback((next: AttendanceMarkingConfig) => {
    const normalized = saveAttendanceMarkingConfig(next)
    setConfig(normalized)
    return normalized
  }, [])

  const reset = useCallback(() => {
    const defaults = resetAttendanceMarkingConfig()
    setConfig(defaults)
    return defaults
  }, [])

  const setMustMark = useCallback((userId: number, mustMark: boolean) => {
    const next = saveAttendanceMarkingConfig(setUserMustMark(loadAttendanceMarkingConfig(), userId, mustMark))
    setConfig(next)
    return next
  }, [])

  return {
    config,
    save,
    reset,
    setMustMark,
  }
}
