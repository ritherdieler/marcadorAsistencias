import { Navigate } from 'react-router-dom'

import { isAdminUser } from '../../../utils/userRole'
import { getAuthUser } from '../utils/authStorage'

export function RequireAdmin({ children }: { children: React.ReactNode }) {
  const user = getAuthUser()

  if (!isAdminUser(user)) return <Navigate to="/login" replace />

  return <>{children}</>
}
