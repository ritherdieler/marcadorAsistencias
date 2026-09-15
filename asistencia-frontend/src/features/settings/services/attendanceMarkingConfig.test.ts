import { afterEach, describe, expect, it } from 'vitest'

import type { User } from '../../../types/user'
import {
  ATTENDANCE_MARKING_STORAGE_KEY,
  isUserRequiredToMark,
  loadAttendanceMarkingConfig,
  normalizeAttendanceMarkingConfig,
  resetAttendanceMarkingConfig,
  saveAttendanceMarkingConfig,
  toExemptUserIdSet,
} from './attendanceMarkingConfig'
import { filterAttendanceWorkers } from '../../attendance/utils/attendanceReport'

const memory = new Map<string, string>()

Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value)
    },
    removeItem: (key: string) => {
      memory.delete(key)
    },
    clear: () => memory.clear(),
  },
  configurable: true,
})

Object.defineProperty(globalThis, 'window', {
  value: { dispatchEvent: () => true },
  configurable: true,
})

afterEach(() => {
  memory.clear()
})

function user(id: number): User {
  return { id, name: 'Nombre', lastName: 'Apellido', type: 'TECHNICIAN', dni: `${id}` }
}

describe('attendanceMarkingConfig', () => {
  it('normaliza exemptUserIds unicos y positivos', () => {
    expect(normalizeAttendanceMarkingConfig({ exemptUserIds: [3, 3, 0, -1, 2.5, 5] })).toEqual({
      exemptUserIds: [3, 5],
    })
  })

  it('isUserRequiredToMark respeta exentos', () => {
    const config = { exemptUserIds: [7] }
    expect(isUserRequiredToMark(config, 7)).toBe(false)
    expect(isUserRequiredToMark(config, 8)).toBe(true)
  })

  it('filterAttendanceWorkers excluye CLIENT y exentos', () => {
    const users: User[] = [
      user(1),
      { ...user(2), type: 'CLIENT' },
      user(3),
    ]
    const exempt = toExemptUserIdSet({ exemptUserIds: [3] })
    expect(filterAttendanceWorkers(users, exempt).map((item) => item.id)).toEqual([1])
  })

  it('persiste en localStorage', () => {
    saveAttendanceMarkingConfig({ exemptUserIds: [10, 20] })
    expect(memory.get(ATTENDANCE_MARKING_STORAGE_KEY)).toContain('10')
    expect(loadAttendanceMarkingConfig()).toEqual({ exemptUserIds: [10, 20] })
    resetAttendanceMarkingConfig()
    expect(loadAttendanceMarkingConfig()).toEqual({ exemptUserIds: [] })
  })
})
