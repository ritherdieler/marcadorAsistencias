import { afterEach, describe, expect, it } from 'vitest'

import {
  ATTENDANCE_HOLIDAYS_STORAGE_KEY,
  addHoliday,
  getHolidayName,
  isHoliday,
  isValidHolidayDateKey,
  loadAttendanceHolidaysConfig,
  normalizeAttendanceHolidaysConfig,
  removeHoliday,
  resetAttendanceHolidaysConfig,
  saveAttendanceHolidaysConfig,
  toHolidaySet,
} from '../services/attendanceHolidaysConfig'

const memory = new Map<string, string>()

const localStorageMock = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memory.set(key, value)
  },
  removeItem: (key: string) => {
    memory.delete(key)
  },
  clear: () => memory.clear(),
}

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true,
})

Object.defineProperty(globalThis, 'window', {
  value: {
    dispatchEvent: () => true,
  },
  configurable: true,
})

afterEach(() => {
  memory.clear()
})

describe('attendanceHolidaysConfig', () => {
  it('normaliza fechas, descarta invalidas y elimina duplicados', () => {
    const normalized = normalizeAttendanceHolidaysConfig([
      { date: '2026-07-28', name: 'Fiestas Patrias' },
      { date: '2026-07-28', name: 'Duplicado' },
      { date: 'no-fecha' },
      { date: '2026-12-25' },
      { date: '2026-01-01', name: '  ' },
    ])

    expect(normalized).toEqual([
      { date: '2026-01-01' },
      { date: '2026-07-28', name: 'Fiestas Patrias' },
      { date: '2026-12-25' },
    ])
  })

  it('isValidHolidayDateKey valida calendario real', () => {
    expect(isValidHolidayDateKey('2026-02-28')).toBe(true)
    expect(isValidHolidayDateKey('2026-02-30')).toBe(false)
    expect(isValidHolidayDateKey('2026-13-01')).toBe(false)
  })

  it('addHoliday y removeHoliday actualizan la lista', () => {
    const withOne = addHoliday([], { date: '2026-05-01', name: 'Dia del Trabajo' })
    expect(withOne).toEqual([{ date: '2026-05-01', name: 'Dia del Trabajo' }])

    const without = removeHoliday(withOne, '2026-05-01')
    expect(without).toEqual([])
  })

  it('isHoliday, getHolidayName y toHolidaySet', () => {
    const config = [
      { date: '2026-07-28', name: 'Fiestas Patrias' },
      { date: '2026-12-25' },
    ]

    expect(isHoliday(config, '2026-07-28')).toBe(true)
    expect(isHoliday(config, '2026-07-29')).toBe(false)
    expect(getHolidayName(config, '2026-07-28')).toBe('Fiestas Patrias')
    expect(getHolidayName(config, '2026-12-25')).toBeNull()
    expect([...toHolidaySet(config)]).toEqual(['2026-07-28', '2026-12-25'])
  })

  it('load/save/reset usan localStorage', () => {
    expect(loadAttendanceHolidaysConfig()).toEqual([])

    const saved = saveAttendanceHolidaysConfig([{ date: '2026-07-28', name: 'Fiestas Patrias' }])
    expect(saved).toEqual([{ date: '2026-07-28', name: 'Fiestas Patrias' }])
    expect(localStorage.getItem(ATTENDANCE_HOLIDAYS_STORAGE_KEY)).toContain('2026-07-28')
    expect(loadAttendanceHolidaysConfig()).toEqual(saved)

    expect(resetAttendanceHolidaysConfig()).toEqual([])
    expect(localStorage.getItem(ATTENDANCE_HOLIDAYS_STORAGE_KEY)).toBeNull()
  })
})
