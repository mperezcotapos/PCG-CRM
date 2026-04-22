import { NavLink } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { useApp } from '../context/AppContext'
import { isPast, isToday, parseISO } from 'date-fns'

const NAV = [
  {
    to: '/', label: 'Dashboard', exact: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    to: '/registro', label: 'Nuevo Registro',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    to: '/historial', label: 'Historial',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    to: '/clientes', label: 'Clientes',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    to: '/proyectos', label: 'Proyectos',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    to: '/proveedores', label: 'Proveedores',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
      </svg>
    ),
  },
  {
    to: '/recordatorios', label: 'Recordatorios',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    to: '/chat', label: 'Asistente IA',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
  },
]

export default function Sidebar() {
  const { partidas, activities, reminders } = useApp()

  // Count retrasados
  const retrasados = partidas.filter(p => {
    const acts = activities.filter(a => a.partidaId === p.id)
    if (!acts.length) return false
    const latest = acts.sort((a, b) => new Date(b.date) - new Date(a.date))[0]
    return latest.status === 'retrasado'
  }).length

  // Count recordatorios vencidos o de hoy pendientes
  const remindersBadge = reminders.filter(r => {
    if (r.estado !== 'pendiente' || !r.fechaLimite) return false
    const d = parseISO(r.fechaLimite)
    return isPast(d) || isToday(d)
  }).length

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
      isActive
        ? 'bg-navy-600 text-white shadow-md'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 bg-white border-r border-gray-100 flex-col z-40">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="PCG" className="w-8 h-8 rounded-lg object-contain" />
          <div>
            <div className="font-bold text-sm text-gray-900 leading-tight">PCG Group</div>
            <div className="text-xs text-gray-400 leading-tight">CRM Operacional</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.exact}
            className={linkClass}
          >
            {item.icon}
            <span className="flex-1">{item.label}</span>
            {item.label === 'Dashboard' && retrasados > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {retrasados}
              </span>
            )}
            {item.label === 'Recordatorios' && remindersBadge > 0 && (
              <span className="bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {remindersBadge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Stats + logout footer */}
      <div className="px-4 py-4 border-t border-gray-100 space-y-3">
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Partidas activas</span>
            <span className="font-semibold text-gray-700">
              {partidas.filter(p => {
                const acts = activities.filter(a => a.partidaId === p.id)
                if (!acts.length) return true
                const lat = acts.sort((a,b)=>new Date(b.date)-new Date(a.date))[0]
                return lat.status !== 'listo' && lat.status !== 'cancelado'
              }).length}
            </span>
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Retrasados</span>
            <span className="font-semibold text-red-600">{retrasados}</span>
          </div>
        </div>
        <button
          onClick={() => signOut(auth)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
