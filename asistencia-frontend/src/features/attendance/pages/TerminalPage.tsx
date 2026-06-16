import { AttendanceMarker } from '../components/AttendanceMarker'

export function TerminalPage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">Marcar asistencia</h1>
        <p className="mt-2 text-sm text-slate-600">
          Colocate frente a la camara para identificarte y confirmar tu asistencia.
        </p>
      </div>

      <AttendanceMarker />
    </div>
  )
}
