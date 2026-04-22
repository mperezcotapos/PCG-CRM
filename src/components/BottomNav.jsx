import { NavLink, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { useApp } from '../context/AppContext'

const MAIN_NAV = [
  {
    to: '/', exact: true, label: 'Dashboard',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    to: '/registro', label: 'Registro',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    to: '/historial', label: 'Historial',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    to: '/recordatorios', label: 'Recordar',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    to: '/chat', label: 'IA',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
  },
]

const MORE_NAV = [
  { to: '/clientes',      label: 'Clientes' },
  { to: '/proyectos',     label: 'Proyectos y Partidas' },
  { to: '/proveedores',   label: 'Proveedores' },
  { to: '/importar',      label: 'Importar datos' },
]

export default function BottomNav() {
  const [showMore, setShowMore] = useState(false)
  const location = useLocation()
  const { partidas, activities } = useApp()

  const retrasados = partidas.filter(p => {
    const acts = activities.filter(a => a.partidaId === p.id)
    if (!acts.length) return false
    return acts.sort((a, b) => new Date(b.date) - new Date(a.date))[0].status === 'retrasado'
  }).length

  const isMoreActive = MORE_NAV.some(n => location.pathname === n.to)

  return (
    <>
      {/* Overlay */}
      {showMore && (
        <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setShowMore(false)} />
      )}

      {/* More drawer */}
      {showMore && (
        <div className="fixed bottom-16 left-0 right-0 z-50 md:hidden bg-white border-t border-gray-100 rounded-t-2xl shadow-2xl px-4 pt-3 pb-4">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3 px-1">Más opciones</p>
          <div className="space-y-1">
            {MORE_NAV.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setShowMore(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    isActive ? 'bg-navy-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <button
              onClick={() => signOut(auth)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Cerrar sesión
            </button>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white border-t border-gray-100 safe-bottom">
        <div className="flex items-stretch h-16">
          {MAIN_NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors relative ${
                  isActive ? 'text-navy-600' : 'text-gray-400 hover:text-gray-600'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {item.label === 'Dashboard' && retrasados > 0 && (
                    <span className="absolute top-2 right-[calc(50%-12px)] w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {retrasados}
                    </span>
                  )}
                  <span className={`${isActive ? 'text-navy-600' : ''}`}>{item.icon}</span>
                  <span>{item.label}</span>
                  {isActive && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-navy-600 rounded-full" />}
                </>
              )}
            </NavLink>
          ))}

          {/* More button */}
          <button
            onClick={() => setShowMore(v => !v)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors relative ${
              isMoreActive || showMore ? 'text-navy-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span>Más</span>
            {(isMoreActive || showMore) && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-navy-600 rounded-full" />}
          </button>
        </div>
      </nav>
    </>
  )
}
