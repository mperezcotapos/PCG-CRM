import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './lib/firebase'
import { AppProvider } from './context/AppContext'
import Sidebar    from './components/Sidebar'
import BottomNav  from './components/BottomNav'
import Login      from './components/Login'
import Dashboard  from './views/Dashboard'
import QuickEntry from './views/QuickEntry'
import History    from './views/History'
import Clients    from './views/Clients'
import Projects   from './views/Projects'
import Providers  from './views/Providers'
import Import     from './views/Import'
import Chat       from './views/Chat'
import Reminders  from './views/Reminders'

export default function App() {
  const [user, setUser] = useState(undefined) // undefined = cargando

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u ?? null))
    return unsub
  }, [])

  // Pantalla de carga mientras Firebase verifica la sesión
  if (user === undefined) return (
    <div className="min-h-dvh flex items-center justify-center bg-[#F4F2EF]">
      <div className="w-8 h-8 border-2 border-navy-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // No autenticado → mostrar login
  if (!user) return <Login />

  // Autenticado → mostrar app
  return (
    <BrowserRouter>
      <AppProvider>
        <div className="flex min-h-dvh">
          {/* Sidebar: solo desktop */}
          <Sidebar />
          {/* Main content */}
          <main className="flex-1 md:ml-60 p-4 md:p-6 pb-28 md:pb-6 w-full">
            <Routes>
              <Route path="/"            element={<Dashboard />} />
              <Route path="/registro"    element={<QuickEntry />} />
              <Route path="/historial"   element={<History />} />
              <Route path="/clientes"    element={<Clients />} />
              <Route path="/proyectos"   element={<Projects />} />
              <Route path="/proveedores" element={<Providers />} />
              <Route path="/importar"    element={<Import />} />
              <Route path="/chat"        element={<Chat />} />
              <Route path="/recordatorios" element={<Reminders />} />
              <Route path="*"            element={<Navigate to="/" />} />
            </Routes>
          </main>
          {/* Bottom nav: solo mobile */}
          <BottomNav />
        </div>
      </AppProvider>
    </BrowserRouter>
  )
}
