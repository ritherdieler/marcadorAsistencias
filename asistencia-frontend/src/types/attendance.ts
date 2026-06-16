// Tipo basado en AttendanceDto del backend. // Dominio
export interface AttendanceDto {
  id: number // ID del registro de asistencia
  userId: number // ID del usuario relacionado
  checkIn: string | number // Fecha/hora de ingreso (depende de serialización Jackson)
  checkOut?: string | number | null // Fecha/hora de salida (opcional)
  method: string // "FACIAL" / "MANUAL"
  status: string // "OK" u otro estado
}

