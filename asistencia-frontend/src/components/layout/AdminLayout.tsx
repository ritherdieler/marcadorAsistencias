import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { clearAllLocalAppData } from '../../services/localAppData'
import { getAuthUser } from '../../features/auth/utils/authStorage'

function Icon({ name }: { name: 'dashboard' | 'registro' | 'asistencias' | 'configuracion' }) {
  const paths: Record<typeof name, string> = {
    dashboard: 'M3 13h8V3H3v10Zm10 8h8V11h-8v10ZM3 21h8V15H3v6Zm10-10h8V3h-8v8Z',
    registro:
      'M16 11c1.66 0 3-1.34 3-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3Zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V20h14v-3.5C15 14.17 10.33 13 8 13Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V20h6v-3.5c0-2.33-4.67-3.5-7-3.5Z',
    asistencias:
      'M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2Zm0 18H5V8h14v13Zm-2-9H7v-2h10v2Zm-3 4H7v-2h7v2Z',
    configuracion:
      'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8.94 3a7.96 7.96 0 0 1-.08.59l1.66 1.3-1.57 2.72-1.96-.78a8.05 8.05 0 0 1-1.02.59l-.3 2.06H9.33l-.3-2.06a8.05 8.05 0 0 1-1.02-.59l-1.96.78-1.57-2.72 1.66-1.3a7.96 7.96 0 0 1-.08-.59l-1.66-1.3 1.57-2.72 1.96.78c.32-.22.66-.42 1.02-.59l.3-2.06h3.34l.3 2.06c.36.17.7.37 1.02.59l1.96-.78 1.57 2.72-1.66 1.3Z',
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="currentColor" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}

function SideItem({
  to,
  label,
  icon,
}: {
  to: string
  label: string
  icon: 'dashboard' | 'registro' | 'asistencias' | 'configuracion'
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition',
          isActive ? 'bg-brand-blue text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={[
              'grid h-9 w-9 place-items-center rounded-xl',
              isActive ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600',
            ].join(' ')}
          >
            <Icon name={icon} />
          </span>
          <span className="truncate">{label}</span>
        </>
      )}
    </NavLink>
  )
}

export function AdminLayout() {
  const navigate = useNavigate()
  const user = getAuthUser()

  async function logout() {
    await clearAllLocalAppData()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <div className="flex min-h-dvh w-full">
        <aside className="hidden w-[280px] shrink-0 border-r bg-white md:block">
          <div className="px-4 py-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-brand-blue" />
              <div className="leading-tight">
                <div className="text-sm font-bold text-slate-900">GigaFiber</div>
                <div className="text-xs text-slate-500">Gestion de Asistencia</div>
              </div>
            </div>

            <nav className="mt-7 space-y-2">
              <SideItem to="/admin/dashboard" label="Dashboard" icon="dashboard" />
              <SideItem to="/admin/registro" label="Registrar Personal" icon="registro" />
              <SideItem to="/admin/asistencias" label="Asistencias" icon="asistencias" />
              <SideItem to="/admin/configuracion-facial" label="Config. facial" icon="configuracion" />
            </nav>

            <div className="mt-8 border-t pt-4">
              <button
                onClick={logout}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-slate-50"
              >
                Salir del Sistema
              </button>
              <div className="mt-3 text-xs text-slate-500">
                Sesion: <span className="font-semibold">{user?.username ?? user?.id}</span>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b bg-white md:hidden">
            <div className="flex items-center justify-between px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-brand-blue" />
                <div className="leading-tight">
                  <div className="text-sm font-bold text-slate-900">GigaFiber</div>
                  <div className="text-xs text-slate-500">Gestion de Asistencia</div>
                </div>
              </div>
              <button
                onClick={logout}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-red-600"
              >
                Salir
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto px-4 pb-4">
              <SideItem to="/admin/dashboard" label="Dashboard" icon="dashboard" />
              <SideItem to="/admin/registro" label="Registrar" icon="registro" />
              <SideItem to="/admin/asistencias" label="Asistencias" icon="asistencias" />
              <SideItem to="/admin/configuracion-facial" label="Config. facial" icon="configuracion" />
            </div>
          </header>

          <main className="flex-1 px-4 pb-6 pt-16 md:px-8 md:pt-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
