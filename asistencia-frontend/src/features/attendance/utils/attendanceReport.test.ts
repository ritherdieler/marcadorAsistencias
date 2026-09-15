import { describe, expect, it, vi } from 'vitest'

import type { AttendanceDto } from '../../../types/attendance'
import type { User, UserType } from '../../../types/user'
import {
  buildAttendanceReportRows,
  filterAttendanceReportRows,
  isAttendanceWorker,
  summarizeAttendanceReport,
} from './attendanceReport'

function user(partial: Partial<User> & Pick<User, 'id'>): User {
  return {
    name: `Nombre${partial.id}`,
    lastName: `Apellido${partial.id}`,
    dni: String(10000000 + partial.id),
    type: 'TECHNICIAN',
    ...partial,
  }
}

function attendance(partial: Partial<AttendanceDto> & Pick<AttendanceDto, 'id' | 'userId' | 'checkIn'>): AttendanceDto {
  return {
    method: 'FACIAL',
    status: 'OK',
    checkOut: null,
    ...partial,
  }
}

/** Fecha local YYYY-MM-DD a ISO local mediodia (evita bordes UTC). */
function localIso(dateKey: string, hour = 8, minute = 0): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const date = new Date(y, m - 1, d, hour, minute, 0, 0)
  return date.toISOString()
}

describe('attendanceReport', () => {
  it('sin Desde/Hasta usa hoy e incluye FALTÓ junto a quien marco', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 15, 10, 0, 0))

    const workers = [user({ id: 1 }), user({ id: 2 })]
    const day = '2026-09-15'
    const attendances = [
      attendance({
        id: 1,
        userId: 1,
        checkIn: localIso(day, 8, 0),
        checkOut: localIso(day, 17, 0),
      }),
    ]

    const rows = buildAttendanceReportRows(workers, attendances, '', '')
    const filtered = filterAttendanceReportRows(rows, '', '', '')

    expect(rows).toHaveLength(2)
    expect(filtered).toHaveLength(2)
    expect(rows.find((row) => row.userId === 2)?.reportStatus).toBe('FALTO')
    expect(rows.find((row) => row.userId === 1)?.reportStatus).toBe('MARCO')

    vi.useRealTimers()
  })

  it('personal exento no aparece en el reporte del dia', () => {
    const workers = [user({ id: 1 }), user({ id: 2 })]
    const day = '2026-09-10'
    const attendances = [
      attendance({
        id: 1,
        userId: 1,
        checkIn: localIso(day, 8, 0),
        checkOut: localIso(day, 17, 0),
      }),
    ]
    const exempt = new Set([2])

    const rows = buildAttendanceReportRows(workers, attendances, day, day, new Set(), new Map(), exempt)

    expect(rows).toHaveLength(1)
    expect(rows[0]?.userId).toBe(1)
  })

  it('10 trabajadores y 9 asistencias → 1 FALTÓ', () => {
    const workers = Array.from({ length: 10 }, (_, index) => user({ id: index + 1 }))
    const day = '2026-09-10' // miercoles
    const attendances = workers.slice(0, 9).map((worker, index) =>
      attendance({
        id: index + 1,
        userId: worker.id,
        checkIn: localIso(day, 8, 0),
        checkOut: localIso(day, 17, 0),
        status: 'OK',
      }),
    )

    const rows = buildAttendanceReportRows(workers, attendances, day, day)
    const faltaron = rows.filter((row) => row.reportStatus === 'FALTO')

    expect(rows).toHaveLength(10)
    expect(faltaron).toHaveLength(1)
    expect(faltaron[0]?.userId).toBe(10)
    expect(summarizeAttendanceReport(rows)).toMatchObject({
      totalPersonal: 10,
      marcaron: 9,
      faltaron: 1,
      feriados: 0,
    })
  })

  it('trabajador sin asistencia aparece igualmente como FALTÓ', () => {
    const workers = [user({ id: 1 }), user({ id: 2 })]
    const day = '2026-09-10'
    const attendances = [
      attendance({
        id: 1,
        userId: 1,
        checkIn: localIso(day, 8, 0),
        checkOut: localIso(day, 17, 0),
      }),
    ]

    const rows = buildAttendanceReportRows(workers, attendances, day, day)
    const missing = rows.find((row) => row.userId === 2)

    expect(missing).toBeDefined()
    expect(missing?.reportStatus).toBe('FALTO')
    expect(missing?.checkIn).toBeNull()
    expect(missing?.checkOut).toBeNull()
    expect(missing?.method).toBeNull()
  })

  it('usuario CLIENT no aparece como trabajador', () => {
    const users: User[] = [
      user({ id: 1, type: 'TECHNICIAN' }),
      user({ id: 2, type: 'CLIENT' as UserType, dni: '99999999' }),
    ]
    const day = '2026-09-10'

    const rows = buildAttendanceReportRows(users, [], day, day)

    expect(isAttendanceWorker(users[1]!)).toBe(false)
    expect(rows.every((row) => row.userId !== 2)).toBe(true)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.reportStatus).toBe('FALTO')
  })

  it('trabajador con checkIn pero sin checkOut → MARCÓ', () => {
    const workers = [user({ id: 1 })]
    const day = '2026-09-10'
    const attendances = [
      attendance({
        id: 1,
        userId: 1,
        checkIn: localIso(day, 8, 5),
        checkOut: null,
        status: 'OK',
      }),
    ]

    const rows = buildAttendanceReportRows(workers, attendances, day, day)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.reportStatus).toBe('MARCO')
  })

  it('status TARDANZA continúa siendo TARDANZA', () => {
    const workers = [user({ id: 1 })]
    const day = '2026-09-10'
    const attendances = [
      attendance({
        id: 1,
        userId: 1,
        checkIn: localIso(day, 9, 10),
        checkOut: localIso(day, 17, 0),
        status: 'TARDANZA',
      }),
    ]

    const rows = buildAttendanceReportRows(workers, attendances, day, day)
    expect(rows[0]?.reportStatus).toBe('TARDANZA')
  })

  it('dos registros del mismo usuario el mismo día → una sola fila diaria', () => {
    const workers = [user({ id: 1 })]
    const day = '2026-09-10'
    const attendances = [
      attendance({
        id: 1,
        userId: 1,
        checkIn: localIso(day, 9, 0),
        checkOut: null,
        status: 'TARDANZA',
      }),
      attendance({
        id: 2,
        userId: 1,
        checkIn: localIso(day, 8, 0),
        checkOut: localIso(day, 18, 30),
        status: 'OK',
      }),
    ]

    const rows = buildAttendanceReportRows(workers, attendances, day, day)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.checkIn).toBe(attendances[1]!.checkIn)
    expect(rows[0]?.checkOut).toBe(attendances[1]!.checkOut)
    expect(rows[0]?.reportStatus).toBe('TARDANZA')
    expect(rows[0]?.sourceAttendanceIds).toEqual([1, 2])
  })

  it('sábado sin marcación → crea FALTÓ (día laborable)', () => {
    const workers = [user({ id: 1 })]
    const saturday = '2026-09-12'
    const rows = buildAttendanceReportRows(workers, [], saturday, saturday)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.reportStatus).toBe('FALTO')
  })

  it('domingo sin marcación → no crear FALTÓ', () => {
    const workers = [user({ id: 1 })]
    const sunday = '2026-09-13'
    const rows = buildAttendanceReportRows(workers, [], sunday, sunday)
    expect(rows).toHaveLength(0)
  })

  it('filtro por DNI encuentra también a un FALTÓ', () => {
    const workers = [
      user({ id: 1, dni: '11111111' }),
      user({ id: 2, dni: '22222222' }),
    ]
    const day = '2026-09-10'
    const attendances = [
      attendance({
        id: 1,
        userId: 1,
        checkIn: localIso(day, 8, 0),
        checkOut: localIso(day, 17, 0),
      }),
    ]

    const rows = buildAttendanceReportRows(workers, attendances, day, day)
    const filtered = filterAttendanceReportRows(rows, day, day, '22222222')

    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.reportStatus).toBe('FALTO')
    expect(filtered[0]?.userDni).toBe('22222222')
  })

  it('rango de dos días → genera trabajador + día correctamente', () => {
    const workers = [user({ id: 1, name: 'Juan' }), user({ id: 2, name: 'Pedro' })]
    const day1 = '2026-09-10'
    const day2 = '2026-09-11'
    const attendances = [
      attendance({
        id: 1,
        userId: 1,
        checkIn: localIso(day1, 8, 0),
        checkOut: localIso(day1, 17, 0),
      }),
      attendance({
        id: 2,
        userId: 1,
        checkIn: localIso(day2, 8, 0),
        checkOut: localIso(day2, 17, 0),
      }),
      attendance({
        id: 3,
        userId: 2,
        checkIn: localIso(day2, 8, 15),
        checkOut: localIso(day2, 17, 0),
      }),
    ]

    const rows = buildAttendanceReportRows(workers, attendances, day1, day2)
    const byKey = Object.fromEntries(rows.map((row) => [`${row.userId}|${row.dateKey}`, row.reportStatus]))

    expect(rows).toHaveLength(4)
    expect(byKey['1|2026-09-10']).toBe('MARCO')
    expect(byKey['2|2026-09-10']).toBe('FALTO')
    expect(byKey['1|2026-09-11']).toBe('MARCO')
    expect(byKey['2|2026-09-11']).toBe('MARCO')
  })

  it('día laborable feriado sin marca → FERIADO (no cuenta como falta)', () => {
    const workers = [user({ id: 1 }), user({ id: 2 })]
    const day = '2026-09-10'
    const holidays = new Set([day])
    const holidayNames = new Map([[day, 'Fiestas Patrias']])

    const rows = buildAttendanceReportRows(workers, [], day, day, holidays, holidayNames)
    expect(rows).toHaveLength(2)
    expect(rows.every((row) => row.reportStatus === 'FERIADO')).toBe(true)
    expect(rows[0]?.holidayName).toBe('Fiestas Patrias')
    expect(summarizeAttendanceReport(rows)).toMatchObject({
      totalPersonal: 2,
      marcaron: 0,
      faltaron: 0,
      feriados: 2,
    })
  })

  it('feriado con marca real conserva estado de marcación', () => {
    const workers = [user({ id: 1 })]
    const day = '2026-09-10'
    const holidays = new Set([day])
    const attendances = [
      attendance({
        id: 1,
        userId: 1,
        checkIn: localIso(day, 8, 0),
        checkOut: localIso(day, 17, 0),
        status: 'OK',
      }),
    ]

    const rows = buildAttendanceReportRows(workers, attendances, day, day, holidays)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.reportStatus).toBe('MARCO')
  })

  it('día laborable normal sin marca → FALTÓ', () => {
    const workers = [user({ id: 1 })]
    const day = '2026-09-11'
    const rows = buildAttendanceReportRows(workers, [], day, day)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.reportStatus).toBe('FALTO')
  })
})
