import { Navigate, Route, Routes } from 'react-router-dom'

import { AdminLayout } from './components/layout/AdminLayout'
import { ShellLayout } from './components/layout/ShellLayout'
import { AdminAttendancePage } from './features/attendance/pages/AdminAttendancePage'
import { TerminalPage } from './features/attendance/pages/TerminalPage'
import { RequireAdmin } from './features/auth/components/RequireAdmin'
import { LoginPage } from './features/auth/pages/LoginPage'
import { AdminHomePage } from './features/dashboard/pages/AdminHomePage'
import { AdminRegisterPage } from './features/personnel/pages/AdminRegisterPage'

export default function App() {
  return (
    <Routes>
      <Route element={<ShellLayout />}>
        <Route path="/" element={<Navigate to="/terminal" replace />} />
        <Route path="/terminal" element={<TerminalPage />} />
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminHomePage />} />
        <Route path="registro" element={<AdminRegisterPage />} />
        <Route path="asistencias" element={<AdminAttendancePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/terminal" replace />} />
    </Routes>
  )
}
