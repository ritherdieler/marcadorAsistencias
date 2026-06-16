import { NavLink, Outlet } from 'react-router-dom' // Tabs (NavLink) + render de página (Outlet)

// Componente pequeño para renderizar cada tab superior (Marcación / Administración). // UI
function TopTab({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to} // Ruta destino del tab
      className={({ isActive }) =>
        [
          'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition', // Estilo base
          isActive
            ? 'bg-brand-blue text-white shadow-md' // Tab activo (azul corporativo)
            : 'bg-white text-slate-600 hover:bg-slate-50', // Tab inactivo
        ].join(' ')
      }
    >
      {label /* Texto del tab */}
    </NavLink>
  )
}

// Layout principal según el diseño enviado: fondo con círculos + tarjeta centrada con tabs. // UI
export function ShellLayout() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-brand-bg text-slate-900">
      {/* Círculos decorativos de fondo (similar al mock) */}
      <div className="pointer-events-none absolute -left-40 top-10 h-[520px] w-[520px] rounded-full bg-brand-soft" />
      <div className="pointer-events-none absolute -right-48 bottom-6 h-[520px] w-[520px] rounded-full bg-brand-soft" />

      {/* Contenedor centrado */}
      <div className="relative mx-auto flex min-h-dvh max-w-6xl items-center justify-center px-4 py-10">
        {/* Tarjeta central */}
        <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
          {/* Tabs superiores */}
          <div className="flex items-center justify-center gap-3 border-b bg-white px-4 py-4">
            <TopTab to="/terminal" label="Marcación" />
            <TopTab to="/admin" label="Administración" />
          </div>

          {/* Contenido de la pantalla (Outlet) */}
          <div className="px-6 py-6 sm:px-10">
            <Outlet />
          </div>

          {/* Pie pequeño */}
          <div className="border-t bg-white px-6 py-4 text-center text-xs text-slate-500 sm:px-10">
            © {new Date().getFullYear()} · Sistema de Gestión Facial
          </div>
        </div>
      </div>
    </div>
  )
}
