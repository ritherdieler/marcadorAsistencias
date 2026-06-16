import { http } from './httpClient' // Cliente HTTP con baseURL=/ispadmin
import type { AttendanceDto } from '../types/attendance' // Tipo DTO

// Obtiene todos los registros de asistencia (endpoint real: GET /api/attendance/getAll). // Backend
export async function getAllAttendance(): Promise<AttendanceDto[]> {
  const { data } = await http.get<AttendanceDto[]>('/api/attendance/getAll') // GET /ispadmin/api/attendance/getAll
  return data // Retorna lista de AttendanceDto
}

